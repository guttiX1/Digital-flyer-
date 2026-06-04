const { expect } = require("chai");
const hre = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { ethers } = hre;

const USDC_DECIMALS = 6n;
const USDC = (n) => BigInt(n) * 10n ** USDC_DECIMALS;

describe("HorseRaceMarket", function () {
  let owner, alice, bob, carol;
  let usdc, market, registry;
  let closingTime;

  beforeEach(async function () {
    [owner, alice, bob, carol] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const HorseRaceMarket = await ethers.getContractFactory("HorseRaceMarket");
    market = await HorseRaceMarket.deploy(await usdc.getAddress());

    const CuadraRegistry = await ethers.getContractFactory("CuadraRegistry");
    registry = await CuadraRegistry.deploy();

    await usdc.connect(alice).faucet(USDC(1000));
    await usdc.connect(bob).faucet(USDC(1000));
    await usdc.connect(carol).faucet(USDC(1000));

    const marketAddr = await market.getAddress();
    await usdc.connect(alice).approve(marketAddr, ethers.MaxUint256);
    await usdc.connect(bob).approve(marketAddr, ethers.MaxUint256);
    await usdc.connect(carol).approve(marketAddr, ethers.MaxUint256);

    closingTime = (await time.latest()) + 3600;
  });

  // ── CuadraRegistry ────────────────────────────────────────────────────────

  describe("CuadraRegistry", function () {
    it("lets anyone register a cuadra name", async function () {
      await registry.connect(alice).registerCuadra("Los Alazanes");
      expect(await registry.cuadraOf(alice.address)).to.equal("Los Alazanes");
      expect(await registry.ownerOfCuadra("Los Alazanes")).to.equal(alice.address);
    });

    it("prevents duplicate names", async function () {
      await registry.connect(alice).registerCuadra("El Palomar");
      await expect(
        registry.connect(bob).registerCuadra("El Palomar")
      ).to.be.revertedWith("name already taken");
    });

    it("prevents registering twice from same wallet", async function () {
      await registry.connect(alice).registerCuadra("La Tropicana");
      await expect(
        registry.connect(alice).registerCuadra("La Bonita")
      ).to.be.revertedWith("already registered");
    });

    it("allows updating cuadra name", async function () {
      await registry.connect(alice).registerCuadra("Viejo Nombre");
      await registry.connect(alice).updateCuadra("Nuevo Nombre");
      expect(await registry.cuadraOf(alice.address)).to.equal("Nuevo Nombre");
      expect(await registry.ownerOfCuadra("Viejo Nombre")).to.equal(ethers.ZeroAddress);
    });

    it("rejects short names", async function () {
      await expect(registry.connect(alice).registerCuadra("X")).to.be.revertedWith(
        "name must be 2-32 chars"
      );
    });
  });

  // ── Market creation ───────────────────────────────────────────────────────

  describe("createMarket", function () {
    it("creates a market and emits event", async function () {
      await expect(
        market.createMarket("GP2025-R1", "Relampago", "Tornado", closingTime)
      )
        .to.emit(market, "MarketCreated")
        .withArgs(0n, "GP2025-R1", "Relampago", "Tornado", closingTime);

      expect(await market.marketCount()).to.equal(1n);
    });

    it("reverts if closing time is in the past", async function () {
      const past = (await time.latest()) - 1;
      await expect(
        market.createMarket("R1", "A", "B", past)
      ).to.be.revertedWith("closing time in the past");
    });

    it("only owner can create markets", async function () {
      await expect(
        market.connect(alice).createMarket("R1", "A", "B", closingTime)
      ).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
    });
  });

  // ── Buying shares ─────────────────────────────────────────────────────────

  describe("buyShares", function () {
    beforeEach(async function () {
      await market.createMarket("GP2025-R1", "Relampago", "Tornado", closingTime);
    });

    it("takes 2% fee and credits net shares", async function () {
      const gross = USDC(100);
      const fee = gross * 200n / 10000n;
      const net = gross - fee;

      const ownerBefore = await usdc.balanceOf(owner.address);
      await market.connect(alice).buyShares(0, 1, gross);
      const ownerAfter = await usdc.balanceOf(owner.address);

      expect(ownerAfter - ownerBefore).to.equal(fee);

      const [,,,, poolA] = await market.getMarket(0);
      expect(poolA).to.equal(net);
    });

    it("reverts after closing time", async function () {
      await time.increaseTo(closingTime + 1);
      await expect(
        market.connect(alice).buyShares(0, 1, USDC(10))
      ).to.be.revertedWith("betting closed");
    });

    it("reverts on invalid outcome", async function () {
      await expect(
        market.connect(alice).buyShares(0, 3, USDC(10))
      ).to.be.revertedWith("invalid outcome");
    });
  });

  // ── Resolution & claiming ─────────────────────────────────────────────────

  describe("resolveMarket + claimWinnings", function () {
    beforeEach(async function () {
      await market.createMarket("GP2025-R1", "Relampago", "Tornado", closingTime);
      await market.connect(alice).buyShares(0, 1, USDC(100));
      await market.connect(bob).buyShares(0, 2, USDC(200));
    });

    it("resolves market and pays out winners correctly", async function () {
      await market.resolveMarket(0, 1); // Horse A wins

      const net100 = USDC(100) - USDC(100) * 200n / 10000n;
      const net200 = USDC(200) - USDC(200) * 200n / 10000n;
      const totalPool = net100 + net200;

      const aliceBefore = await usdc.balanceOf(alice.address);
      await market.connect(alice).claimWinnings(0);
      const aliceAfter = await usdc.balanceOf(alice.address);

      expect(aliceAfter - aliceBefore).to.equal(totalPool);
    });

    it("splits pool proportionally among multiple winners", async function () {
      await market.connect(carol).buyShares(0, 1, USDC(100));
      await market.resolveMarket(0, 1); // Horse A wins

      const [,,,, poolA, poolB] = await market.getMarket(0);
      const totalPool = poolA + poolB;

      const alicePending = await market.pendingPayout(0, alice.address);
      const carolPending = await market.pendingPayout(0, carol.address);

      expect(alicePending).to.equal(carolPending);
      expect(alicePending + carolPending).to.equal(totalPool);
    });

    it("prevents double-claiming", async function () {
      await market.resolveMarket(0, 1);
      await market.connect(alice).claimWinnings(0);
      await expect(market.connect(alice).claimWinnings(0)).to.be.revertedWith(
        "already claimed"
      );
    });

    it("only owner can resolve", async function () {
      await expect(
        market.connect(alice).resolveMarket(0, 1)
      ).to.be.revertedWithCustomError(market, "OwnableUnauthorizedAccount");
    });
  });

  // ── Cancellation & refunds ────────────────────────────────────────────────

  describe("cancelMarket + claimRefund", function () {
    beforeEach(async function () {
      await market.createMarket("GP2025-R2", "Rayo", "Brisa", closingTime);
      await market.connect(alice).buyShares(0, 1, USDC(100));
      await market.connect(bob).buyShares(0, 2, USDC(50));
    });

    it("refunds net deposits on cancellation", async function () {
      await market.cancelMarket(0);

      const net100 = USDC(100) - USDC(100) * 200n / 10000n;

      const aliceBefore = await usdc.balanceOf(alice.address);
      await market.connect(alice).claimRefund(0);
      const aliceAfter = await usdc.balanceOf(alice.address);

      expect(aliceAfter - aliceBefore).to.equal(net100);
    });

    it("cannot buy shares on cancelled market", async function () {
      await market.cancelMarket(0);
      await expect(
        market.connect(carol).buyShares(0, 1, USDC(10))
      ).to.be.revertedWith("market not active");
    });
  });

  // ── Odds view ─────────────────────────────────────────────────────────────

  describe("getOdds", function () {
    it("returns 50/50 before any bets", async function () {
      await market.createMarket("GP2025-R3", "X", "Y", closingTime);
      const [oddsA, oddsB] = await market.getOdds(0);
      expect(oddsA).to.equal(5000n);
      expect(oddsB).to.equal(5000n);
    });

    it("updates odds as bets come in", async function () {
      await market.createMarket("GP2025-R3", "X", "Y", closingTime);
      await market.connect(alice).buyShares(0, 1, USDC(300));
      await market.connect(bob).buyShares(0, 2, USDC(100));

      const [oddsA, oddsB] = await market.getOdds(0);
      expect(oddsA + oddsB).to.equal(10000n);
      expect(oddsA).to.be.greaterThan(oddsB);
    });
  });
});
