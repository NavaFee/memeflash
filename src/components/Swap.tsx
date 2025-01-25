import { useEffect, useState } from "react";
const axios = require("axios");
import { VersionedTransaction, Connection } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import web3 from "@solana/web3.js";
import {
  SystemProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// 添加 getTokenInfo 函数
const { getAssociatedTokenAddress } = require("@solana/spl-token");

async function getTokenInfo(userAddress: string, tokenAddress: string) {
  const response = await fetch(
    "https://mainnet.helius-rpc.com/?api-key=53e5ea17-598d-47a7-a11d-9d02bc3d678e",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "test",
        method: "getAsset",
        params: {
          id: tokenAddress,
        },
      }),
    }
  );
  const data = await response.json();

  // 检查 data.result 是否存在
  if (!data.result || !data.result.token_info) {
    throw new Error("无法获取代币信息");
  }

  const symbol = data.result.token_info.symbol || "unknown";
  const programId = data.result.token_info.token_program || "unknown";

  const ata = await getAssociatedTokenAddress(
    new PublicKey(tokenAddress),
    new PublicKey(userAddress),
    false,
    new PublicKey(programId)
  );

  const balanceInfo = await connection.getTokenAccountBalance(
    new PublicKey(ata.toString())
  );
  const balance = balanceInfo.value.uiAmount || 0;
  const decimals = data.result.token_info.decimals || 0;

  return {
    balance: balance.toString(),
    symbol: symbol,
    decimals: decimals,
  };
}

const LAMPORTS_PER_SOL = 1000000000;
const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);

const connection = new Connection(
  "https://mainnet.helius-rpc.com/?api-key=53e5ea17-598d-47a7-a11d-9d02bc3d678e"
);

