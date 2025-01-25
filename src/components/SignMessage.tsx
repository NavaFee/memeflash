import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { useEffect } from "react";
import dynamic from "next/dynamic";

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

export default function SignMessage() {
  const wallet = useWallet();

  return <div className="flex flex-row justify-center"></div>;
}
