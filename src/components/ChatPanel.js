"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function MessageBubble({ role, content, windowMode = false }) {
  const isUser = role === "user";

  if (windowMode) {
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
  const [messages, setMessages] = useState(() => [
    {
      role: "assistant",
      content:
        "Listen here, kid. I'm Danny DEVito, the Trash Man of crypto. You talk, I listen. Every 72 hours I crawl outta my couch and drop a magnum memecoin on Pump.fun. Stakers? They get the good seats. Everyone else? Well... because of the implication.",
    },
  ]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const canSend = useMemo(() => !sending && text.trim().length > 0, [sending, text]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!canSend) return;

    const userMessage = text.trim();
    setText("");
    setSending(true);

    setMessages((prev) => prev.concat([{ role: "user", content: userMessage }]));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          wallet: null,
          influencesLaunch: false,
        }),
      });

      const data = await res.json();
      const reply = typeof data?.reply === "string" ? data.reply : "...";

      setMessages((prev) => prev.concat([{ role: "assistant", content: reply }]));

      if (typeof onSent === "function") {
        onSent({
          ok: Boolean(data?.ok),
          chatId: data?.chatId,
          message: userMessage,
          reply,
        });
      }
    } catch (e) {
      setMessages((prev) =>
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

  if (windowMode) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex-1 overflow-y-auto p-2 bg-white">
          <div className="grid gap-2">
            {messages.map((m, idx) => (
              <MessageBubble key={idx} role={m.role} content={m.content} windowMode />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
        <div className="p-2 bg-[#c0c0c0] border-t border-[#808080] flex gap-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Talk to the Trash Man..."
            className="flex-1 px-2 py-1 text-sm border-2 border-[#808080] bg-white text-black"
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
            className="px-3 py-1 text-sm bg-[#c0c0c0] border-2 font-bold"
            style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
          >
            Send
          </button>
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
