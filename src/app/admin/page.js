"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

function buildAdminAuthMessage(wallet, nonce, action) {
  return `Danny DEVito Admin Action\n\nWallet: ${wallet}\nAction: ${action}\nNonce: ${nonce}`;
}

function shortAddr(addr) {
  if (!addr) return "—";
  const s = String(addr);
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export default function AdminPage() {
  const { publicKey, signMessage, connected } = useWallet();
  const wallet = publicKey?.toBase58() || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [treasury, setTreasury] = useState(null);
  const [launches, setLaunches] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const [launchForm, setLaunchForm] = useState({
    name: "",
    symbol: "",
    uri: "",
    spendableSolLamports: "100000000",
  });

  const [withdrawForm, setWithdrawForm] = useState({
    destinationWallet: "",
    amountLamports: "",
  });

  const [selectedLaunchId, setSelectedLaunchId] = useState("");

  const fetchTreasury = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/treasury");
      const data = await res.json();
      if (data.ok) setTreasury(data.treasury);
    } catch {}
  }, []);

  const fetchLaunches = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/launch");
      const data = await res.json();
      if (data.ok) setLaunches(data.launches || []);
    } catch {}
  }, []);

  const fetchAllocations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/distribute");
      const data = await res.json();
      if (data.ok) setAllocations(data.allocations || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchTreasury();
    fetchLaunches();
    fetchAllocations();
  }, [fetchTreasury, fetchLaunches, fetchAllocations]);

  async function signAndCall(action, endpoint, extraBody = {}) {
    if (!connected || !signMessage || !wallet) {
      setError("Connect wallet first");
      return null;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const message = buildAdminAuthMessage(wallet, nonce, action);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          nonce,
          signature,
          ...extraBody,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Request failed");
        return null;
      }

      setSuccess(`Success! ${data.signature ? `TX: ${shortAddr(data.signature)}` : ""}`);
      return data;
    } catch (e) {
      setError(e?.message || "Request failed");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunch() {
    const result = await signAndCall("launch", "/api/admin/launch", {
      name: launchForm.name,
      symbol: launchForm.symbol,
      uri: launchForm.uri,
      spendableSolLamports: launchForm.spendableSolLamports,
    });

    if (result) {
      setLaunchForm({ name: "", symbol: "", uri: "", spendableSolLamports: "100000000" });
      fetchLaunches();
      fetchTreasury();
    }
  }

  async function handleDistribute() {
    if (!selectedLaunchId) {
      setError("Select a launch first");
      return;
    }

    const result = await signAndCall("distribute", "/api/admin/distribute", {
      launchId: selectedLaunchId,
    });

    if (result) {
      fetchAllocations();
      fetchTreasury();
    }
  }

  async function handleWithdraw() {
    const result = await signAndCall("treasury_withdraw", "/api/admin/treasury", {
      action: "withdraw",
      destinationWallet: withdrawForm.destinationWallet,
      amountLamports: Number(withdrawForm.amountLamports),
    });

    if (result) {
      setWithdrawForm({ destinationWallet: "", amountLamports: "" });
      fetchTreasury();
    }
  }

  return (
    <div className="relative min-h-screen w-screen overflow-auto bg-[#008080]">
      <div className="p-4 max-w-6xl mx-auto">
        <div className="bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080] p-4 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-black flex items-center gap-2">
              <img src="/DEVito.png" alt="" className="h-8" />
              Danny DEVito Admin Panel
            </h1>
            <div className="flex items-center gap-2">
              <Link href="/" className="px-3 py-1 bg-[#c0c0c0] border-2 text-sm text-black" style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}>
                ← Home
              </Link>
              <WalletMultiButton />
            </div>
          </div>

          {!connected && (
            <div className="bg-[#FFFFCC] border border-[#808080] p-3 text-sm text-black">
              Connect an admin wallet to access controls.
            </div>
          )}

          {error && (
            <div className="bg-[#FFEEEE] border border-[#FF0000] p-2 text-sm text-black mb-2">
              <strong>Error:</strong> {error}
            </div>
          )}

          {success && (
            <div className="bg-[#EEFFEE] border border-[#00FF00] p-2 text-sm text-black mb-2">
              {success}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080]">
            <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Treasury</div>
            <div className="p-3 text-sm text-black">
              {treasury ? (
                <div className="space-y-2">
                  <div><strong>Address:</strong> <span className="font-mono text-xs">{shortAddr(treasury.address)}</span></div>
                  <div><strong>Balance:</strong> {treasury.balanceSol} SOL ({treasury.balanceLamports.toLocaleString()} lamports)</div>
                  
                  <div className="border-t border-[#808080] pt-2 mt-2">
                    <div className="font-bold mb-1">Withdraw SOL</div>
                    <input
                      type="text"
                      placeholder="Destination wallet"
                      value={withdrawForm.destinationWallet}
                      onChange={(e) => setWithdrawForm((f) => ({ ...f, destinationWallet: e.target.value }))}
                      className="w-full px-2 py-1 border border-[#808080] bg-white text-black text-xs mb-1"
                    />
                    <input
                      type="number"
                      placeholder="Amount (lamports)"
                      value={withdrawForm.amountLamports}
                      onChange={(e) => setWithdrawForm((f) => ({ ...f, amountLamports: e.target.value }))}
                      className="w-full px-2 py-1 border border-[#808080] bg-white text-black text-xs mb-1"
                    />
                    <button
                      onClick={handleWithdraw}
                      disabled={loading || !connected}
                      className="px-3 py-1 bg-[#c0c0c0] border-2 text-xs font-bold text-black disabled:opacity-50"
                      style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                    >
                      {loading ? "..." : "Withdraw"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-600">Loading treasury...</div>
              )}
            </div>
          </div>

          <div className="bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080]">
            <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Launch Token</div>
            <div className="p-3 text-sm text-black space-y-2">
              <input
                type="text"
                placeholder="Token Name (max 32 chars)"
                value={launchForm.name}
                onChange={(e) => setLaunchForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-2 py-1 border border-[#808080] bg-white text-black text-xs"
              />
              <input
                type="text"
                placeholder="Symbol (max 10 chars)"
                value={launchForm.symbol}
                onChange={(e) => setLaunchForm((f) => ({ ...f, symbol: e.target.value }))}
                className="w-full px-2 py-1 border border-[#808080] bg-white text-black text-xs"
              />
              <input
                type="text"
                placeholder="Metadata URI (https://...)"
                value={launchForm.uri}
                onChange={(e) => setLaunchForm((f) => ({ ...f, uri: e.target.value }))}
                className="w-full px-2 py-1 border border-[#808080] bg-white text-black text-xs"
              />
              <input
                type="number"
                placeholder="Initial buy (lamports)"
                value={launchForm.spendableSolLamports}
                onChange={(e) => setLaunchForm((f) => ({ ...f, spendableSolLamports: e.target.value }))}
                className="w-full px-2 py-1 border border-[#808080] bg-white text-black text-xs"
              />
              <button
                onClick={handleLaunch}
                disabled={loading || !connected}
                className="px-4 py-1 bg-[#c0c0c0] border-2 text-xs font-bold text-black disabled:opacity-50"
                style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
              >
                {loading ? "Launching..." : "🚀 Launch on Pump.fun"}
              </button>
            </div>
          </div>

          <div className="bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080]">
            <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Distribute Tokens</div>
            <div className="p-3 text-sm text-black space-y-2">
              <select
                value={selectedLaunchId}
                onChange={(e) => setSelectedLaunchId(e.target.value)}
                className="w-full px-2 py-1 border border-[#808080] bg-white text-black text-xs"
              >
                <option value="">Select a launch...</option>
                {launches.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} (${l.ticker}) - {shortAddr(l.mint)}
                  </option>
                ))}
              </select>
              <div className="text-xs text-gray-600">
                Distributes 3% of token supply to all stakers based on weighted stake.
              </div>
              <button
                onClick={handleDistribute}
                disabled={loading || !connected || !selectedLaunchId}
                className="px-4 py-1 bg-[#c0c0c0] border-2 text-xs font-bold text-black disabled:opacity-50"
                style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
              >
                {loading ? "Distributing..." : "💰 Distribute to Stakers"}
              </button>
            </div>
          </div>

          <div className="bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080]">
            <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Recent Launches</div>
            <div className="p-2 text-xs text-black max-h-48 overflow-auto">
              {launches.length === 0 ? (
                <div className="text-gray-600 text-center py-4">No launches yet</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[#e0e0e0]">
                      <th className="border border-[#808080] px-1 py-0.5 text-left">Name</th>
                      <th className="border border-[#808080] px-1 py-0.5 text-left">Ticker</th>
                      <th className="border border-[#808080] px-1 py-0.5 text-left">Mint</th>
                      <th className="border border-[#808080] px-1 py-0.5 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {launches.slice(0, 10).map((l) => (
                      <tr key={l.id}>
                        <td className="border border-[#808080] px-1 py-0.5">{l.name}</td>
                        <td className="border border-[#808080] px-1 py-0.5">${l.ticker}</td>
                        <td className="border border-[#808080] px-1 py-0.5 font-mono">
                          <a href={l.pumpUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                            {shortAddr(l.mint)}
                          </a>
                        </td>
                        <td className="border border-[#808080] px-1 py-0.5">
                          {l.launchedAt ? new Date(l.launchedAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#c0c0c0] border-2 border-white border-r-[#808080] border-b-[#808080] mt-4">
          <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Recent Allocations</div>
          <div className="p-2 text-xs text-black max-h-64 overflow-auto">
            {allocations.length === 0 ? (
              <div className="text-gray-600 text-center py-4">No allocations yet</div>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#e0e0e0]">
                    <th className="border border-[#808080] px-1 py-0.5 text-left">Wallet</th>
                    <th className="border border-[#808080] px-1 py-0.5 text-left">Token</th>
                    <th className="border border-[#808080] px-1 py-0.5 text-left">Amount</th>
                    <th className="border border-[#808080] px-1 py-0.5 text-left">Multiplier</th>
                    <th className="border border-[#808080] px-1 py-0.5 text-left">TX</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.slice(0, 20).map((a) => (
                    <tr key={a.id}>
                      <td className="border border-[#808080] px-1 py-0.5 font-mono">{shortAddr(a.wallet)}</td>
                      <td className="border border-[#808080] px-1 py-0.5">${a.launchTicker}</td>
                      <td className="border border-[#808080] px-1 py-0.5">{a.tokenAmount.toLocaleString()}</td>
                      <td className="border border-[#808080] px-1 py-0.5">{a.multiplier}x</td>
                      <td className="border border-[#808080] px-1 py-0.5 font-mono">
                        {a.claimTxSignature ? (
                          <a
                            href={`https://solscan.io/tx/${a.claimTxSignature}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            {shortAddr(a.claimTxSignature)}
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="win-taskbar">
        <Link href="/" className="win-start-btn">
          <img src="/1.png" alt="" className="h-4" />
          <span>Start</span>
        </Link>
        <div className="win-taskbar-items">
          <div className="win-taskbar-item active">
            <span>⚙️</span>
            <span>Admin Panel</span>
          </div>
        </div>
        <div className="win-taskbar-clock">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
