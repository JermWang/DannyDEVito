"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const COLORS = [
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#96ceb4",
  "#ffeaa7",
  "#dfe6e9",
  "#fd79a8",
  "#a29bfe",
  "#00b894",
  "#e17055",
  "#74b9ff",
  "#ff7675",
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function ChatMessage({ msg, windowMode = false }) {
  const color = msg.color || "#adadb8";

  if (windowMode) {
    return (
      <div className="flex gap-1 px-1 py-0.5 text-xs hover:bg-[#c0c0c0]">
        <span className="shrink-0 font-bold" style={{ color }}>
          {msg.username}:
        </span>
        <span className="text-black break-words">{msg.message}</span>
      </div>
    );
  }

  return (
    <div className="group flex gap-2 px-3 py-1 hover:bg-[var(--tw-surface-alt)]">
      <span className="shrink-0 font-semibold" style={{ color }}>
        {msg.username}:
      </span>
      <span className="text-[var(--tw-text-muted)] break-words">{msg.message}</span>
    </div>
  );
}

export default function LiveChat({ windowMode = false }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [username, setUsername] = useState("");
  const [userColor, setUserColor] = useState(() => getRandomColor());
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const displayName = useMemo(() => {
    return username.trim() || "anon";
  }, [username]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/livechat?limit=100", { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data?.messages)) {
        setMessages(data.messages);
        setConnected(true);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const msg = text.trim();
    if (!msg || sending) return;

    setSending(true);
    setText("");

    try {
      await fetch("/api/livechat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: displayName,
          message: msg,
          color: userColor,
        }),
      });
      await fetchMessages();
    } finally {
      setSending(false);
    }
  }

  if (windowMode) {
    return (
      <div className="flex h-full flex-col bg-white">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-1 bg-white">
          {messages.length === 0 ? (
            <div className="px-2 py-4 text-center text-xs text-[#808080]">
              It's quiet in here. Too quiet. Start screamin'!
            </div>
          ) : (
            messages.map((m) => <ChatMessage key={m.id} msg={m} windowMode />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Username + Input */}
        <div className="p-2 bg-[#c0c0c0] border-t border-[#808080]">
          <div className="mb-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setUserColor(getRandomColor())}
              className="h-4 w-4 border border-[#808080]"
              style={{ background: userColor }}
              title="Change color"
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              maxLength={20}
              className="flex-1 px-1 py-0.5 text-xs border border-[#808080] bg-white text-black"
            />
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Scream into the void..."
              maxLength={500}
              className="flex-1 px-2 py-1 text-sm border-2 bg-white text-black"
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
              disabled={!text.trim() || sending}
              className="px-2 py-1 text-xs bg-[#c0c0c0] border-2 font-bold"
              style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
            >
              Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--tw-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--tw-text)]">Stream Chat</span>
          <span className="badge badge-live">
            <span className="h-2 w-2 rounded-full bg-white animate-live-pulse" />
            LIVE
          </span>
        </div>
        <div className="text-xs text-[var(--tw-text-dim)]">
          {connected ? `${messages.length} msgs` : "connecting..."}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2 text-sm">
        {messages.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-[var(--tw-text-dim)]">
            The Telegram's dead, kid. Be the first degenerate to say something.
          </div>
        ) : (
          messages.map((m) => <ChatMessage key={m.id} msg={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Username + Input */}
      <div className="border-t border-[var(--tw-border)] p-3">
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUserColor(getRandomColor())}
            className="h-5 w-5 rounded-full border border-[var(--tw-border)] transition hover:scale-110"
            style={{ background: userColor }}
            title="Change color"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            maxLength={20}
            className="input flex-1 py-1 text-xs"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Scream into the void..."
            maxLength={500}
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
            disabled={!text.trim() || sending}
            className="btn-primary px-4"
          >
            Chat
          </button>
        </div>
      </div>
    </div>
  );
}
