"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import IEBrowser from "@/components/IEBrowser";

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
  const [wallet, setWallet] = useState("");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [escrowWallet, setEscrowWallet] = useState(null);

  const canQuery = useMemo(() => wallet.trim().length > 10, [wallet]);
  
  // Check if user has initialized their escrow wallet
  const hasEscrow = summary?.escrowWallet || escrowWallet;

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

  async function initEscrow() {
    if (!canQuery) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/staking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, action: "init_escrow" }),
      });
      const data = await res.json();
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

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/staking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          action,
          amount: Number(amount),
        }),
      });

      const data = await res.json();
      setSummary(data?.summary || null);

      if (!res.ok && data?.error) {
        const errorMessages = {
          cooldown_active: "You're in cooldown! Wait before staking again.",
          escrow_not_initialized: "Set up your escrow wallet first!",
          already_pending_unlock: "You already have a pending unstake.",
          insufficient_staked: "You don't have that much staked!",
          no_pending_unlock: "Nothing to claim yet.",
          not_unlocked_yet: "Your tokens aren't unlocked yet. Be patient!",
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
      <div className="absolute inset-0 pb-7">
        {/* IE Browser Window */}
        <div className="h-full p-2">
          <IEBrowser 
            title="Staking - Earn Allocations" 
            url="http://dannydevito.fun/staking"
            onRefresh={refresh}
          >
            <div className="p-4 font-sans text-sm text-black bg-white">
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
                <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">
                  Show Me Your Wallet
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
                  {!canQuery && wallet.length > 0 && (
                    <div className="text-xs text-red-600 mt-1">⚠️ Enter a valid wallet address (min 10 characters)</div>
                  )}
                </div>
              </div>

              {/* Escrow wallet info */}
              {hasEscrow && (
                <div className="border-2 border-[#808080] mb-4">
                  <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">
                    Your Escrow Wallet (Privy Custody)
                  </div>
                  <div className="bg-[#E8E8FF] p-3 text-xs text-black">
                    <p className="mb-2">Send <strong>$DEVITO</strong> to this address to deposit into the pit:</p>
                    <div className="bg-white border border-[#808080] p-2 font-mono text-[10px] break-all select-all">
                      {summary?.escrowWallet || escrowWallet}
                    </div>
                    <p className="mt-2 text-gray-600">
                      After sending, click "Confirm Deposit" below with the amount you sent.
                    </p>
                  </div>
                </div>
              )}

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

              {/* Actions */}
              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">
                  Do Something
                </div>
                <div className="bg-white p-3">
                  {/* Step 1: Initialize escrow wallet if not done */}
                  {!hasEscrow && canQuery && (
                    <div className="mb-4 p-3 bg-[#FFFFCC] border border-[#808080]">
                      <p className="text-sm mb-2"><strong>Step 1:</strong> Set up your escrow wallet to start staking</p>
                      <button
                        type="button"
                        onClick={initEscrow}
                        disabled={busy}
                        className="px-6 py-2 bg-[#000080] text-white font-bold disabled:opacity-50 hover:bg-[#000060]"
                      >
                        {busy ? "Creating..." : "CREATE ESCROW WALLET"}
                      </button>
                    </div>
                  )}

                  {/* Step 2: Deposit/Withdraw/Claim actions */}
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Amount ($DEVITO)</label>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="100"
                        type="number"
                        className="w-32 px-2 py-1 border-2 border-[#808080] font-mono"
                      />
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => act("stake")}
                      disabled={!canQuery || busy || !hasEscrow}
                      className="px-6 py-2 bg-[#000080] text-white font-bold disabled:opacity-50 hover:bg-[#000060]"
                      title={!hasEscrow ? "Create escrow wallet first" : "Confirm deposit to escrow"}
                    >
                      CONFIRM DEPOSIT
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => act("request_unstake")}
                      disabled={!canQuery || busy || !summary?.stakedAmount}
                      className="px-6 py-2 bg-[#c0c0c0] text-black font-bold disabled:opacity-50 hover:bg-[#a0a0a0] border-2 border-[#808080]"
                      title="Request to unstake - starts unlock timer"
                    >
                      REQUEST UNSTAKE
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => act("claim")}
                      disabled={!canQuery || busy || !summary?.pendingUnstakeAmount}
                      className="px-6 py-2 bg-green-600 text-white font-bold disabled:opacity-50 hover:bg-green-700"
                      title="Claim unlocked tokens"
                    >
                      CLAIM TOKENS
                    </button>
                  </div>

                  {/* Unclaimed allocations */}
                  {summary?.unclaimedAllocations?.length > 0 && (
                    <div className="mt-4 p-3 bg-[#E8FFE8] border border-green-600">
                      <p className="text-sm font-bold mb-2">🎉 You have unclaimed launch allocations!</p>
                      <div className="space-y-2">
                        {summary.unclaimedAllocations.map((alloc) => (
                          <div key={alloc.launchId} className="flex items-center justify-between bg-white p-2 border border-[#808080]">
                            <div>
                              <span className="font-bold">{alloc.launchName}</span>
                              <span className="text-[#000080] ml-2">${alloc.ticker}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                ({alloc.tokenAmount.toFixed(2)} tokens @ {(alloc.sharePercent * 100).toFixed(4)}%)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                fetch("/api/staking", {
                                  method: "POST",
                                  headers: { "content-type": "application/json" },
                                  body: JSON.stringify({ wallet, action: "claim_allocation", allocationId: alloc.allocationId }),
                                }).then(() => refresh());
                              }}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-bold hover:bg-green-700"
                            >
                              CLAIM
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                      <div className="font-bold">7 Days</div>
                      <div className="text-[#000080]">1.25x</div>
                    </div>
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">30 Days</div>
                      <div className="text-[#000080]">1.50x</div>
                    </div>
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">90 Days</div>
                      <div className="text-green-600">2.00x</div>
                    </div>
                    <div className="bg-white p-2 border border-[#808080]">
                      <div className="font-bold">180 Days</div>
                      <div className="text-green-600">2.50x</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-2 border-t-2 border-[#808080] text-xs text-gray-500 text-center">
                <marquee>~ The more you throw in the pit, the bigger your slice ~ I drop coins every 72 hours ~ It's basic human chemistry, kid ~</marquee>
              </div>
            </div>
          </IEBrowser>
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
