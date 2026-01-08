"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import IEBrowser from "@/components/IEBrowser";

function formatCountdown(ms) {
  const v = Math.max(0, Number(ms) || 0);
  const totalSeconds = Math.floor(v / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `~${h}h ${m}m`;
}

function LaunchCard({ launch }) {
  const statusColors = {
    draft: "bg-[#808080]",
    pending: "bg-[#FFD700]",
    launched: "bg-[#00FF00]",
    failed: "bg-[#FF0000]",
  };

  return (
    <div className="bg-[#c0c0c0] border-2 p-2" style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-black">{launch.name}</div>
          <div className="text-xs text-[#000080] font-mono">${launch.ticker}</div>
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-bold text-black ${statusColors[launch.status] || statusColors.draft}`}>
          {(launch.status || "draft").toUpperCase()}
        </span>
      </div>

      <div className="mt-2 text-xs text-black space-y-0.5">
        <div><span className="text-[#808080]">Created:</span> {new Date(launch.createdAt).toLocaleDateString()}</div>
        {launch.mint && (
          <div className="truncate"><span className="text-[#808080]">Mint:</span> <span className="font-mono text-[10px]">{launch.mint}</span></div>
        )}
        {launch.pumpUrl && (
          <div>
            <a href={launch.pumpUrl} target="_blank" rel="noreferrer" className="text-[#000080] underline hover:text-[#0000FF]">
              View on Pump.fun →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VaultPage() {
  const { connected } = useWallet();
  const [launches, setLaunches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [form, setForm] = useState({
    name: "",
    ticker: "",
    pumpUrl: "",
    mint: "",
  });

  const canCreate = useMemo(() => {
    return form.name.trim() && form.ticker.trim() && !creating;
  }, [creating, form.name, form.ticker]);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/launches", { cache: "no-store" });
      const data = await res.json();
      setLaunches(Array.isArray(data?.launches) ? data.launches : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function refreshSchedule() {
    try {
      const res = await fetch("/api/launch-schedule", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setSchedule(data);
    } catch {}
  }

  useEffect(() => {
    refreshSchedule();
    const t = setInterval(refreshSchedule, 60_000);
    return () => clearInterval(t);
  }, []);

  async function createDraft(e) {
    e.preventDefault();
    if (!canCreate) return;

    setCreating(true);
    try {
      await fetch("/api/launches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          ticker: form.ticker.trim().replace(/^\$/, ""),
          pumpUrl: form.pumpUrl.trim() || null,
          mint: form.mint.trim() || null,
          status: "draft",
        }),
      });

      setForm({ name: "", ticker: "", pumpUrl: "", mint: "" });
      await refresh();
    } finally {
      setCreating(false);
    }
  }

  const nextLaunchTime = useMemo(() => {
    if (!schedule?.nextLaunchAt) return "Soon™";
    const nextMs = new Date(schedule.nextLaunchAt).getTime();
    const now = Date.now();
    if (nextMs <= now) return "Any moment now...";
    return formatCountdown(nextMs - now);
  }, [schedule]);

  const stats = useMemo(() => {
    const total = launches.length;
    const launched = launches.filter(l => l.status === "launched").length;
    const drafts = launches.filter(l => l.status === "draft").length;
    return { total, launched, drafts };
  }, [launches]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#008080]" />

      {/* Desktop area */}
      <div className="absolute inset-0 pb-7 md:pb-7 pb-9">
        {/* IE Browser Window */}
        <div className="h-full p-2 max-md:p-0">
          <IEBrowser 
            title="Vault - Launch History" 
            url="http://dannydevito.fun/vault"
            onRefresh={refresh}
          >
            {/* Spammy ticker banner */}
            <div className="bg-black text-[10px] font-bold overflow-hidden whitespace-nowrap">
              <marquee behavior="scroll" direction="left" scrollamount="3" className="py-1">
                <span className="text-red-500">🚨 YOU ARE THE 1,000,000th VISITOR! 🚨</span>
                <span className="mx-4 text-green-400">💰 SINGLE MOMS IN YOUR AREA WANT TO TRADE CRYPTO 💰</span>
                <span className="mx-4 text-pink-400">🎰 CLICK HERE TO CLAIM FREE $DEVITO 🎰</span>
                <span className="mx-4 text-cyan-400">🔥 DOCTORS HATE THIS ONE WEIRD TRICK 🔥</span>
                <span className="mx-4 text-orange-400">📈 $DEVITO TO $1 GUARANTEED* 📈</span>
                <span className="mx-4 text-red-400">🚀 NEXT 1000X GEM FOUND 🚀</span>
                <span className="mx-4 text-yellow-300">⬇️ DOWNLOAD MORE HENTAI ⬇️</span>
              </marquee>
            </div>

            {/* Vault content - Orange/Gold theme */}
            <div className="p-4 font-sans text-sm text-black bg-white max-w-3xl mx-auto">
              {/* Page header */}
              <div className="border-b-2 border-[#D35400] pb-2 mb-4">
                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-[#D35400] flex items-center gap-2">
                    <img src="/DEVito.png" alt="" className="h-8" />
                    The Vault
                  </h1>
                  <WalletMultiButton className="!bg-[#D35400] !h-7 !text-xs" />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Where I keep the goods ~ every 72 hours I crawl outta here with a new coin
                </p>
              </div>

              {/* Status banner */}
              <div className="bg-[#D35400] text-white p-2 mb-4 text-center font-bold text-sm">
                THE VAULT IS OPEN | New launches every 72 hours | Stakers get the good seats
              </div>

              {/* Info box */}
              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#D35400] text-white px-3 py-1 font-bold text-sm">
                  How The Vault Works
                </div>
                <div className="bg-[#FFF3E8] p-3 text-xs text-black">
                  <p className="mb-2">
                    * Stakers get the good seats, everyone else... well, because of the implication *
                  </p>
                  <p>
                    I'm in the basement eating cat food for inspiration. Every 72 hours I crawl out with a magnum memecoin.
                  </p>
                </div>
              </div>

              {/* Stats table */}
              <table className="w-full border-collapse mb-4">
                <tbody>
                  <tr className="bg-[#D35400] text-white">
                    <td className="border border-[#808080] px-3 py-1 font-bold" colSpan={4}>
                      Vault Statistics
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0] w-1/4"><strong>Total Launches:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white text-[#D35400] font-bold font-mono">
                      {stats.total}
                    </td>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0] w-1/4"><strong>Live:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white text-green-600 font-bold font-mono">
                      {stats.launched}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0]"><strong>Drafts:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white font-mono">
                      {stats.drafts}
                    </td>
                    <td className="border border-[#808080] px-3 py-2 bg-[#c0c0c0]"><strong>Next Launch:</strong></td>
                    <td className="border border-[#808080] px-3 py-2 bg-white text-[#D35400] font-bold font-mono">
                      {nextLaunchTime}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Launch history */}
              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#D35400] text-white px-3 py-1 font-bold text-sm">
                  Launch History
                </div>
                <div className="bg-white p-2 max-h-[40vh] overflow-auto">
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="animate-pulse">Loading launches...</div>
                    </div>
                  ) : launches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div className="mb-2">
                        <img src="/danny-decheeto.png" alt="" className="w-16 h-16 mx-auto opacity-50" />
                      </div>
                      <div className="font-bold">No launches yet...</div>
                      <div className="text-sm">I'm in the basement eating cat food for inspiration.</div>
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#c0c0c0]">
                          <th className="border border-[#808080] px-2 py-1 text-left">Name</th>
                          <th className="border border-[#808080] px-2 py-1 text-left">Ticker</th>
                          <th className="border border-[#808080] px-2 py-1 text-left">Status</th>
                          <th className="border border-[#808080] px-2 py-1 text-left">Date</th>
                          <th className="border border-[#808080] px-2 py-1 text-left">Link</th>
                        </tr>
                      </thead>
                      <tbody>
                        {launches.map((l) => (
                          <tr key={l.id} className="hover:bg-[#FFF3E8]">
                            <td className="border border-[#808080] px-2 py-1 font-bold">{l.name}</td>
                            <td className="border border-[#808080] px-2 py-1 text-[#D35400] font-mono">${l.ticker}</td>
                            <td className="border border-[#808080] px-2 py-1">
                              <span className={`px-1 ${
                                l.status === "launched" ? "bg-green-500 text-white" :
                                l.status === "pending" ? "bg-yellow-400 text-black" :
                                l.status === "failed" ? "bg-red-500 text-white" :
                                "bg-gray-400 text-white"
                              }`}>
                                {(l.status || "draft").toUpperCase()}
                              </span>
                            </td>
                            <td className="border border-[#808080] px-2 py-1">{new Date(l.createdAt).toLocaleDateString()}</td>
                            <td className="border border-[#808080] px-2 py-1">
                              {l.pumpUrl ? (
                                <a href={l.pumpUrl} target="_blank" rel="noreferrer" className="text-[#D35400] underline hover:text-[#A04000]">
                                  Pump.fun
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

              {/* Admin section */}
              <details className="border-2 border-[#808080]">
                <summary className="bg-[#c0c0c0] px-3 py-1 font-bold text-sm cursor-pointer hover:bg-[#d0d0d0]">
                  [+] Admin Panel - Add Launch Draft
                </summary>
                <form onSubmit={createDraft} className="p-3 bg-white">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="font-bold text-xs block mb-1 text-black">Coin Name:</label>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="w-full px-2 py-1 border-2 border-[#808080] bg-white text-black"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-xs block mb-1 text-black">Ticker:</label>
                      <input
                        value={form.ticker}
                        onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value }))}
                        className="w-full px-2 py-1 border-2 border-[#808080] bg-white text-black"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-xs block mb-1 text-black">Pump URL:</label>
                      <input
                        value={form.pumpUrl}
                        onChange={(e) => setForm((p) => ({ ...p, pumpUrl: e.target.value }))}
                        className="w-full px-2 py-1 border-2 border-[#808080] bg-white text-black"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-xs block mb-1 text-black">Mint:</label>
                      <input
                        value={form.mint}
                        onChange={(e) => setForm((p) => ({ ...p, mint: e.target.value }))}
                        className="w-full px-2 py-1 border-2 border-[#808080] bg-white text-black"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={refresh}
                      className="px-4 py-1 bg-[#c0c0c0] border-2 text-xs font-bold text-black"
                      style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                    >
                      Refresh
                    </button>
                    <button
                      type="submit"
                      disabled={!canCreate}
                      className="px-4 py-1 bg-[#D35400] text-white border-2 text-xs font-bold disabled:opacity-50"
                      style={{ borderColor: "#F39C12 #A04000 #A04000 #F39C12" }}
                    >
                      {creating ? "Saving..." : "Save Draft"}
                    </button>
                  </div>
                </form>
              </details>

              {/* Footer */}
              <div className="mt-4 pt-2 border-t-2 border-[#808080] text-xs text-gray-500 text-center">
                <marquee>~ I'm the Trash Man of crypto! I come out, I throw coins all over the ring! ~ OY OY OY! ~ Stake or get left behind, kid ~</marquee>
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
            <span>Vault - Internet Explorer</span>
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
