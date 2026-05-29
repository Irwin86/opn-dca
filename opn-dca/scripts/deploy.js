const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("─────────────────────────────────────────");
  console.log("  OPN-DCA Vault Deployment");
  console.log("─────────────────────────────────────────");
  console.log("Deployer  :", deployer.address);
  console.log("Network   :", hre.network.name);
  console.log("Balance   :", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "OPN");
  console.log("");

  // ── Config ──────────────────────────────────────────────────────────────
  // Update ROUTER_ADDRESS once a DEX is live on OPN Chain testnet.
  // For initial testnet, deploy a MockRouter and use its address.
  const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS || "0x0000000000000000000000000000000000000001";
  const FEE_BPS = 30;       // 0.3% protocol fee
  const KEEPER_BPS = 10;    // 0.1% keeper reward

  // ── Deploy MockRouter (testnet only) ────────────────────────────────────
  let routerAddress = ROUTER_ADDRESS;
  if (hre.network.name === "opn_testnet" && ROUTER_ADDRESS.startsWith("0x000000")) {
    console.log("No router set — deploying MockRouter for testnet...");
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();
    routerAddress = await mockRouter.getAddress();
    console.log("MockRouter deployed to:", routerAddress);
  }

  // ── Deploy DCAVault ─────────────────────────────────────────────────────
  console.log("Deploying DCAVault...");
  const DCAVault = await ethers.getContractFactory("DCAVault");
  const vault = await DCAVault.deploy(routerAddress, FEE_BPS, KEEPER_BPS);
  await vault.waitForDeployment();

  const vaultAddress = await vault.getAddress();
  console.log("");
  console.log("✅ DCAVault deployed to:", vaultAddress);
  console.log("");
  console.log("─────────────────────────────────────────");
  console.log("  Next steps:");
  console.log("  1. Set VITE_DCA_VAULT_ADDRESS=" + vaultAddress + " in frontend/.env");
  console.log("  2. Verify: npx hardhat verify --network opn_testnet", vaultAddress, routerAddress, FEE_BPS, KEEPER_BPS);
  console.log("─────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
