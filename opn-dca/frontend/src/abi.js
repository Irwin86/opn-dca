export const DCA_VAULT_ABI = [
  // Read
  "function positions(uint256) view returns (address owner, address fromToken, address toToken, uint256 amountPerSwap, uint256 intervalSeconds, uint256 lastSwapAt, uint256 totalDeposited, uint256 totalSpent, uint256 totalReceived, bool active)",
  "function getUserPositions(address user) view returns (uint256[])",
  "function positionBalance(uint256 positionId) view returns (uint256)",
  "function isSwapDue(uint256 positionId) view returns (bool)",
  "function nextSwapAt(uint256 positionId) view returns (uint256)",
  "function feeBps() view returns (uint256)",
  "function keeperRewardBps() view returns (uint256)",
  "function nextPositionId() view returns (uint256)",

  // Write
  "function createPosition(address fromToken, address toToken, uint256 amountPerSwap, uint256 intervalSeconds, uint256 initialDeposit) returns (uint256 positionId)",
  "function deposit(uint256 positionId, uint256 amount)",
  "function closePosition(uint256 positionId)",
  "function executeSwap(uint256 positionId, uint256 minAmountOut, address[] calldata path)",

  // Events
  "event PositionCreated(uint256 indexed positionId, address indexed owner, address fromToken, address toToken, uint256 amountPerSwap, uint256 intervalSeconds)",
  "event SwapExecuted(uint256 indexed positionId, address indexed keeper, uint256 fromAmount, uint256 toAmount, uint256 keeperReward)",
  "event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 refunded)",
  "event Deposited(uint256 indexed positionId, address indexed owner, uint256 amount)",
];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];
