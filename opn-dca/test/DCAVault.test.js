const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DCAVault", function () {
  let vault, mockUsdc, mockWeth, mockRouter;
  let owner, alice, bob, keeper;

  const INTERVAL_1H = 3600;
  const AMOUNT_PER_SWAP = ethers.parseUnits("100", 6); // 100 USDC
  const INITIAL_DEPOSIT = ethers.parseUnits("1000", 6); // 1000 USDC
  const FEE_BPS = 30;       // 0.3%
  const KEEPER_BPS = 10;    // 0.1%

  beforeEach(async () => {
    [owner, alice, bob, keeper] = await ethers.getSigners();

    // Deploy mocks
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUsdc = await MockERC20.deploy("USD Coin", "USDC", 6);
    mockWeth = await MockERC20.deploy("Wrapped ETH", "WETH", 18);

    const MockRouter = await ethers.getContractFactory("MockRouter");
    mockRouter = await MockRouter.deploy();

    // Deploy vault
    const DCAVault = await ethers.getContractFactory("DCAVault");
    vault = await DCAVault.deploy(
      await mockRouter.getAddress(),
      FEE_BPS,
      KEEPER_BPS
    );

    // Fund alice
    await mockUsdc.mint(alice.address, ethers.parseUnits("10000", 6));
    await mockUsdc.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  // ─── Position Creation ────────────────────────────────────────────────────

  describe("createPosition", () => {
    it("creates a position with correct fields", async () => {
      await vault.connect(alice).createPosition(
        await mockUsdc.getAddress(),
        await mockWeth.getAddress(),
        AMOUNT_PER_SWAP,
        INTERVAL_1H,
        INITIAL_DEPOSIT
      );

      const pos = await vault.positions(0);
      expect(pos.owner).to.equal(alice.address);
      expect(pos.fromToken).to.equal(await mockUsdc.getAddress());
      expect(pos.toToken).to.equal(await mockWeth.getAddress());
      expect(pos.amountPerSwap).to.equal(AMOUNT_PER_SWAP);
      expect(pos.intervalSeconds).to.equal(INTERVAL_1H);
      expect(pos.active).to.be.true;
      expect(pos.totalDeposited).to.equal(INITIAL_DEPOSIT);
    });

    it("reverts when fromToken === toToken", async () => {
      await expect(
        vault.connect(alice).createPosition(
          await mockUsdc.getAddress(),
          await mockUsdc.getAddress(),
          AMOUNT_PER_SWAP,
          INTERVAL_1H,
          0
        )
      ).to.be.revertedWithCustomError(vault, "SameToken");
    });

    it("reverts when interval < 60 seconds", async () => {
      await expect(
        vault.connect(alice).createPosition(
          await mockUsdc.getAddress(),
          await mockWeth.getAddress(),
          AMOUNT_PER_SWAP,
          59,
          0
        )
      ).to.be.revertedWithCustomError(vault, "InvalidInterval");
    });

    it("reverts with zero amount per swap", async () => {
      await expect(
        vault.connect(alice).createPosition(
          await mockUsdc.getAddress(),
          await mockWeth.getAddress(),
          0,
          INTERVAL_1H,
          0
        )
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("tracks position in userPositions", async () => {
      await vault.connect(alice).createPosition(
        await mockUsdc.getAddress(),
        await mockWeth.getAddress(),
        AMOUNT_PER_SWAP,
        INTERVAL_1H,
        0
      );
      const ids = await vault.getUserPositions(alice.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(0);
    });
  });

  // ─── Deposits ─────────────────────────────────────────────────────────────

  describe("deposit", () => {
    beforeEach(async () => {
      await vault.connect(alice).createPosition(
        await mockUsdc.getAddress(),
        await mockWeth.getAddress(),
        AMOUNT_PER_SWAP,
        INTERVAL_1H,
        0
      );
    });

    it("increases totalDeposited", async () => {
      await vault.connect(alice).deposit(0, INITIAL_DEPOSIT);
      const pos = await vault.positions(0);
      expect(pos.totalDeposited).to.equal(INITIAL_DEPOSIT);
    });

    it("reverts if not position owner", async () => {
      await expect(
        vault.connect(bob).deposit(0, INITIAL_DEPOSIT)
      ).to.be.revertedWithCustomError(vault, "NotPositionOwner");
    });
  });

  // ─── Swap Execution ───────────────────────────────────────────────────────

  describe("executeSwap", () => {
    let path;

    beforeEach(async () => {
      path = [await mockUsdc.getAddress(), await mockWeth.getAddress()];

      await vault.connect(alice).createPosition(
        await mockUsdc.getAddress(),
        await mockWeth.getAddress(),
        AMOUNT_PER_SWAP,
        INTERVAL_1H,
        INITIAL_DEPOSIT
      );
    });

    it("executes a swap after interval elapses", async () => {
      await time.increase(INTERVAL_1H);

      await expect(
        vault.connect(keeper).executeSwap(0, 0, path)
      ).to.emit(vault, "SwapExecuted");

      const pos = await vault.positions(0);
      expect(pos.totalSpent).to.equal(AMOUNT_PER_SWAP);
      expect(pos.totalReceived).to.be.gt(0);
    });

    it("reverts before interval elapses", async () => {
      await expect(
        vault.connect(keeper).executeSwap(0, 0, path)
      ).to.be.revertedWithCustomError(vault, "IntervalNotElapsed");
    });

    it("pays keeper reward", async () => {
      await time.increase(INTERVAL_1H);

      const keeperBefore = await mockUsdc.balanceOf(keeper.address);
      await vault.connect(keeper).executeSwap(0, 0, path);
      const keeperAfter = await mockUsdc.balanceOf(keeper.address);

      const expectedReward = (AMOUNT_PER_SWAP * BigInt(KEEPER_BPS)) / 10_000n;
      expect(keeperAfter - keeperBefore).to.equal(expectedReward);
    });

    it("accrues protocol fees", async () => {
      await time.increase(INTERVAL_1H);
      await vault.connect(keeper).executeSwap(0, 0, path);

      const fee = await vault.accruedFees(await mockUsdc.getAddress());
      const expectedFee = (AMOUNT_PER_SWAP * BigInt(FEE_BPS)) / 10_000n;
      expect(fee).to.equal(expectedFee);
    });

    it("reverts when balance too low", async () => {
      // Close and reopen with tiny deposit
      await vault.connect(alice).closePosition(0);
      const small = ethers.parseUnits("50", 6); // less than 100 USDC per swap
      await mockUsdc.connect(alice).approve(await vault.getAddress(), ethers.MaxUint256);
      await vault.connect(alice).createPosition(
        await mockUsdc.getAddress(),
        await mockWeth.getAddress(),
        AMOUNT_PER_SWAP,
        INTERVAL_1H,
        small
      );
      await time.increase(INTERVAL_1H);
      await expect(
        vault.connect(keeper).executeSwap(1, 0, path)
      ).to.be.revertedWithCustomError(vault, "InsufficientBalance");
    });

    it("isSwapDue returns correct values", async () => {
      expect(await vault.isSwapDue(0)).to.be.false;
      await time.increase(INTERVAL_1H);
      expect(await vault.isSwapDue(0)).to.be.true;
    });
  });

  // ─── Close Position ───────────────────────────────────────────────────────

  describe("closePosition", () => {
    beforeEach(async () => {
      await vault.connect(alice).createPosition(
        await mockUsdc.getAddress(),
        await mockWeth.getAddress(),
        AMOUNT_PER_SWAP,
        INTERVAL_1H,
        INITIAL_DEPOSIT
      );
    });

    it("refunds remaining balance to owner", async () => {
      const balBefore = await mockUsdc.balanceOf(alice.address);
      await vault.connect(alice).closePosition(0);
      const balAfter = await mockUsdc.balanceOf(alice.address);
      expect(balAfter - balBefore).to.equal(INITIAL_DEPOSIT);
    });

    it("marks position as inactive", async () => {
      await vault.connect(alice).closePosition(0);
      const pos = await vault.positions(0);
      expect(pos.active).to.be.false;
    });

    it("reverts if not owner", async () => {
      await expect(
        vault.connect(bob).closePosition(0)
      ).to.be.revertedWithCustomError(vault, "NotPositionOwner");
    });
  });

  // ─── Admin ────────────────────────────────────────────────────────────────

  describe("admin", () => {
    it("owner can withdraw fees", async () => {
      const path = [await mockUsdc.getAddress(), await mockWeth.getAddress()];

      await vault.connect(alice).createPosition(
        await mockUsdc.getAddress(),
        await mockWeth.getAddress(),
        AMOUNT_PER_SWAP,
        INTERVAL_1H,
        INITIAL_DEPOSIT
      );
      await time.increase(INTERVAL_1H);
      await vault.connect(keeper).executeSwap(0, 0, path);

      const feeBefore = await mockUsdc.balanceOf(owner.address);
      await vault.connect(owner).withdrawFees(await mockUsdc.getAddress());
      const feeAfter = await mockUsdc.balanceOf(owner.address);
      expect(feeAfter).to.be.gt(feeBefore);
    });

    it("non-owner cannot withdraw fees", async () => {
      await expect(
        vault.connect(alice).withdrawFees(await mockUsdc.getAddress())
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("owner can pause and unpause", async () => {
      await vault.connect(owner).pause();
      await expect(
        vault.connect(alice).createPosition(
          await mockUsdc.getAddress(),
          await mockWeth.getAddress(),
          AMOUNT_PER_SWAP,
          INTERVAL_1H,
          0
        )
      ).to.be.revertedWithCustomError(vault, "EnforcedPause");

      await vault.connect(owner).unpause();
    });
  });
});
