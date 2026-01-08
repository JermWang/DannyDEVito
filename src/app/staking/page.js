"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Transaction } from "@solana/web3.js";
import IEBrowser from "@/components/IEBrowser";

function toBase64(bytes) {
  if (!bytes) return "";
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromBase64(base64) {
  const b64 = String(base64 ?? "").trim();
  if (!b64) return new Uint8Array();
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(b64, "base64"));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function buildStakingAuthMessage({
  wallet,
  action,
  nonce,
  amount,
  txSignature,
  allocationId,
  unstakeTxSignature,
  allocationTxSignatures,
  claimAmount,
}) {
  const allocTxs = Array.isArray(allocationTxSignatures) ? allocationTxSignatures.join(",") : allocationTxSignatures;
  return `Danny DEVito Staking Action\n\nWallet: ${wallet}\nAction: ${action}\nNonce: ${nonce}\nAmount: ${amount ?? ""}\nTx: ${txSignature ?? ""}\nAllocation: ${allocationId ?? ""}\nUnstakeTx: ${unstakeTxSignature ?? ""}\nAllocationTxs: ${allocTxs ?? ""}\nClaimAmount: ${claimAmount ?? ""}`;
}

function formatTimeLeft(iso) {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diff)) return "—";
  if (diff <= 0) return "Ready";

  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function StatBox({ label, value, highlight = false }) {
  return (
    <div className="bg-[#c0c0c0] border-2 p-3" style={{ borderColor: "#808080 #ffffff #ffffff #808080" }}>
      <div className="text-[10px] text-[#808080] uppercase font-bold">{label}</div>
      <div className={`text-xl font-bold mt-1 ${highlight ? "text-[#008000]" : "text-black"}`}>
        {value}
      </div>
    </div>
  );
}

