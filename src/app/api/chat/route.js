import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getHolderStatus } from "@/lib/holderGate";

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

let cachedProfile = null;

async function loadPersonalityProfile() {
  if (cachedProfile) return cachedProfile;

  const rel = process.env.AGENT_PROFILE_PATH || "docs/danny_devito_personality.json";
  const filePath = path.join(process.cwd(), rel);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    cachedProfile = JSON.parse(raw);
  } catch {
    cachedProfile = null;
  }

  return cachedProfile;
}

function normalizePhrases(profile) {
  const phrases =
    profile?.character_profile?.mannerisms_speech_patterns?.key_phrases || [];

  if (!Array.isArray(phrases)) return [];

  const blocked = /(rug|drain|scam|grift|steal|fraud)/i;
  return phrases
    .map((p) => (typeof p === "string" ? p : ""))
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !blocked.test(p));
}

function buildParodyReply(userText, phrases) {
  const openers = [
    "Alright listen—",
    "Lemme tell ya something—",
    "Okay. Okay. Hear me out—",
    "Buddy, pal—",
    "This is beautiful chaos—",
  ];

  const vibes = [
    "we make it small, loud, and unforgettable.",
    "we turn that into a coin and a problem for tomorrow.",
    "that idea’s got teeth. I respect it.",
    "I’m not saying it’s smart. I’m saying it’s destiny.",
    "I can smell the pump from here.",
  ];

  const callbacks = [
    "Now give me a name. Something that sounds like trouble.",
    "Hit me with a ticker—four letters, maximum mischief.",
    "Tell me the vibe: cute, cursed, or criminally handsome?",
    "Give me one phrase holders would chant at 3AM.",
    "What’s the one-liner on the meme image?",
  ];

  const sanitized = (userText || "").toString().slice(0, 280);
  const hasTicker = /\$?[A-Z]{3,6}/.test(sanitized);

  const extra = hasTicker
    ? "That ticker? Disgusting. Perfect."
    : "No ticker yet? We’re practically naked.";

  const flavor = Array.isArray(phrases) && phrases.length > 0 ? ` ${pick(phrases)}` : "";

  return `${pick(openers)}${extra} ${pick(vibes)}${flavor} ${pick(callbacks)}`;
}

export async function GET(req) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(100, Number(limitRaw || 25) || 25));

  try {
    const rows = await prisma.dannyChat.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.max(200, limit * 20),
    });

    const sessions = new Map();

    for (const row of rows) {
      if (!row?.sessionId) continue;

      const existing = sessions.get(row.sessionId);

      if (!existing) {
        sessions.set(row.sessionId, {
          id: row.sessionId,
          createdAt: row.createdAt.toISOString(),
          message: row.role === "user" ? row.content : "…",
          influencesLaunch: Boolean(row.wallet),
        });
        continue;
      }

      if (!existing.message || existing.message === "…") {
        if (row.role === "user" && row.content) {
          existing.message = row.content;
        }
      }

      if (!existing.influencesLaunch && row.wallet) {
        existing.influencesLaunch = true;
      }
    }

    const previews = Array.from(sessions.values()).slice(0, limit);

    return NextResponse.json({ ok: true, chats: previews });
  } catch (error) {
    console.error("/api/chat GET failed:", error);
    return NextResponse.json({ ok: false, chats: [], error: "database_error" }, { status: 500 });
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const message = typeof body?.message === "string" ? body.message : "";
  const walletRaw = typeof body?.wallet === "string" ? body.wallet : null;
  const sessionId = typeof body?.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : crypto.randomUUID();

  if (!message.trim()) {
    return NextResponse.json({ ok: false, error: "empty_message" }, { status: 400 });
  }

  let wallet = null;
  if (walletRaw && walletRaw.trim()) {
    const gate = await getHolderStatus(walletRaw.trim());
    if (gate.ok && gate.isHolder) {
      wallet = walletRaw.trim();
    }
  }

  const profile = await loadPersonalityProfile();
  const phrases = normalizePhrases(profile);
  const reply = buildParodyReply(message, phrases);

  const now = new Date();

  try {
    const userEntry = await prisma.dannyChat.create({
      data: {
        sessionId,
        wallet,
        role: "user",
        content: message,
        createdAt: now,
      },
    });

    await prisma.dannyChat.create({
      data: {
        sessionId,
        wallet,
        role: "assistant",
        content: reply,
      },
    });

    return NextResponse.json({
      ok: true,
      reply,
      chatId: userEntry.id,
      sessionId,
    });
  } catch (error) {
    console.error("/api/chat POST failed:", error);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
  }
}
