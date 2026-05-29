import { defineChain } from "viem";
import { createConfig, http } from "wagmi";
import { injected, metaMask } from "@wagmi/connectors";

export const opnTestnet = defineChain({
  id: parseInt(import.meta.env.VITE_OPN_CHAIN_ID || "9878"),
  name: "OPN Chain Testnet",
  nativeCurrency: { name: "OPN", symbol: "OPN", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_OPN_TESTNET_RPC || "https://testnet-rpc.opnchain.io"] },
  },
  blockExplorers: {
    default: { name: "OPN Explorer", url: "https://testnet-explorer.opnchain.io" },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [opnTestnet],
  connectors: [injected(), metaMask()],
  transports: {
    [opnTestnet.id]: http(),
  },
});

export const DCA_VAULT_ADDRESS = import.meta.env.VITE_DCA_VAULT_ADDRESS;
