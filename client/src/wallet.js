import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";

import {
  injected,
  walletConnect,
} from "wagmi/connectors";

export const config = createConfig({
  chains: [sepolia],

  connectors: [
    // 1️ MetaMask (if installed)
    injected({
      target: "metaMask",
      shimDisconnect: true,
    }),

    // 3️ WalletConnect → Fallback for  MetaMask 
    walletConnect({
      projectId: "dfebac4891aed0e4b56bba6dc6a3417c",
      showQrModal: true,          // auto QR
      metadata: {
        name: "BookStore dApp",
        description: "WalletConnect fallback",
        url: "https://your-dapp.com",
        icons: ["https://avatars.githubusercontent.com/u/37784886"],
      }
    }),
  ],

  transports: {
    [sepolia.id]: http("https://ethereum-sepolia.publicnode.com"),
  },

  ssr: false,
});




