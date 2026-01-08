"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import IEBrowser from "@/components/IEBrowser";

function shortAddr(addr) {
  if (!addr) return "—";
  const s = String(addr);
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function buildAuthMessage(wallet, nonce) {
  return `Sign this message to verify wallet ownership for Danny DEVito Chat Logs.\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

export default function ChatLogsPage() {
  const { publicKey, signMessage, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [authData, setAuthData] = useState(null);

  const wallet = publicKey?.toBase58() || "";
  const canQuery = useMemo(() => connected && wallet.length > 10 && !!signMessage, [connected, wallet, signMessage]);

  async function signAndAuth() {
    if (!canQuery || !signMessage) return null;
    setLoading(true);
    setError(null);

    try {
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const message = buildAuthMessage(wallet, nonce);
      const messageBytes = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(messageBytes);
      const signature = Buffer.from(signatureBytes).toString("base64");
      const auth = { wallet, nonce, signature };
      setAuthData(auth);
      return auth;
    } catch (err) {
      setError("signature_rejected");
      setLoading(false);
      return null;
    }
  }

  async function loadSessions(existingAuth = null) {
    const auth = existingAuth || authData || (await signAndAuth());
    if (!auth) return;

    setLoading(true);
    setError(null);
    setSelectedSession("");
    setMessages([]);

    try {
      const params = new URLSearchParams({
        wallet: auth.wallet,
        nonce: auth.nonce,
        signature: auth.signature,
        limit: "100",
      });
      const res = await fetch(`/api/chatlogs?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setGate(data?.gate || null);
        setSessions([]);
        setError(data?.error || "failed");
        return;
      }
      setGate(data?.gate || null);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch {
      setGate(null);
      setSessions([]);
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }

  async function openSession(sessionId) {
    const auth = authData || (await signAndAuth());
    if (!auth || !sessionId) return;

    setSelectedSession(sessionId);
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        wallet: auth.wallet,
        nonce: auth.nonce,
        signature: auth.signature,
        sessionId,
      });
      const res = await fetch(`/api/chatlogs?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMessages([]);
        setError(data?.error || "failed");
        return;
      }
      setGate(data?.gate || null);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch {
      setMessages([]);
      setError("network_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setAuthData(null);
    setSessions([]);
    setMessages([]);
    setGate(null);
    setError(null);
    setSelectedSession("");
  }, [wallet]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 bg-[#008080]" />

      <div className="absolute inset-0 pb-7 md:pb-7 pb-9">
        <div className="h-full p-2 max-md:p-0">
          <IEBrowser
            title="Holder Chat Logs"
            url="http://dannydevito.fun/chat-logs"
            onRefresh={() => {
              if (selectedSession) openSession(selectedSession);
              else loadSessions();
            }}
          >
            <div className="p-4 font-sans text-sm text-black bg-white">
              <div className="border-b-2 border-[#000080] pb-2 mb-4">
                <h1 className="text-2xl font-bold text-[#000080] flex items-center gap-2">
                  <img src="/DEVito.png" alt="" className="h-8" />
                  Holder Chat Logs
                </h1>
                <p className="text-xs text-gray-600 mt-1">
                  Conversations from holders. This is the raw sludge that eventually becomes the launches every 72 hours.
                </p>
              </div>

              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">
                  Token Gate
                </div>
                <div className="bg-[#E8E8FF] p-3 text-xs text-black">
                  <div className="flex flex-col gap-3">
                    {!connected ? (
                      <div className="flex flex-col items-center gap-2 py-4">
                        <p className="text-center text-gray-700">Connect your wallet to verify holder status and view chat logs.</p>
                        <WalletMultiButton />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 uppercase font-bold">Wallet:</span>
                            <span className="font-mono text-xs">{shortAddr(wallet)}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => loadSessions()}
                              disabled={!canQuery || loading}
                              className="px-4 py-1 bg-[#c0c0c0] border-2 text-xs font-bold text-black disabled:opacity-50"
                              style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                            >
                              {loading ? "Loading..." : authData ? "Refresh" : "Sign & Verify"}
                            </button>
                            <WalletMultiButton />
                          </div>
                        </div>

                        {gate ? (
                          <div className="bg-white border border-[#808080] p-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="text-[10px] text-gray-600 uppercase font-bold">Mint</div>
                                <div className="font-mono text-[10px]">{shortAddr(gate.mint)}</div>
                              </div>
                              <div>
                                <div className="text-[10px] text-gray-600 uppercase font-bold">Balance</div>
                                <div className={`font-bold ${gate.isHolder ? "text-green-600" : "text-red-600"}`}>
                                  {Number(gate.amount || 0).toLocaleString()} / {Number(gate.minAmount || 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {error ? (
                      <div className="bg-[#FFEEEE] border border-[#FF0000] p-2 text-xs text-black">
                        <strong>Error:</strong> {String(error)}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border-2 border-[#808080]">
                  <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Sessions</div>
                  <div className="bg-white p-2 max-h-[52vh] overflow-auto">
                    {sessions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">
                        {loading ? "Loading..." : "No sessions (or you’re not gated in)."}
                      </div>
                    ) : (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#c0c0c0]">
                            <th className="border border-[#808080] px-2 py-1 text-left">When</th>
                            <th className="border border-[#808080] px-2 py-1 text-left">Wallet</th>
                            <th className="border border-[#808080] px-2 py-1 text-left">Preview</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessions.map((s) => (
                            <tr
                              key={s.sessionId}
                              className={`cursor-pointer hover:bg-[#E8E8FF] ${selectedSession === s.sessionId ? "bg-[#E8E8FF]" : ""}`}
                              onClick={() => openSession(s.sessionId)}
                            >
                              <td className="border border-[#808080] px-2 py-1 whitespace-nowrap">
                                {s.lastAt ? new Date(s.lastAt).toLocaleString() : "—"}
                              </td>
                              <td className="border border-[#808080] px-2 py-1 font-mono text-[10px]">
                                {shortAddr(s.wallet)}
                              </td>
                              <td className="border border-[#808080] px-2 py-1">
                                {(s.preview || "").toString().slice(0, 120) || "…"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="border-2 border-[#808080]">
                  <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Transcript</div>
                  <div className="bg-white p-2 max-h-[52vh] overflow-auto">
                    {!selectedSession ? (
                      <div className="text-center py-8 text-gray-500 text-xs">Select a session.</div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 text-xs">{loading ? "Loading..." : "No messages."}</div>
                    ) : (
                      <div className="space-y-2">
                        {messages.map((m) => (
                          <div key={m.id} className="border border-[#808080] p-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-bold">
                                <span
                                  className={`px-2 py-0.5 ${m.role === "user" ? "bg-[#c0c0c0]" : "bg-[#D9F2D9]"}`}
                                >
                                  {m.role}
                                </span>
                                <span className="ml-2 font-mono text-[10px] text-[#000080]">{shortAddr(m.wallet)}</span>
                              </div>
                              <div className="text-[10px] text-gray-600">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</div>
                            </div>
                            <div className="mt-1 text-xs text-black whitespace-pre-wrap">{m.content}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 border-t-2 border-[#808080] text-xs text-gray-500 text-center">
                <marquee>~ Holder logs only ~ The sludge becomes the launch ~ 72 hours, kid ~</marquee>
              </div>
            </div>
          </IEBrowser>
        </div>
      </div>

      <div className="win-taskbar">
        <Link href="/" className="win-start-btn">
          <img src="/1.png" alt="" className="h-4" />
          <span>Start</span>
        </Link>
        <div className="win-taskbar-items">
          <div className="win-taskbar-item active">
            <span>🗃️</span>
            <span>Chat Logs - Internet Explorer</span>
          </div>
        </div>
        <div className="win-taskbar-clock">
          {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div className="crt-chromatic" />
      <div className="crt-reflection" />
      <div className="crt-glow" />
      <div className="crt-screen" />
      <div className="crt-overlay" />
    </div>
  );
}
