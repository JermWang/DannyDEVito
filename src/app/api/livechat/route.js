import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { appendJsonArrayItem, readJsonFile } from "@/lib/fileDb";

const LIVECHAT_FILE = "livechat.json";

export async function GET(req) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(200, Number(limitRaw || 50) || 50));

  const messages = await readJsonFile(LIVECHAT_FILE, []);
  const list = Array.isArray(messages) ? messages : [];

  const sorted = list.slice().sort((a, b) => {
    const at = new Date(a?.createdAt || 0).getTime();
    const bt = new Date(b?.createdAt || 0).getTime();
    return at - bt;
  });

  const recent = sorted.slice(-limit);

  return NextResponse.json({ ok: true, messages: recent });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const username = typeof body?.username === "string" ? body.username.trim().slice(0, 32) : "anon";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";
  const color = typeof body?.color === "string" ? body.color : null;

  if (!message) {
    return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
  }

  const entry = {
    id: crypto.randomUUID(),
    username: username || "anon",
    message,
    color,
    createdAt: new Date().toISOString(),
  };

  await appendJsonArrayItem(LIVECHAT_FILE, entry);

  return NextResponse.json({ ok: true, entry });
}
