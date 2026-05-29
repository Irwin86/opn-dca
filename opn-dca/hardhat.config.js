require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    opn_testnet: {
      url: process.env.OPN_TESTNET_RPC || "https://testnet-rpc.opnchain.io",
      chainId: parseInt(process.env.OPN_CHAIN_ID || "9878"),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: {
      opn_testnet: process.env.OPN_EXPLORER_API_KEY || "placeholder",
    },
    customChains: [
      {
        network: "opn_testnet",
        chainId: parseInt(process.env.OPN_CHAIN_ID || "9878"),
        urls: {
          apiURL: process.env.OPN_EXPLORER_API || "https://testnet-explorer.opnchain.io/api",
          browserURL: process.env.OPN_EXPLORER_URL || "https://testnet-explorer.opnchain.io",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
