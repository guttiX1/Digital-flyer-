// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HorseRaceMarket
 * @notice Parimutuel binary prediction market for horse racing events on Polygon.
 *
 * Architecture (inspired by Polymarket CTF Exchange, simplified for parimutuel):
 *  - Each race creates a market with exactly 2 outcomes: Horse A (outcome 1) or Horse B (outcome 2).
 *  - Bettors deposit USDC into either outcome pool before the market closes.
 *  - A 2% fee is deducted on entry and sent immediately to the owner.
 *  - When the owner resolves the market, winners split the entire net pool
 *    proportional to their share of the winning-side pool.
 *  - If the market is cancelled (e.g., race postponed), bettors can reclaim
 *    their net deposits (fees already collected are non-refundable).
 */
contract HorseRaceMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant FEE_BPS = 200;  // 2% fee in basis points
    uint256 public constant BPS     = 10_000;

    uint8 public constant OUTCOME_A = 1;
    uint8 public constant OUTCOME_B = 2;

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Market {
        string  raceId;       // human-readable race identifier
        string  horseA;       // name of Horse A
        string  horseB;       // name of Horse B
        uint256 closingTime;  // no new bets after this timestamp
        uint256 poolA;        // net USDC (after fee) in outcome A pool
        uint256 poolB;        // net USDC (after fee) in outcome B pool
        uint8   result;       // 0=open, 1=A won, 2=B won
        bool    resolved;
        bool    cancelled;
    }

    struct Position {
        uint256 sharesA;  // net USDC deposited on Horse A
        uint256 sharesB;  // net USDC deposited on Horse B
        bool    claimed;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20  public immutable usdc;
    uint256 public marketCount;

    mapping(uint256 => Market)                        public markets;
    mapping(uint256 => mapping(address => Position))  public positions;

    // ─── Events ──────────────────────────────────────────────────────────────

    event MarketCreated(
        uint256 indexed marketId,
        string  raceId,
        string  horseA,
        string  horseB,
        uint256 closingTime
    );
    event SharesBought(
        uint256 indexed marketId,
        address indexed buyer,
        uint8           outcome,
        uint256         grossAmount,
        uint256         netShares,
        uint256         fee
    );
    event MarketResolved(uint256 indexed marketId, uint8 result);
    event MarketCancelled(uint256 indexed marketId);
    event WinningsClaimed(uint256 indexed marketId, address indexed claimer, uint256 payout);
    event RefundClaimed(uint256 indexed marketId, address indexed claimer, uint256 refund);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _usdc) Ownable(msg.sender) {
        require(_usdc != address(0), "zero address");
        usdc = IERC20(_usdc);
    }

    // ─── Owner: market lifecycle ──────────────────────────────────────────────

    /**
     * @notice Create a new binary race market.
     * @param raceId      Unique race identifier string (e.g. "GP2025-R3")
     * @param horseA      Name of Horse A
     * @param horseB      Name of Horse B
     * @param closingTime Unix timestamp when betting closes (must be in the future)
     * @return marketId   Sequential market index
     */
    function createMarket(
        string calldata raceId,
        string calldata horseA,
        string calldata horseB,
        uint256         closingTime
    ) external onlyOwner returns (uint256 marketId) {
        require(closingTime > block.timestamp, "closing time in the past");
        require(bytes(raceId).length  > 0, "empty raceId");
        require(bytes(horseA).length  > 0, "empty horseA");
        require(bytes(horseB).length  > 0, "empty horseB");

        marketId = marketCount;
        unchecked { ++marketCount; }

        markets[marketId] = Market({
            raceId:      raceId,
            horseA:      horseA,
            horseB:      horseB,
            closingTime: closingTime,
            poolA:       0,
            poolB:       0,
            result:      0,
            resolved:    false,
            cancelled:   false
        });

        emit MarketCreated(marketId, raceId, horseA, horseB, closingTime);
    }

    /**
     * @notice Declare the winning outcome and close the market for claims.
     * @param marketId       Target market
     * @param winningOutcome 1 = Horse A won, 2 = Horse B won
     */
    function resolveMarket(uint256 marketId, uint8 winningOutcome) external onlyOwner {
        Market storage m = markets[marketId];
        require(!m.resolved && !m.cancelled, "market not active");
        require(winningOutcome == OUTCOME_A || winningOutcome == OUTCOME_B, "invalid outcome");

        m.resolved = true;
        m.result   = winningOutcome;

        emit MarketResolved(marketId, winningOutcome);
    }

    /**
     * @notice Cancel a market (e.g. race postponed). Bettors may claim refunds.
     *         Fees already collected are non-refundable.
     */
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage m = markets[marketId];
        require(!m.resolved && !m.cancelled, "market not active");

        m.cancelled = true;
        emit MarketCancelled(marketId);
    }

    // ─── Public: betting ─────────────────────────────────────────────────────

    /**
     * @notice Buy shares in one outcome of a market.
     * @param marketId    Target market
     * @param outcome     1 = Horse A, 2 = Horse B
     * @param grossAmount USDC amount to spend (including the 2% fee)
     */
    function buyShares(
        uint256 marketId,
        uint8   outcome,
        uint256 grossAmount
    ) external nonReentrant {
        Market storage m = markets[marketId];
        require(!m.resolved && !m.cancelled, "market not active");
        require(block.timestamp < m.closingTime, "betting closed");
        require(outcome == OUTCOME_A || outcome == OUTCOME_B, "invalid outcome");
        require(grossAmount > 0, "zero amount");

        uint256 fee       = (grossAmount * FEE_BPS) / BPS;
        uint256 netShares = grossAmount - fee;

        // Collect gross from bettor
        usdc.safeTransferFrom(msg.sender, address(this), grossAmount);
        // Forward fee immediately to owner
        usdc.safeTransfer(owner(), fee);

        Position storage pos = positions[marketId][msg.sender];
        if (outcome == OUTCOME_A) {
            m.poolA      += netShares;
            pos.sharesA  += netShares;
        } else {
            m.poolB      += netShares;
            pos.sharesB  += netShares;
        }

        emit SharesBought(marketId, msg.sender, outcome, grossAmount, netShares, fee);
    }

    // ─── Public: settlement ──────────────────────────────────────────────────

    /**
     * @notice Claim winnings after market resolution.
     *         Payout = (your winning shares / total winning pool) * total net pool
     */
    function claimWinnings(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.resolved, "not resolved");

        Position storage pos = positions[marketId][msg.sender];
        require(!pos.claimed, "already claimed");
        pos.claimed = true;

        uint256 totalPool   = m.poolA + m.poolB;
        uint256 winnerPool  = m.result == OUTCOME_A ? m.poolA : m.poolB;
        uint256 userShares  = m.result == OUTCOME_A ? pos.sharesA : pos.sharesB;

        uint256 payout = winnerPool > 0 ? (userShares * totalPool) / winnerPool : 0;

        if (payout > 0) {
            usdc.safeTransfer(msg.sender, payout);
        }

        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /**
     * @notice Claim a refund of net deposits if the market was cancelled.
     *         The 2% fee collected at entry is non-refundable.
     */
    function claimRefund(uint256 marketId) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.cancelled, "not cancelled");

        Position storage pos = positions[marketId][msg.sender];
        require(!pos.claimed, "already claimed");
        pos.claimed = true;

        uint256 refund = pos.sharesA + pos.sharesB;
        require(refund > 0, "nothing to refund");

        usdc.safeTransfer(msg.sender, refund);
        emit RefundClaimed(marketId, msg.sender, refund);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Current implied probability for each outcome (in BPS, sums to 10000).
    function getOdds(uint256 marketId)
        external
        view
        returns (uint256 oddsA, uint256 oddsB)
    {
        Market storage m = markets[marketId];
        uint256 total = m.poolA + m.poolB;
        if (total == 0) return (5_000, 5_000); // 50/50 when no bets placed
        oddsA = (m.poolA * BPS) / total;
        oddsB = BPS - oddsA;
    }

    /// @notice Compute payout a user would receive if they claimed now (read-only).
    function pendingPayout(uint256 marketId, address user)
        external
        view
        returns (uint256)
    {
        Market storage m = markets[marketId];
        if (!m.resolved) return 0;

        Position storage pos = positions[marketId][user];
        if (pos.claimed) return 0;

        uint256 totalPool  = m.poolA + m.poolB;
        uint256 winnerPool = m.result == OUTCOME_A ? m.poolA : m.poolB;
        uint256 userShares = m.result == OUTCOME_A ? pos.sharesA : pos.sharesB;

        return winnerPool > 0 ? (userShares * totalPool) / winnerPool : 0;
    }

    /// @notice Get full market details.
    function getMarket(uint256 marketId)
        external
        view
        returns (
            string memory raceId,
            string memory horseA,
            string memory horseB,
            uint256 closingTime,
            uint256 poolA,
            uint256 poolB,
            uint8   result,
            bool    resolved,
            bool    cancelled
        )
    {
        Market storage m = markets[marketId];
        return (
            m.raceId, m.horseA, m.horseB,
            m.closingTime, m.poolA, m.poolB,
            m.result, m.resolved, m.cancelled
        );
    }
}