export default function StakingPage() {
  const { publicKey, connected, signMessage, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [wallet, setWallet] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("100");
  const [txSignature, setTxSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [escrowWallet, setEscrowWallet] = useState(null);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(true);

  useEffect(() => {
    if (connected && publicKey) {
      setWallet(publicKey.toBase58());
    }
  }, [connected, publicKey]);

  const canQuery = useMemo(() => wallet.trim().length > 10, [wallet]);
  
  // Check if user has initialized their escrow wallet
  const hasEscrow = summary?.escrowWallet || escrowWallet;

  async function fetchHistory() {
    if (!canQuery) return;
    try {
      const res = await fetch(`/api/staking/history?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      if (data.ok) {
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch history:", e);
    }
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/staking/leaderboard?limit=20");
      const data = await res.json();
      if (data.ok) {
        setLeaderboard(data);
      }
    } catch (e) {
      console.error("Failed to fetch leaderboard:", e);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  async function refresh() {
    if (!canQuery) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/staking?wallet=${encodeURIComponent(wallet)}`);
      const data = await res.json();
      setSummary(data?.summary || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canQuery) refresh();
  }, [wallet]);

  async function signedStakingPost(payload) {
    if (!connected || !publicKey || !signMessage) {
      throw new Error("Connect wallet first");
    }

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const action = String(payload?.action ?? "");
    const messageToSign = buildStakingAuthMessage({
      wallet,
      action,
      nonce,
      amount: payload?.amount,
      txSignature: payload?.txSignature,
      allocationId: payload?.allocationId,
      unstakeTxSignature: payload?.unstakeTxSignature,
      allocationTxSignatures: payload?.allocationTxSignatures,
      claimAmount: payload?.claimAmount,
    });
    const messageBytes = new TextEncoder().encode(messageToSign);
    const signatureBytes = await signMessage(messageBytes);
    const signature = toBase64(signatureBytes);

    const res = await fetch("/api/staking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet, nonce, signature, ...payload }),
    });

    const data = await res.json().catch(() => null);
    return { res, data };
  }

  async function claimUnlocked() {
    if (!canQuery) return;
    if (!connected || !publicKey) {
      setMessage({ type: "error", text: "Connect wallet first" });
      return;
    }
    if (!sendTransaction) {
      setMessage({ type: "error", text: "Wallet does not support sending transactions" });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const { res, data } = await signedStakingPost({ action: "claim_prepare" });
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "claim_prepare_failed");
      }

      const prepared = data.prepared;
      const unstakeTxBase64 = prepared?.unstakeTxBase64;
      const allocationTxsBase64 = Array.isArray(prepared?.allocationTxsBase64) ? prepared.allocationTxsBase64 : [];

      const unstakeTx = Transaction.from(fromBase64(unstakeTxBase64));
      const unstakeSig = await sendTransaction(unstakeTx, connection);
      await connection.confirmTransaction(unstakeSig, "confirmed");

      const allocSigs = [];
      for (const txB64 of allocationTxsBase64) {
        if (!String(txB64 || "").trim()) continue;
        const tx = Transaction.from(fromBase64(txB64));
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");
        allocSigs.push(sig);
      }

      const finalize = await signedStakingPost({
        action: "claim_finalize",
        claimAmount: prepared?.claimAmount,
        allocationIds: prepared?.allocationIds,
        unstakeTxSignature: unstakeSig,
        allocationTxSignatures: allocSigs,
      });

      if (!finalize.res.ok || !finalize.data?.ok) {
        throw new Error(finalize.data?.error || "claim_finalize_failed");
      }

      setSummary(finalize.data?.summary || null);
      setMessage({ type: "success", text: "Claim completed!" });
      if (showHistory) {
        await fetchHistory();
      }
    } catch (e) {
      setMessage({ type: "error", text: e?.message || "Claim failed. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function initEscrow() {
    if (!canQuery) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await signedStakingPost({ action: "init_escrow" });
      if (data.ok && data.escrowWallet) {
        setEscrowWallet(data.escrowWallet);
        setMessage({ type: "success", text: "Escrow wallet created! Send $DEVITO to stake." });
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create escrow wallet" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function act(action) {
    if (!canQuery) return;

    if (action === "stake" && !String(txSignature || "").trim()) {
      setMessage({ type: "error", text: "Paste the deposit transaction signature first." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const payload = {
        action,
        amount: Number(amount),
      };
      if (action === "stake") {
        payload.txSignature = String(txSignature || "").trim();
      }

      const { res, data } = await signedStakingPost(payload);
      setSummary(data?.summary || null);

      if (!res.ok && data?.error) {
        const errorMessages = {
          cooldown_active: "You're in cooldown! Wait before staking again.",
          escrow_not_initialized: "Set up your escrow wallet first!",
          already_pending_unlock: "You already have a pending unstake.",
          insufficient_staked: "You don't have that much staked!",
          no_pending_unlock: "Nothing to claim yet.",
          not_unlocked_yet: "Your tokens aren't unlocked yet. Be patient!",
          devito_mint_not_configured: "Staking token mint is not configured on the server.",
          tx_signature_required: "Paste the deposit transaction signature.",
          tx_already_used: "That transaction signature was already used.",
          tx_not_found: "Transaction not found yet. Wait for confirmation and try again.",
          tx_failed: "That transaction failed on-chain.",
          tx_not_signed_by_wallet: "Deposit tx must be signed by your connected wallet.",
          deposit_amount_mismatch: "Deposit amount doesn't match what you entered.",
          deposit_source_mismatch: "Deposit must be from your wallet into your escrow.",
        };
        setMessage({ type: "error", text: errorMessages[data.error] || data.error });
      } else {
        const successMessages = {
          stake: "Tokens staked! You're in the pit now.",
          request_unstake: "Unstake requested. Unlock timer started.",
          claim: "Tokens claimed! 48h cooldown started.",
        };
        setMessage({ type: "success", text: successMessages[action] || "Success!" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#008080]" />

      {/* Desktop area */}
      <div className="absolute inset-0 pb-7 md:pb-7 pb-9">
        <div className="h-full p-2 flex gap-2 max-md:flex-col max-md:gap-0 max-md:p-0">
          {/* IE Browser Window - Main Content */}
          <div className="flex-1 max-md:h-full">
            <IEBrowser 
              title="Staking - Earn Allocations" 
              url="http://dannydevito.fun/staking"
              onRefresh={refresh}
            >
              {/* Spammy ticker banner */}
              <div className="bg-black text-[10px] font-bold overflow-hidden whitespace-nowrap">
                <marquee behavior="scroll" direction="left" scrollamount="3" className="py-1">
                  <span className="text-red-500">🚨 YOU ARE THE 1,000,000th VISITOR! 🚨</span>
                  <span className="mx-4 text-yellow-400">⚠️ YOUR COMPUTER HAS 47 VIRUSES ⚠️</span>
                  <span className="mx-4 text-green-400">💰 SINGLE MOMS IN YOUR AREA WANT TO TRADE CRYPTO 💰</span>
                  <span className="mx-4 text-pink-400">🎰 CLICK HERE TO CLAIM FREE $DEVITO 🎰</span>
                  <span className="mx-4 text-cyan-400">🔥 DOCTORS HATE THIS ONE WEIRD TRICK 🔥</span>
                  <span className="mx-4 text-orange-400">📈 $DEVITO TO $1 GUARANTEED* 📈</span>
                  <span className="mx-4 text-purple-400">🥚 EGG TOKEN PRESALE LIVE NOW 🥚</span>
                  <span className="mx-4 text-lime-400">💎 DIAMOND HANDS ONLY 💎</span>
                  <span className="mx-4 text-red-400">🚀 NEXT 1000X GEM FOUND 🚀</span>
                  <span className="mx-4 text-yellow-300">⬇️ DOWNLOAD MORE RAM ⬇️</span>
                </marquee>
              </div>

              <div className="p-4 font-sans text-sm text-black bg-white max-w-3xl mx-auto">
              {/* Page header */}
              <div className="border-b-2 border-[#000080] pb-2 mb-4">
                <h1 className="text-2xl font-bold text-[#000080] flex items-center gap-2">
                  <img src="/DEVito.png" alt="" className="h-8" />
                  The Staking Pit
                </h1>
                <p className="text-xs text-gray-600 mt-1">
                  Throw your $DEVITO in the pit. The more you stake, the bigger your cut when I drop a magnum coin.
                </p>
              </div>

              {/* Status banner */}
              <div className="bg-[#000080] text-white p-2 mb-4 text-center font-bold text-sm">
                THE PIT IS OPEN | More stake = bigger slice | 48h cooldown after unstake
              </div>

              {/* How it works */}
              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">
                  The Reynolds Ratio (How This Works)
                </div>
                <div className="bg-[#E8E8FF] p-3 text-xs text-black">
                  <ul className="list-disc ml-4 space-y-1 text-black">
                    <li>Throw your <strong>$DEVITO</strong> in the pit. It's like a septic tank, but for gains.</li>
                    <li>Allocations are <strong>weighted</strong> — more in the pit = bigger slice of my magnum coins</li>
                    <li>Wanna leave? Request unstake starts a <strong>timed unlock</strong>. Can't have people runnin' off.</li>
                    <li>After you unstake and claim, <strong>48h cooldown</strong> before you can stake again. Gotta let the rum ham settle, kid.</li>
                    <li>Managed through <strong>Privy custody</strong> — I'm not touchin' your keys. I got standards. Low ones, but still.</li>
                  </ul>
                </div>
              </div>

              {/* Wallet connection */}
              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm flex items-center justify-between">
                  <span>Show Me Your Wallet</span>
                  <WalletMultiButton className="!bg-[#000060] !h-6 !text-xs !py-0 !px-2" />
                </div>
                <div className="bg-white p-3">
                  <div className="flex gap-2">
                    <input
                      value={wallet}
                      onChange={(e) => setWallet(e.target.value)}
                      placeholder="Enter your Solana wallet address..."
                      className="flex-1 px-2 py-1 border-2 border-[#808080] font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={refresh}
                      disabled={!canQuery || loading}
                      className="px-4 py-1 bg-[#c0c0c0] border-2 text-xs font-bold disabled:opacity-50"
                      style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                    >
                      {loading ? "Loading..." : "Load"}
                    </button>
                  </div>
                  {connected && (
                    <div className="text-xs text-green-600 mt-1">✅ Wallet connected - address auto-filled</div>
                  )}
                  {!canQuery && wallet.length > 0 && (
                    <div className="text-xs text-red-600 mt-1">⚠️ Enter a valid wallet address (min 10 characters)</div>
                  )}
                </div>
              </div>

              {/* Stats table */}
              <table className="w-full border-collapse mb-4">
                <tbody>
                  <tr className="bg-[#000080] text-white">
                    <td className="border border-[#808080] px-3 py-1 font-bold" colSpan={4}>
                      What You Got In The Pit
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0] w-1/4"><strong>Staked:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white text-[#000080] font-bold font-mono">
                      {summary?.stakedAmount ?? 0} $DEVITO
                    </td>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0] w-1/4"><strong>Multiplier:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white text-green-600 font-bold font-mono">
                      {summary?.multiplier ? `${summary.multiplier.toFixed(2)}x` : "1.00x"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0]"><strong>Weighted Stake:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white font-mono">
                      {summary?.weightedStake?.toFixed(2) ?? 0}
                    </td>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0]"><strong>Staking Since:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white font-mono text-xs">
                      {summary?.stakedAt ? new Date(summary.stakedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0]"><strong>Pending Unlock:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white font-mono">
                      {summary?.pendingUnstakeAmount ?? 0}
                    </td>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0]"><strong>Unlock In:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white font-mono">
                      {formatTimeLeft(summary?.unlockAt)}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0]"><strong>Cooldown:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white font-mono" colSpan={3}>
                      {formatTimeLeft(summary?.cooldownUntil)}
                      {summary?.cooldownUntil && new Date(summary.cooldownUntil) > new Date() && (
                        <span className="text-xs text-red-600 ml-2">⚠️ Can't stake until cooldown ends</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Message */}
              {message && (
                <div className={`border-2 p-3 mb-4 text-sm ${
                  message.type === "error" 
                    ? "bg-[#FFCCCC] border-[#FF0000] text-[#FF0000]" 
                    : "bg-[#E8E8FF] border-[#000080] text-[#000080]"
                }`}>
                  {message.type === "error" ? "❌" : "✅"} {message.text}
                </div>
              )}

              {/* SIMPLE STAKING FLOW */}
              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#008000] text-white px-3 py-2 font-bold text-sm">
                  🚀 Start Staking in 2 Easy Steps
                </div>
                <div className="bg-white p-4">
                  
                  {/* STEP 1: Create Escrow */}
                  <div className={`p-4 mb-4 border-2 ${hasEscrow ? "border-green-500 bg-green-50" : "border-[#FFD700] bg-[#FFFDE8]"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${hasEscrow ? "bg-green-500" : "bg-[#FFD700] text-black"}`}>
                        {hasEscrow ? "✓" : "1"}
                      </div>
                      <div className="font-bold text-black">
                        {hasEscrow ? "Escrow Wallet Ready!" : "Create Your Escrow Wallet"}
                      </div>
                    </div>
                    
                    {hasEscrow ? (
                      <div className="ml-11">
                        <p className="text-xs text-gray-600 mb-2">Your secure deposit address:</p>
                        <div className="bg-white border-2 border-[#808080] p-2 font-mono text-xs break-all select-all cursor-pointer hover:bg-gray-50"
                          onClick={() => {
                            navigator.clipboard.writeText(summary?.escrowWallet || escrowWallet);
                            setMessage({ type: "success", text: "Escrow address copied!" });
                            setTimeout(() => setMessage(null), 2000);
                          }}
                          title="Click to copy"
                        >
                          {summary?.escrowWallet || escrowWallet}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">👆 Click to copy address</p>
                      </div>
                    ) : (
                      <div className="ml-11">
                        <p className="text-xs text-gray-600 mb-3">
                          This creates a secure wallet where your $DEVITO will be held. 
                          You control it through your connected wallet.
                        </p>
                        {canQuery ? (
                          <button
                            type="button"
                            onClick={initEscrow}
                            disabled={busy}
                            className="px-6 py-3 bg-[#000080] text-white font-bold text-sm disabled:opacity-50 hover:bg-[#000060] transition"
                          >
                            {busy ? "⏳ Creating..." : "🔐 CREATE ESCROW WALLET"}
                          </button>
                        ) : (
                          <p className="text-xs text-red-600">⚠️ Connect your wallet above first</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* STEP 2: Deposit */}
                  <div className={`p-4 border-2 ${!hasEscrow ? "border-gray-300 bg-gray-100 opacity-60" : "border-[#000080] bg-[#E8E8FF]"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${!hasEscrow ? "bg-gray-400 text-white" : "bg-[#000080] text-white"}`}>
                        2
                      </div>
                      <div className="font-bold text-black">
                        Deposit $DEVITO
                      </div>
                    </div>
                    
                    <div className="ml-11">
                      {!hasEscrow ? (
                        <p className="text-xs text-gray-500">Complete Step 1 first</p>
                      ) : (
                        <>
                          <div className="bg-white border border-[#808080] p-3 mb-3">
                            <p className="text-xs text-black mb-2"><strong>How to deposit:</strong></p>
                            <ol className="text-xs text-gray-700 list-decimal ml-4 space-y-1">
                              <li>Send $DEVITO tokens to your escrow address above</li>
                              <li>Copy the transaction signature from your wallet</li>
                              <li>Paste it below and click "Confirm Deposit"</li>
                            </ol>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-bold text-black block mb-1">Amount you sent:</label>
                              <input
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="e.g. 1000"
                                type="number"
                                className="w-full px-3 py-2 border-2 border-[#808080] font-mono text-sm bg-white text-black"
                              />
                            </div>
                            
                            <div>
                              <label className="text-xs font-bold text-black block mb-1">Transaction Signature:</label>
                              <input
                                value={txSignature}
                                onChange={(e) => setTxSignature(e.target.value)}
                                placeholder="Paste the tx signature from your wallet here"
                                type="text"
                                className="w-full px-3 py-2 border-2 border-[#808080] font-mono text-xs bg-white text-black"
                              />
                              <p className="text-[10px] text-gray-500 mt-1">Find this in your wallet's transaction history</p>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => act("stake")}
                              disabled={!canQuery || busy || !amount || !txSignature}
                              className="w-full px-6 py-3 bg-[#008000] text-white font-bold text-sm disabled:opacity-50 hover:bg-[#006000] transition"
                            >
                              {busy ? "⏳ Processing..." : "✅ CONFIRM DEPOSIT"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Manage Existing Stake */}
              {summary?.stakedAmount > 0 && (
                <div className="border-2 border-[#808080] mb-4">
                  <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">
                    Manage Your Stake
                  </div>
                  <div className="bg-white p-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => act("request_unstake")}
                        disabled={!canQuery || busy}
                        className="px-6 py-2 bg-[#c0c0c0] text-black font-bold disabled:opacity-50 hover:bg-[#a0a0a0] border-2"
                        style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                      >
                        📤 REQUEST UNSTAKE
                      </button>
                      
                      {summary?.pendingUnstakeAmount > 0 && (
                        <button
                          type="button"
                          onClick={claimUnlocked}
                          disabled={!canQuery || busy || formatTimeLeft(summary?.unlockAt) !== "Ready"}
                          className="px-6 py-2 bg-green-600 text-white font-bold disabled:opacity-50 hover:bg-green-700"
                        >
                          💰 CLAIM {summary.pendingUnstakeAmount} TOKENS
                        </button>
                      )}
                    </div>
                    
                    {summary?.pendingUnstakeAmount > 0 && formatTimeLeft(summary?.unlockAt) !== "Ready" && (
                      <p className="text-xs text-orange-600 mt-2">
                        ⏳ Unlock in: {formatTimeLeft(summary?.unlockAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Unclaimed allocations */}
              {summary?.unclaimedAllocations?.length > 0 && (
                <div className="border-2 border-green-600 mb-4">
                  <div className="bg-green-600 text-white px-3 py-1 font-bold text-sm">
                    🎉 Unclaimed Launch Rewards!
                  </div>
                  <div className="bg-[#E8FFE8] p-3">
                    <div className="space-y-2">
                      {summary.unclaimedAllocations.map((alloc) => (
                        <div key={alloc.launchId} className="flex items-center justify-between bg-white p-2 border border-[#808080]">
                          <div>
                            <span className="font-bold">{alloc.launchName}</span>
                            <span className="text-[#000080] ml-2">${alloc.ticker}</span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({alloc.tokenAmount.toFixed(2)} tokens)
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            Claim when you unstake
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Multiplier info */}
              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">
                  Time Multipliers (Stake Longer = Bigger Share)
                </div>
                <div className="bg-[#E8E8FF] p-3 text-xs text-black">
                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">Day 1</div>
                      <div className="text-[#000080]">1.00x</div>
                    </div>
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">3 Days</div>
                      <div className="text-[#000080]">2.00x</div>
                    </div>
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">7 Days</div>
                      <div className="text-[#000080]">3.00x</div>
                    </div>
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">10 Days</div>
                      <div className="text-[#000080]">4.00x</div>
                    </div>
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">14 Days</div>
                      <div className="text-green-600">5.00x</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Transaction History Dashboard */}
              {canQuery && (
                <div className="border-2 border-[#808080] mb-4">
                  <div 
                    className="bg-[#000080] text-white px-3 py-1 font-bold text-sm flex justify-between items-center cursor-pointer"
                    onClick={() => { setShowHistory(!showHistory); if (!history) fetchHistory(); }}
                  >
                    <span>📊 Transaction History Dashboard</span>
                    <span>{showHistory ? "▼" : "▶"}</span>
                  </div>
                  {showHistory && (
                    <div className="bg-white p-3 text-xs">
                      {!history ? (
                        <div className="text-center py-4 text-gray-500">Loading history...</div>
                      ) : (
                        <>
                          {/* Summary Stats */}
                          <div className="grid grid-cols-4 gap-2 mb-4">
                            <div className="bg-[#E8E8FF] p-2 border border-[#808080] text-center">
                              <div className="text-[10px] text-gray-600">Total Staked</div>
                              <div className="font-bold text-[#000080]">{history.summary?.totalStaked?.toFixed(2) || 0}</div>
                            </div>
                            <div className="bg-[#E8E8FF] p-2 border border-[#808080] text-center">
                              <div className="text-[10px] text-gray-600">Total Unstaked</div>
                              <div className="font-bold text-[#000080]">{history.summary?.totalUnstaked?.toFixed(2) || 0}</div>
                            </div>
                            <div className="bg-[#E8FFE8] p-2 border border-[#808080] text-center">
                              <div className="text-[10px] text-gray-600">Current Stake</div>
                              <div className="font-bold text-green-600">{history.summary?.currentStake?.toFixed(2) || 0}</div>
                            </div>
                            <div className="bg-[#FFFFCC] p-2 border border-[#808080] text-center">
                              <div className="text-[10px] text-gray-600">Allocations</div>
                              <div className="font-bold">{history.summary?.claimedAllocations || 0}/{history.summary?.totalAllocations || 0}</div>
                            </div>
                          </div>

                          {/* Transaction List */}
                          <div className="mb-3">
                            <div className="font-bold mb-1 text-[#000080]">Recent Transactions</div>
                            {history.transactions?.length > 0 ? (
                              <div className="max-h-32 overflow-y-auto border border-[#808080]">
                                <table className="w-full text-[10px]">
                                  <thead className="bg-[#c0c0c0] sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1 text-left">Date</th>
                                      <th className="px-2 py-1 text-left">Action</th>
                                      <th className="px-2 py-1 text-right">Amount</th>
                                      <th className="px-2 py-1 text-left">TX</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {history.transactions.map((tx) => (
                                      <tr key={tx.id} className="border-t border-[#c0c0c0] hover:bg-[#E8E8FF]">
                                        <td className="px-2 py-1">{new Date(tx.createdAt).toLocaleDateString()}</td>
                                        <td className="px-2 py-1">
                                          <span className={`px-1 rounded ${
                                            tx.action === "stake" ? "bg-green-200 text-green-800" :
                                            tx.action === "request_unstake" ? "bg-yellow-200 text-yellow-800" :
                                            "bg-blue-200 text-blue-800"
                                          }`}>
                                            {tx.action}
                                          </span>
                                        </td>
                                        <td className="px-2 py-1 text-right font-mono">{tx.amount.toFixed(2)}</td>
                                        <td className="px-2 py-1 font-mono truncate max-w-[80px]">
                                          {tx.txSignature ? tx.txSignature.slice(0, 8) + "..." : "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-center py-2 border border-[#808080]">No transactions yet</div>
                            )}
                          </div>

                          {/* Allocations List */}
                          <div>
                            <div className="font-bold mb-1 text-[#000080]">Launch Allocations</div>
                            {history.allocations?.length > 0 ? (
                              <div className="max-h-32 overflow-y-auto border border-[#808080]">
                                <table className="w-full text-[10px]">
                                  <thead className="bg-[#c0c0c0] sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1 text-left">Launch</th>
                                      <th className="px-2 py-1 text-right">Tokens</th>
                                      <th className="px-2 py-1 text-right">Share</th>
                                      <th className="px-2 py-1 text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {history.allocations.map((a) => (
                                      <tr key={a.id} className="border-t border-[#c0c0c0] hover:bg-[#E8E8FF]">
                                        <td className="px-2 py-1">
                                          <span className="font-bold">{a.launchName}</span>
                                          <span className="text-[#000080] ml-1">${a.ticker}</span>
                                        </td>
                                        <td className="px-2 py-1 text-right font-mono">{a.tokenAmount.toFixed(2)}</td>
                                        <td className="px-2 py-1 text-right">{(a.sharePercent * 100).toFixed(4)}%</td>
                                        <td className="px-2 py-1 text-center">
                                          {a.claimed ? (
                                            <span className="text-green-600">✓ Claimed</span>
                                          ) : (
                                            <span className="text-yellow-600">Pending</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-gray-500 text-center py-2 border border-[#808080]">No allocations yet</div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={fetchHistory}
                            className="mt-2 px-3 py-1 bg-[#c0c0c0] border-2 text-[10px] hover:bg-[#a0a0a0]"
                            style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                          >
                            🔄 Refresh
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Leaderboard */}
              <div className="border-2 border-[#808080] mb-4">
                <div 
                  className="bg-[#FFD700] text-black px-3 py-1 font-bold text-sm flex justify-between items-center cursor-pointer"
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                >
                  <span>🏆 Staking Leaderboard</span>
                  <span>{showLeaderboard ? "▼" : "▶"}</span>
                </div>
                {showLeaderboard && (
                  <div className="bg-white p-3 text-xs">
                    {!leaderboard ? (
                      <div className="text-center py-4 text-gray-500">Loading leaderboard...</div>
                    ) : leaderboard.leaderboard?.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">No stakers yet. Be the first!</div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                          <div className="bg-[#FFD700] p-2 border border-[#808080]">
                            <div className="text-[10px] text-gray-700">Total Stakers</div>
                            <div className="font-bold text-black">{leaderboard.stats?.totalStakers || 0}</div>
                          </div>
                          <div className="bg-[#E8E8FF] p-2 border border-[#808080]">
                            <div className="text-[10px] text-gray-600">Total Staked</div>
                            <div className="font-bold text-[#000080]">{(leaderboard.stats?.totalStaked || 0).toLocaleString()}</div>
                          </div>
                          <div className="bg-[#E8FFE8] p-2 border border-[#808080]">
                            <div className="text-[10px] text-gray-600">Weighted Total</div>
                            <div className="font-bold text-green-600">{(leaderboard.stats?.totalWeighted || 0).toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="max-h-64 overflow-y-auto border border-[#808080]">
                          <table className="w-full text-[10px]">
                            <thead className="bg-[#c0c0c0] sticky top-0">
                              <tr>
                                <th className="px-2 py-1 text-left">#</th>
                                <th className="px-2 py-1 text-left">Wallet</th>
                                <th className="px-2 py-1 text-right">Staked</th>
                                <th className="px-2 py-1 text-right">Multiplier</th>
                                <th className="px-2 py-1 text-right">Weighted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {leaderboard.leaderboard.map((entry) => (
                                <tr 
                                  key={entry.wallet} 
                                  className={`border-t border-[#c0c0c0] hover:bg-[#FFFFD0] ${entry.wallet === wallet ? "bg-[#E8FFE8]" : ""}`}
                                >
                                  <td className="px-2 py-1 font-bold">
                                    {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                                  </td>
                                  <td className="px-2 py-1 font-mono">
                                    {entry.walletShort}
                                    {entry.wallet === wallet && <span className="ml-1 text-green-600">(You)</span>}
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono">{entry.stakedAmount.toLocaleString()}</td>
                                  <td className="px-2 py-1 text-right">
                                    <span className={entry.multiplier >= 5 ? "text-green-600 font-bold" : "text-[#000080]"}>
                                      {entry.multiplier.toFixed(2)}x
                                    </span>
                                  </td>
                                  <td className="px-2 py-1 text-right font-mono font-bold">{entry.weightedStake.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          type="button"
                          onClick={fetchLeaderboard}
                          className="mt-2 px-3 py-1 bg-[#c0c0c0] border-2 text-[10px] hover:bg-[#a0a0a0]"
                          style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                        >
                          🔄 Refresh
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 pt-2 border-t-2 border-[#808080] text-xs text-gray-500 text-center">
                <marquee>~ The more you throw in the pit, the bigger your slice ~ I drop coins every 72 hours ~ It's basic human chemistry, kid ~</marquee>
              </div>
            </div>
          </IEBrowser>
          </div>

          {/* Ad Sidebar */}
          <div className="hidden lg:block w-48 flex-shrink-0">
            <div className="bg-[#c0c0c0] border-2 h-full flex flex-col" style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}>
              <div className="bg-[#000080] text-white text-[10px] px-2 py-1 text-center font-bold">
                ADVERTISEMENT
              </div>
              <div className="p-1 flex flex-col items-center flex-1">
                {/* Spammy top section */}
                <div className="w-full mb-1 p-1 bg-[#FF0000] text-white text-[8px] text-center font-bold animate-pulse">
                  🚨 YOU ARE THE 1,000,000th VISITOR! 🚨
                </div>
                <div className="w-full mb-1 p-1 bg-[#00FF00] text-black text-[7px] text-center font-bold">
                  ⚠️ YOUR COMPUTER HAS 47 VIRUSES ⚠️
                </div>
                <div className="w-full mb-1 p-1 bg-[#FFFF00] text-black text-[7px] text-center">
                  <marquee scrollamount="2">💰 SINGLE MOMS IN YOUR AREA WANT TO TRADE CRYPTO 💰</marquee>
                </div>
                <div className="w-full mb-1 p-1 bg-[#FF00FF] text-white text-[7px] text-center font-bold">
                  🎰 CLICK HERE TO CLAIM FREE $DEVITO 🎰
                </div>
                <div className="w-full mb-2 p-1 bg-black text-[#00FF00] text-[7px] text-center font-mono">
                  &gt;&gt; DOWNLOAD MORE RAM &lt;&lt;
                </div>

                {/* Main ad image - centered */}
                <a 
                  href="/" 
                  className="block hover:opacity-90 transition-opacity my-auto"
                  title="Click here for the 1 weird trick!"
                >
                  <img 
                    src="/danny-devito-ad-banner-website-sideways.png" 
                    alt="Make your bag BIGGER with this 1 trick!" 
                    className="w-full h-auto"
                    style={{ imageRendering: "auto" }}
                  />
                </a>

                {/* Bottom section */}
                <div className="text-[8px] text-black mt-1 text-center">
                  [SPONSORED]
                </div>
                <div className="mt-1 p-2 bg-[#FFFFCC] border border-[#808080] text-[9px] text-center">
                  <div className="font-bold text-red-600 animate-pulse">🔥 HOT TIP 🔥</div>
                  <div className="mt-1 text-black">Doctors HATE this one weird trick to grow your bag!</div>
                </div>
                <div className="mt-1 text-[8px] text-center text-black">
                  <div>👆 Click ad 👆</div>
                  <div>to support Danny</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Taskbar */}
      <div className="win-taskbar">
        <Link href="/" className="win-start-btn">
          <img src="/1.png" alt="" className="h-4" />
          <span>Start</span>
        </Link>
        <div className="win-taskbar-items">
          <div className="win-taskbar-item active">
            <span>🌐</span>
            <span>Staking - Internet Explorer</span>
          </div>
        </div>
        <div className="win-taskbar-clock">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* CRT Effect */}
      <div className="crt-chromatic" />
      <div className="crt-reflection" />
      <div className="crt-glow" />
      <div className="crt-screen" />
      <div className="crt-overlay" />
    </div>
  );
}
