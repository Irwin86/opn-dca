import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { parseUnits, maxUint256, getAddress } from "viem";

const INTERVAL_1H = 3600n;
const AMOUNT_PER_SWAP = parseUnits("100", 6);
const INITIAL_DEPOSIT = parseUnits("1000", 6);
const FEE_BPS = 30n;
const KEEPER_BPS = 10n;

async function deployAll() {
  const connection = await hre.network.connect();
  const viem = connection.viem;
  const provider = connection.provider;

  const [owner, alice, bob, keeper] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const mockUsdc = await viem.deployContract("MockERC20", ["USD Coin", "USDC", 6]);
  const mockWeth = await viem.deployContract("MockERC20", ["Wrapped ETH", "WETH", 18]);
  const mockRouter = await viem.deployContract("MockRouter", []);

  const vault = await viem.deployContract("DCAVault", [
    mockRouter.address,
    FEE_BPS,
    KEEPER_BPS,
  ]);

  await mockUsdc.write.mint([alice.account.address, parseUnits("10000", 6)]);
  await mockUsdc.write.approve([vault.address, maxUint256], { account: alice.account });

  return { vault, mockUsdc, mockWeth, mockRouter, owner, alice, bob, keeper, publicClient, provider };
}

describe("DCAVault", async () => {

  describe("createPosition", async () => {
    it("creates a position with correct fields", async () => {
      const { vault, mockUsdc, mockWeth, alice } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, INITIAL_DEPOSIT],
        { account: alice.account }
      );
      const pos = await vault.read.positions([0n]);
      assert.equal(getAddress(pos[0]), getAddress(alice.account.address));
      assert.equal(getAddress(pos[1]), getAddress(mockUsdc.address));
      assert.equal(getAddress(pos[2]), getAddress(mockWeth.address));
      assert.equal(pos[3], AMOUNT_PER_SWAP);
      assert.equal(pos[4], INTERVAL_1H);
      assert.equal(pos[9], true);
      assert.equal(pos[6], INITIAL_DEPOSIT);
    });

    it("reverts when fromToken === toToken", async () => {
      const { vault, mockUsdc, alice } = await deployAll();
      try {
        await vault.write.createPosition(
          [mockUsdc.address, mockUsdc.address, AMOUNT_PER_SWAP, INTERVAL_1H, 0n],
          { account: alice.account }
        );
        assert.fail("Should have reverted");
      } catch (e) {
        assert.ok(e.message.includes("SameToken") || e.message.includes("revert"));
      }
    });

    it("reverts when interval < 60 seconds", async () => {
      const { vault, mockUsdc, mockWeth, alice } = await deployAll();
      try {
        await vault.write.createPosition(
          [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, 59n, 0n],
          { account: alice.account }
        );
        assert.fail("Should have reverted");
      } catch (e) {
        assert.ok(e.message.includes("InvalidInterval") || e.message.includes("revert"));
      }
    });

    it("reverts with zero amount per swap", async () => {
      const { vault, mockUsdc, mockWeth, alice } = await deployAll();
      try {
        await vault.write.createPosition(
          [mockUsdc.address, mockWeth.address, 0n, INTERVAL_1H, 0n],
          { account: alice.account }
        );
        assert.fail("Should have reverted");
      } catch (e) {
        assert.ok(e.message.includes("InvalidAmount") || e.message.includes("revert"));
      }
    });

    it("tracks position in userPositions", async () => {
      const { vault, mockUsdc, mockWeth, alice } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, 0n],
        { account: alice.account }
      );
      const ids = await vault.read.getUserPositions([alice.account.address]);
      assert.equal(ids.length, 1);
      assert.equal(ids[0], 0n);
    });
  });

  describe("deposit", async () => {
    it("increases totalDeposited", async () => {
      const { vault, mockUsdc, mockWeth, alice } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, 0n],
        { account: alice.account }
      );
      await vault.write.deposit([0n, INITIAL_DEPOSIT], { account: alice.account });
      const pos = await vault.read.positions([0n]);
      assert.equal(pos[6], INITIAL_DEPOSIT);
    });

    it("reverts if not position owner", async () => {
      const { vault, mockUsdc, mockWeth, alice, bob } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, 0n],
        { account: alice.account }
      );
      await mockUsdc.write.mint([bob.account.address, INITIAL_DEPOSIT]);
      await mockUsdc.write.approve([vault.address, maxUint256], { account: bob.account });
      try {
        await vault.write.deposit([0n, INITIAL_DEPOSIT], { account: bob.account });
        assert.fail("Should have reverted");
      } catch (e) {
        assert.ok(e.message.includes("NotPositionOwner") || e.message.includes("revert"));
      }
    });
  });

  describe("executeSwap", async () => {
    it("executes a swap after interval elapses", async () => {
      const { vault, mockUsdc, mockWeth, alice, keeper, provider } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, INITIAL_DEPOSIT],
        { account: alice.account }
      );
      await provider.send("evm_increaseTime", [3601]);
      await provider.send("evm_mine");
      await vault.write.executeSwap(
        [0n, 0n, [mockUsdc.address, mockWeth.address]],
        { account: keeper.account }
      );
      const pos = await vault.read.positions([0n]);
      assert.equal(pos[7], AMOUNT_PER_SWAP);
      assert.ok(pos[8] > 0n);
    });

    it("reverts before interval elapses", async () => {
      const { vault, mockUsdc, mockWeth, alice, keeper } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, INITIAL_DEPOSIT],
        { account: alice.account }
      );
      try {
        await vault.write.executeSwap(
          [0n, 0n, [mockUsdc.address, mockWeth.address]],
          { account: keeper.account }
        );
        assert.fail("Should have reverted");
      } catch (e) {
        assert.ok(e.message.includes("IntervalNotElapsed") || e.message.includes("revert"));
      }
    });

    it("isSwapDue returns correct values", async () => {
      const { vault, mockUsdc, mockWeth, alice, provider } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, 0n],
        { account: alice.account }
      );
      await vault.write.deposit([0n, INITIAL_DEPOSIT], { account: alice.account });
      await provider.send("evm_increaseTime", [3601]);
      await provider.send("evm_mine");
      assert.equal(await vault.read.isSwapDue([0n]), true);
    });
  });

  describe("closePosition", async () => {
    it("refunds remaining balance to owner", async () => {
      const { vault, mockUsdc, mockWeth, alice } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, INITIAL_DEPOSIT],
        { account: alice.account }
      );
      const balBefore = await mockUsdc.read.balanceOf([alice.account.address]);
      await vault.write.closePosition([0n], { account: alice.account });
      const balAfter = await mockUsdc.read.balanceOf([alice.account.address]);
      assert.equal(balAfter - balBefore, INITIAL_DEPOSIT);
    });

    it("marks position as inactive", async () => {
      const { vault, mockUsdc, mockWeth, alice } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, INITIAL_DEPOSIT],
        { account: alice.account }
      );
      await vault.write.closePosition([0n], { account: alice.account });
      const pos = await vault.read.positions([0n]);
      assert.equal(pos[9], false);
    });

    it("reverts if not owner", async () => {
      const { vault, mockUsdc, mockWeth, alice, bob } = await deployAll();
      await vault.write.createPosition(
        [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, INITIAL_DEPOSIT],
        { account: alice.account }
      );
      try {
        await vault.write.closePosition([0n], { account: bob.account });
        assert.fail("Should have reverted");
      } catch (e) {
        assert.ok(e.message.includes("NotPositionOwner") || e.message.includes("revert"));
      }
    });
  });

  describe("admin", async () => {
    it("owner can pause and unpause", async () => {
      const { vault, mockUsdc, mockWeth, alice, owner } = await deployAll();
      await vault.write.pause({ account: owner.account });
      try {
        await vault.write.createPosition(
          [mockUsdc.address, mockWeth.address, AMOUNT_PER_SWAP, INTERVAL_1H, 0n],
          { account: alice.account }
        );
        assert.fail("Should have reverted");
      } catch (e) {
        assert.ok(e.message.includes("EnforcedPause") || e.message.includes("revert"));
      }
      await vault.write.unpause({ account: owner.account });
    });
  });

});
