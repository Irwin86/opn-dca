import hre from "hardhat";

async function main() {
  const connection = await hre.network.connect("opn_testnet");
  const viem = connection.viem;

  const [deployer] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const balance = await publicClient.getBalance({ address: deployer.account.address });

  console.log("─────────────────────────────────────────");
  console.log("  OPN-DCA Vault Deployment");
  console.log("─────────────────────────────────────────");
  console.log("Deployer  :", deployer.account.address);
  console.log("Network   :", hre.network.name);
  console.log("Balance   :", balance.toString(), "wei");
  console.log("");

  // Deploy MockRouter first (no real DEX on testnet yet)
  console.log("Deploying MockRouter...");
  const mockRouter = await viem.deployContract("MockRouter", []);
  console.log("MockRouter deployed to:", mockRouter.address);

  // Deploy DCAVault
  const FEE_BPS = 30n;
  const KEEPER_BPS = 10n;

  console.log("Deploying DCAVault...");
  const vault = await viem.deployContract("DCAVault", [
    mockRouter.address,
    FEE_BPS,
    KEEPER_BPS,
  ]);

  console.log("");
  console.log("✅ DCAVault deployed to:", vault.address);
  console.log("");
  console.log("─────────────────────────────────────────");
  console.log("  Next steps:");
  console.log("  1. Set VITE_DCA_VAULT_ADDRESS=" + vault.address + " in frontend/.env");
  console.log("  2. Copy contract address to IOPn submission form");
  console.log("─────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});