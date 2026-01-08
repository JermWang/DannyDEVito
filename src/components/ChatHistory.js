"use client";

import { useEffect, useMemo, useState } from "react";

function getFirstLine(text) {
  if (!text) return "";
  const s = String(text);
  const line = s.split(/\r?\n/)[0] || "";
  return line.trim();
}

export default function ChatHistory({ refreshToken }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const displayItems = useMemo(() => {
    return Array.isArray(items) ? items : [];
  }, [items]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/chat?limit=25", { cache: "no-store" });
      const data = await res.json();
      setItems(Array.isArray(data?.chats) ? data.chats : []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshToken]);

  return (
    <section className="rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">Recent chats</div>
        <div className="text-xs text-white/50">
          {loading ? "Loading…" : `${displayItems.length}`}
        </div>
      </div>

      <div className="mt-4 max-h-[520px] overflow-y-auto rounded-2xl ring-1 ring-white/10">
        <div className="divide-y divide-white/10">
          {displayItems.length === 0 && !loading ? (
            <div className="p-5 text-sm text-white/60">No chats yet.</div>
          ) : null}

          {displayItems.map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-white/80">
                    {getFirstLine(c.message) || "…"}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    {c.createdAt ? new Date(c.createdAt).toLocaleString() : ""}
                  </div>
                </div>
                {c.influencesLaunch ? (
                  <div className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                    holder
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