export default function Swap() {
  const wallet: any = useWallet();
  const [solPercent, setSolPercent] = useState(0);
  const [tokenAddress, setTokenAddress] = useState("");
  const [load, setLoad] = useState(false);
  const [quoted, setQuoted]: any = useState(0);
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState(0);
  const [isBuying, setIsBuying] = useState(true);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [decimals, setDecimals] = useState(0);

  // 使用 useEffect 在客户端获取 URL 参数
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const initialTokenAddress = urlParams.get("token") || "";
    setTokenAddress(initialTokenAddress);
  }, []);

  useEffect(() => {
    if (wallet.connected) {
      const fetchBalance = async () => {
        if (isBuying) {
          const balance = await connection.getBalance(wallet.publicKey);
          setBalance(balance / LAMPORTS_PER_SOL);
        } else {
          console.log(wallet.publicKey.toString());
          const tokenInfo = await getTokenInfo(
            wallet.publicKey.toString(),
            tokenAddress
          );
          setBalance(parseFloat(tokenInfo.balance));
          setTokenSymbol(tokenInfo.symbol);
          setDecimals(tokenInfo.decimals);
        }
      };
      fetchBalance();
    }
  }, [wallet.connected, isBuying, tokenAddress]);

  async function swap(quote: any) {
    if (!wallet.connected) {
      toast.error("钱包未连接");
      return;
    }

    if (solPercent <= 0) {
      toast.error("请输入有效的数量");
      return;
    }

    try {
      const amount = isBuying
        ? Math.round(solPercent * LAMPORTS_PER_SOL)
        : Math.round(solPercent * 10 ** decimals);

      const transaction = await constructTransaction({
        inputMint: isBuying
          ? "So11111111111111111111111111111111111111112"
          : tokenAddress,
        outputMint: isBuying
          ? tokenAddress
          : "So11111111111111111111111111111111111111112",
        amount: amount,
        slippageBps: 1000,
        recipientAddress: wallet.publicKey.toString(),
        includeFee: true,
      });

      await signAndSendTransaction(transaction);
    } catch (error) {
      toast.error("交易失败，请重试");
    }
  }

  async function constructTransaction({
    inputMint,
    outputMint,
    amount,
    slippageBps,
    recipientAddress,
    includeFee = false,
  }: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps: number;
    recipientAddress: string;
    includeFee?: boolean;
  }) {
    const quoteResponse = await (
      await fetch(
        `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
      )
    ).json();

    if (quoteResponse.error) {
      throw new Error("Failed to get quote: " + quoteResponse.error);
    }

    const instructions = await (
      await fetch("https://quote-api.jup.ag/v6/swap-instructions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quoteResponse,
          userPublicKey: wallet.publicKey.toString(),
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      })
    ).json();

    if (instructions.error) {
      throw new Error("Failed to get swap instructions: " + instructions.error);
    }

    const {
      computeBudgetInstructions,
      setupInstructions,
      swapInstruction: swapInstructionPayload,
      cleanupInstruction,
      addressLookupTableAddresses,
    } = instructions;

    const addressLookupTableAccounts = await getAddressLookupTableAccounts(
      addressLookupTableAddresses
    );

    const blockhash = (await connection.getLatestBlockhash()).blockhash;
    const messageV0 = new TransactionMessage({
      payerKey: wallet.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        ...computeBudgetInstructions.map(deserializeInstruction),
        ...setupInstructions.map(deserializeInstruction),
        deserializeInstruction(swapInstructionPayload),
        deserializeInstruction(cleanupInstruction),
        ...(includeFee
          ? [
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: new PublicKey(recipientAddress),
                lamports: 0.001 * LAMPORTS_PER_SOL,
              }),
            ]
          : []),
      ],
    }).compileToV0Message(addressLookupTableAccounts);

    return new VersionedTransaction(messageV0);
  }

  async function signAndSendTransaction(transaction: VersionedTransaction) {
    try {
      const signedTX = await wallet.signTransaction(transaction);
      const rawTransaction = signedTX.serialize();
      const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });
      await connection.confirmTransaction(txid, "confirmed");
      toast.success(
        <div>
          交易成功:{" "}
          <a
            href={`https://solscan.io/tx/${txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            查看交易
          </a>
        </div>
      );
    } catch (error) {
      toast.error("授权被拒绝或交易失败");
    }
  }

  const deserializeInstruction = (instruction: any) => {
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key: any) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, "base64"),
    });
  };

  const getAddressLookupTableAccounts = async (keys: string[]) => {
    const addressLookupTableAccountInfos =
      await connection.getMultipleAccountsInfo(
        keys.map((key) => new PublicKey(key))
      );

    return addressLookupTableAccountInfos.reduce<AddressLookupTableAccount[]>(
      (acc, accountInfo, index) => {
        const addressLookupTableAddress = keys[index];
        if (accountInfo) {
          const addressLookupTableAccount = new AddressLookupTableAccount({
            key: new PublicKey(addressLookupTableAddress),
            state: AddressLookupTableAccount.deserialize(accountInfo.data),
          });
          acc.push(addressLookupTableAccount);
        }

        return acc;
      },
      []
    );
  };

  // useEffect(() => {
  //   async function getQuote() {
  //     let response = await axios.post(`/api/quote`, { amount: solPercent });
  //     setQuoted(response);
  //   }
  //   getQuote();
  // }, [solPercent]);

  return (
    <div className="flex flex-col w-full max-w-md p-6 bg-black rounded-lg shadow-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white font-bold text-lg">Trade</h2>
        <WalletMultiButtonDynamic className="bg-purple-600 hover:bg-purple-700 text-white" />
      </div>

      <ToastContainer />

      <div className="flex justify-between mb-4">
        <button
          onClick={() => setIsBuying(true)}
          className={`flex-1 py-2 ${
            isBuying ? "bg-purple-600" : "bg-gray-700"
          } text-white font-bold rounded-l-lg`}
        >
          Buy
        </button>
        <button
          onClick={() => setIsBuying(false)}
          className={`flex-1 py-2 ${
            !isBuying ? "bg-purple-600" : "bg-gray-700"
          } text-white font-bold rounded-r-lg`}
        >
          Sell
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-white font-bold mb-2">Token Address</label>
        <input
          type="text"
          placeholder="Enter token address"
          value={tokenAddress}
          onChange={(event: any) => {
            setTokenAddress(event.target.value);
          }}
          className="w-full p-2 bg-gray-800 text-white rounded-lg"
        />
      </div>

      <div className="mb-4">
        <label className="block text-white font-bold mb-2">
          Amount {isBuying ? "(SOL)" : `(${tokenSymbol})`}
        </label>
        <input
          type="number"
          placeholder="0.00"
          value={solPercent}
          onChange={(event: any) => {
            setSolPercent(event.target.value);
          }}
          className="w-full p-2 bg-gray-800 text-white rounded-lg"
        />
      </div>

      <div className="flex justify-between mb-4">
        {isBuying ? (
          <>
            <button
              onClick={() => setSolPercent(0.1)}
              className="flex-1 py-2 bg-gray-700 text-white font-bold rounded-lg mx-1"
            >
              0.1
            </button>
            <button
              onClick={() => setSolPercent(0.5)}
              className="flex-1 py-2 bg-gray-700 text-white font-bold rounded-lg mx-1"
            >
              0.5
            </button>
            <button
              onClick={() => setSolPercent(1)}
              className="flex-1 py-2 bg-gray-700 text-white font-bold rounded-lg mx-1"
            >
              1
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setSolPercent(balance * 0.25)}
              className="flex-1 py-2 bg-gray-700 text-white font-bold rounded-lg mx-1"
            >
              25%
            </button>
            <button
              onClick={() => setSolPercent(balance * 0.5)}
              className="flex-1 py-2 bg-gray-700 text-white font-bold rounded-lg mx-1"
            >
              50%
            </button>
            <button
              onClick={() => setSolPercent(balance * 0.75)}
              className="flex-1 py-2 bg-gray-700 text-white font-bold rounded-lg mx-1"
            >
              75%
            </button>
            <button
              onClick={() => setSolPercent(balance)}
              className="flex-1 py-2 bg-gray-700 text-white font-bold rounded-lg mx-1"
            >
              100%
            </button>
          </>
        )}
      </div>

      <div className="text-white mb-4">
        Balance:{" "}
        {wallet.connected
          ? `${balance} ${isBuying ? "SOL" : tokenSymbol}`
          : "Not Connected"}
      </div>

      <button
        onClick={() => {
          swap(quoted);
        }}
        className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg flex items-center justify-center"
      >
        <span className="mr-2">⚡</span> {isBuying ? "Buy" : "Sell"}
      </button>
    </div>
  );
}
