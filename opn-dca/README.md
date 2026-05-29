# ◈ OPN-DCA — Automated DCA Vault on OPN Chain

> **Permissionless, non-custodial Dollar-Cost Averaging — fully on-chain.**  
> Built for [IOPn Builders Programme](https://builders.iopn.tech) · Season 1 · DeFi & Open Finance

[![OPN Chain](https://img.shields.io/badge/OPN%20Chain-Testnet-00e5ff?style=flat-square)](https://testnet-explorer.opnchain.io)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=flat-square&logo=solidity)](https://soliditylang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## 🧠 What is OPN-DCA?

OPN-DCA is a fully on-chain Dollar-Cost Averaging vault deployed on OPN Chain. Users deposit any ERC-20 token and configure a recurring swap — the vault automatically converts a fixed amount into a target token at each interval.

**No off-chain bots. No custodians. No trust required.**

The contract itself enforces the schedule. Anyone can trigger a pending swap and earn a small keeper reward, creating a self-sustaining, decentralized execution layer.

---

## ✨ Features

- **Non-custodial** — funds stay in the vault contract, locked to each user's position
- **Permissionless keeper model** — any wallet can execute a due swap and earn a reward
- **Any ERC-20 pair** — works with any token pair available on a Uniswap V2-compatible DEX on OPN Chain
- **Flexible intervals** — hourly, daily, weekly, or any custom interval ≥ 60 seconds
- **Slippage protection** — configurable `minAmountOut` per execution
- **Protocol fee** — 0.3% of each swap, accrued in the vault and withdrawable by owner
- **Emergency pause** — owner can pause all new positions and swaps if needed

---

## 🏗️ Architecture

```
contracts/
├── DCAVault.sol          # Core vault — positions, deposits, swap execution
└── mocks/
    ├── MockERC20.sol     # Mintable ERC20 for testing
    └── MockRouter.sol    # Uniswap V2-compatible router mock

frontend/
├── src/
│   ├── App.jsx           # Root app + wallet connection
│   ├── config.js         # OPN Chain wagmi config
│   ├── abi.js            # Contract ABI
│   └── components/
│       ├── CreatePosition.jsx   # Position creation form
│       └── PositionList.jsx     # User's active positions + execution
```

### How a DCA Swap Works

```
User deposits USDC into vault
       │
       ▼
Position stores: fromToken, toToken, amountPerSwap, interval
       │
       ▼
Interval elapses (e.g. 24h)
       │
       ▼
Keeper calls executeSwap()
       ├─ 0.1% → keeper reward
       ├─ 0.3% → protocol fee
       └─ 99.6% → DEX swap → toToken sent directly to user's wallet
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18
- A wallet with OPN Chain Testnet gas

### 1. Clone & Install

```bash
git clone https://github.com/Irwin86/opn-dca.git
cd opn-dca
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in: PRIVATE_KEY, OPN_TESTNET_RPC, OPN_CHAIN_ID
```

### 3. Compile contracts

```bash
npx hardhat compile
```

### 4. Run tests

```bash
npx hardhat test
```

### 5. Deploy to OPN Chain Testnet

```bash
npx hardhat run scripts/deploy.js --network opn_testnet
```

Copy the deployed `DCAVault` address and add it to `frontend/.env`:

```bash
VITE_DCA_VAULT_ADDRESS=0x...your_deployed_address
```

### 6. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔗 OPN Chain Testnet

| Parameter | Value |
|---|---|
| Chain ID | 9878 |
| RPC | https://testnet-rpc.opnchain.io |
| Explorer | https://testnet-explorer.opnchain.io |
| Currency | OPN |

Add to MetaMask: Network Name `OPN Chain Testnet`, RPC URL above, Chain ID `9878`, Symbol `OPN`.

---

## 📐 Smart Contract — Key Functions

### User-facing

| Function | Description |
|---|---|
| `createPosition(fromToken, toToken, amountPerSwap, interval, initialDeposit)` | Create a new DCA position |
| `deposit(positionId, amount)` | Top up a position's balance |
| `closePosition(positionId)` | Close position and refund remaining balance |

### Keeper

| Function | Description |
|---|---|
| `executeSwap(positionId, minAmountOut, path)` | Execute a due swap, earn keeper reward |
| `isSwapDue(positionId)` | Check if a position is ready to execute |

---

## 🛡️ Security Notes

- Reentrancy protection via OpenZeppelin `ReentrancyGuard`
- All external calls follow checks-effects-interactions pattern
- `SafeERC20` used for all token transfers
- Custom error types for gas-efficient reverts
- Emergency pause mechanism for owner

> ⚠️ This is a testnet build for the IOPn Builders Programme. It has not been audited. Do not use with real funds.

---

## 🗺️ Roadmap

- [ ] **S1** — Testnet deployment, keeper UI, basic DCA vault *(current)*
- [ ] **S2** — Integrate with OPN Chain identity (link to Season 2 theme)
- [ ] **S3** — Support RWA token pairs as DCA targets
- [ ] **Mainnet** — Full audit + mainnet deployment on OPN Chain

---

## 👤 Author

Built by [@Irwin86](https://github.com/Irwin86) for the **IOPn Builders Programme — Season 1**.

- 🔗 Submission: [builders.iopn.tech](https://builders.iopn.tech)
- 📦 Repo: [github.com/Irwin86/opn-dca](https://github.com/Irwin86/opn-dca)

---

## 📄 License

MIT
