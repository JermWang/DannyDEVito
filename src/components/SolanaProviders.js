"use client";

import { useMemo } from "react";

import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

function getNetwork() {
  const raw = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;

  if (raw === "devnet") return WalletAdapterNetwork.Devnet;
  if (raw === "testnet") return WalletAdapterNetwork.Testnet;

  return WalletAdapterNetwork.Mainnet;
}

export default function SolanaProviders({ children }) {
  const network = getNetwork();

  const endpoint = useMemo(() => {
    return (
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      clusterApiUrl(
        network === WalletAdapterNetwork.Devnet
          ? "devnet"
          : network === WalletAdapterNetwork.Testnet
            ? "testnet"
            : "mainnet-beta",
      )
    );
  }, [network]);

  const wallets = useMemo(() => {
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
    ];
  }, [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
