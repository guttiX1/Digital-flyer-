const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;

  console.log(`\n=== Horse Racing Prediction Market Deployment ===`);
  console.log(`Network  : ${network}`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC\n`);

  // ── 1. USDC ──────────────────────────────────────────────────────────────
  let usdcAddress = process.env.USDC_ADDRESS;

  if (!usdcAddress || network === "hardhat" || network === "localhost") {
    console.log("Deploying MockUSDC...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log(`MockUSDC deployed  : ${usdcAddress}`);
  } else {
    console.log(`Using existing USDC: ${usdcAddress}`);
  }

  // ── 2. CuadraRegistry ────────────────────────────────────────────────────
  console.log("\nDeploying CuadraRegistry...");
  const CuadraRegistry = await ethers.getContractFactory("CuadraRegistry");
  const registry = await CuadraRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`CuadraRegistry     : ${registryAddress}`);

  // ── 3. HorseRaceMarket ───────────────────────────────────────────────────
  console.log("\nDeploying HorseRaceMarket...");
  const HorseRaceMarket = await ethers.getContractFactory("HorseRaceMarket");
  const market = await HorseRaceMarket.deploy(usdcAddress);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log(`HorseRaceMarket    : ${marketAddress}`);

  // ── 4. Summary ───────────────────────────────────────────────────────────
  console.log("\n========================================");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("========================================");
  console.log(`  Network         : ${network}`);
  console.log(`  USDC            : ${usdcAddress}`);
  console.log(`  CuadraRegistry  : ${registryAddress}`);
  console.log(`  HorseRaceMarket : ${marketAddress}`);
  console.log("========================================\n");

  if (network === "amoy") {
    console.log("Verify contracts on PolygonScan:");
    console.log(`  npx hardhat verify --network amoy ${registryAddress}`);
    console.log(`  npx hardhat verify --network amoy ${marketAddress} ${usdcAddress}\n`);
  }

  return { usdcAddress, registryAddress, marketAddress };
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
