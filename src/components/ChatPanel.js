"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

const COLORS = [
  "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7",
  "#dfe6e9", "#fd79a8", "#a29bfe", "#00b894", "#e17055",
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function makeSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function MessageBubble({ role, content, windowMode = false, username, color }) {
  const isUser = role === "user";

  if (windowMode) {
    if (role === "group") {
      return (
        <div className="flex gap-1 px-1 py-0.5 text-xs hover:bg-[#c0c0c0]">
          <span className="shrink-0 font-bold" style={{ color: color || "#808080" }}>
            {username || "anon"}:
          </span>
          <span className="text-black break-words">{content}</span>
        </div>
      );
    }
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={
            isUser
              ? "max-w-[85%] px-2 py-1 text-sm bg-[#000080] text-white"
              : "max-w-[85%] px-2 py-1 text-sm bg-[#c0c0c0] text-black border border-[#808080]"
          }
        >
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg bg-[var(--tw-accent)] px-3 py-2 text-sm text-white"
            : "max-w-[85%] rounded-lg bg-[var(--tw-surface-alt)] px-3 py-2 text-sm text-[var(--tw-text)]"
        }
      >
        {content}
      </div>
    </div>
  );
}

export default function ChatPanel({
  compact = false,
  avatarSrc = null,
  avatarAlt = "",
  onSent,
  windowMode = false,
}) {
  const { publicKey, connected } = useWallet();
  const [mode, setMode] = useState("group");
  const [privateMessages, setPrivateMessages] = useState(() => [
    {
      role: "assistant",
      content:
        "Listen here, kid. I'm Danny DEVito, the Trash Man of crypto. You talk, I listen. Every 72 hours I crawl outta my couch and drop a magnum memecoin on Pump.fun. Stakers? They get the good seats. Everyone else? Well... because of the implication.",
    },
  ]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [userColor, setUserColor] = useState(() => getRandomColor());
  const [cooldown, setCooldown] = useState(0);
  const [banInfo, setBanInfo] = useState(null);
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const pollRef = useRef(null);

  const wallet = connected && publicKey ? publicKey.toBase58() : "";
  const canSend = useMemo(() => {
    if (sending || !text.trim()) return false;
    if (mode === "group") return !!wallet && cooldown === 0 && !banInfo;
    return true;
  }, [sending, text, mode, wallet, cooldown, banInfo]);

  const checkIfNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    return container.scrollHeight - container.scrollTop - container.clientHeight < 60;
  }, []);

  const handleScroll = useCallback(() => {
    isNearBottomRef.current = checkIfNearBottom();
  }, [checkIfNearBottom]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [privateMessages.length, groupMessages.length]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existingSession = window.localStorage.getItem("dd_chat_session") || "";
    const nextSession = existingSession || makeSessionId();
    if (!existingSession) {
      window.localStorage.setItem("dd_chat_session", nextSession);
    }
    setSessionId(nextSession);
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
      return () => clearTimeout(t);
    }
  }, [cooldown]);

  useEffect(() => {
    if (banInfo?.expiresIn > 0) {
      const t = setTimeout(() => {
        setBanInfo((b) => (b ? { ...b, expiresIn: b.expiresIn - 1 } : null));
      }, 1000);
      return () => clearTimeout(t);
    } else if (banInfo?.expiresIn === 0) {
      setBanInfo(null);
    }
  }, [banInfo]);

  const fetchGroupMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/holders-chat?limit=100", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data?.messages)) {
        setGroupMessages(data.messages.map((m) => ({
          role: "group",
          content: m.message,
          username: m.nickname || m.walletShort,
          color: m.color,
          id: m.id,
        })));
      }
    } catch (e) {
      console.error("Failed to fetch group messages:", e);
    }
  }, []);

  useEffect(() => {
    if (mode === "group") {
      fetchGroupMessages();
      pollRef.current = setInterval(fetchGroupMessages, 3000);
      return () => clearInterval(pollRef.current);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }, [mode, fetchGroupMessages]);

  async function send() {
    if (!canSend) return;

    const userMessage = text.trim();
    setText("");
    setSending(true);

    if (mode === "group") {
      try {
        const res = await fetch("/api/holders-chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            wallet,
            nickname: wallet.slice(0, 4) + "..." + wallet.slice(-4),
            message: userMessage,
            color: userColor,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (data.error === "cooldown" && data.waitSeconds) {
            setCooldown(data.waitSeconds);
          } else if (data.error === "banned") {
            setBanInfo({ reason: data.reason, expiresIn: data.expiresIn });
          }
        } else {
          setCooldown(3);
        }

        await fetchGroupMessages();
      } catch (e) {
        console.error("Group send error:", e);
      } finally {
        setSending(false);
      }
      return;
    }

    setPrivateMessages((prev) => prev.concat([{ role: "user", content: userMessage }]));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          wallet: wallet || null,
          sessionId,
        }),
      });

      const data = await res.json();
      const reply = typeof data?.reply === "string" ? data.reply : "...";

      setPrivateMessages((prev) => prev.concat([{ role: "assistant", content: reply }]));

      if (typeof onSent === "function") {
        onSent({
          ok: Boolean(data?.ok),
          chatId: data?.chatId,
          message: userMessage,
          reply,
        });
      }
    } catch (e) {
      setPrivateMessages((prev) =>
        prev.concat([
          {
            role: "assistant",
            content:
              "Whoopsie doodle! Something went wrong. My rum ham must've spilled on the servers. Try again, kid.",
          },
        ]),
      );
    } finally {
      setSending(false);
    }
  }

  const displayMessages = mode === "group" ? groupMessages : privateMessages;

  if (windowMode) {
    return (
      <div className="flex flex-col h-full bg-white">
        {/* Mode Toggle */}
        <div className="flex bg-[#c0c0c0] border-b border-[#808080]">
          <button
            type="button"
            onClick={() => setMode("group")}
            className={`flex-1 px-2 py-1 text-[10px] font-bold border-r border-[#808080] ${
              mode === "group" ? "bg-white text-[#000080]" : "bg-[#c0c0c0] text-black hover:bg-[#d0d0d0]"
            }`}
          >
            👥 Holders Chat
          </button>
          <button
            type="button"
            onClick={() => setMode("private")}
            className={`flex-1 px-2 py-1 text-[10px] font-bold ${
              mode === "private" ? "bg-white text-[#000080]" : "bg-[#c0c0c0] text-black hover:bg-[#d0d0d0]"
            }`}
          >
            🤖 Private (Danny AI)
          </button>
        </div>

        {/* Messages */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-2 bg-white"
        >
          {mode === "group" && displayMessages.length === 0 ? (
            <div className="text-center text-xs text-[#808080] py-4">
              {wallet ? "No messages yet. Start the conversation!" : "Connect wallet to join the holders chat"}
            </div>
          ) : (
            <div className="grid gap-1">
              {displayMessages.map((m, idx) => (
                <MessageBubble
                  key={m.id || idx}
                  role={m.role}
                  content={m.content}
                  username={m.username}
                  color={m.color}
                  windowMode
                />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-2 bg-[#c0c0c0] border-t border-[#808080]">
          {mode === "group" ? (
            wallet ? (
              <div className="text-[10px] text-gray-600 mb-1">
                Chatting as: <span className="font-mono" style={{ color: userColor }}>{wallet.slice(0,4)}…{wallet.slice(-4)}</span>
              </div>
            ) : (
              <div className="text-[10px] text-red-600 mb-1">⚠️ Connect wallet to chat</div>
            )
          ) : (
            <div className="text-[10px] text-gray-500 mb-1">Private chat with Danny AI</div>
          )}

          {banInfo ? (
            <div className="text-xs text-red-600 bg-red-100 border border-red-400 p-2 text-center">
              🚫 {banInfo.reason}
              {banInfo.expiresIn > 0 && (
                <span className="block mt-1 font-mono">
                  {Math.floor(banInfo.expiresIn / 60)}:{String(banInfo.expiresIn % 60).padStart(2, "0")}
                </span>
              )}
            </div>
          ) : (
            <div className="flex gap-1">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  mode === "group"
                    ? cooldown > 0 ? `Wait ${cooldown}s...` : (wallet ? "Chat with holders..." : "Connect wallet first")
                    : "Talk to the Trash Man..."
                }
                disabled={mode === "group" && (!wallet || cooldown > 0)}
                className="flex-1 px-2 py-1 text-sm border-2 border-[#808080] bg-white text-black disabled:bg-gray-100"
                style={{ borderColor: "#808080 #ffffff #ffffff #808080" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className="px-3 py-1 text-sm bg-[#c0c0c0] border-2 font-bold disabled:opacity-50"
                style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
              >
                {cooldown > 0 && mode === "group" ? cooldown : "Send"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className={compact ? "" : "grid gap-4"}>
      <div className={compact ? "p-3" : "card p-4"}>
        {!compact ? (
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Chat with Agent</span>
              <span className="badge">MVP</span>
            </div>
          </div>
        ) : null}

        {avatarSrc ? (
          <div className="mb-3 flex items-center justify-center">
            <img
              src={avatarSrc}
              alt={avatarAlt}
              className="h-20 w-20 rounded-xl object-contain ring-2 ring-[var(--tw-accent)] glow-accent-sm"
            />
          </div>
        ) : null}

        <div className={`${compact ? "h-[100px]" : "h-[350px]"} overflow-y-auto rounded-lg bg-[var(--tw-bg)] p-3`}>
          <div className="grid gap-2">
            {messages.map((m, idx) => (
              <MessageBubble key={idx} role={m.role} content={m.content} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Got something to say, kid?"
            className="input flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            className="btn-primary"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
      </div>

      {!compact ? (
        <div className="card-alt p-4 text-xs text-[var(--tw-text-dim)]">
          This is a parody character. Not affiliated with any real person, show, or egg. Definitely not financial advice. I'm the Trash Man, not your accountant.
        </div>
      ) : null}
    </section>
  );
}
