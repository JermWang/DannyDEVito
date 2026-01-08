import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { appendJsonArrayItem, readJsonFile } from "@/lib/fileDb";

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

  const chats = await readJsonFile("chats.json", []);
  const list = Array.isArray(chats) ? chats : [];

  const sorted = list.slice().sort((a, b) => {
    const at = new Date(a?.createdAt || 0).getTime();
    const bt = new Date(b?.createdAt || 0).getTime();
    return bt - at;
  });

  const previews = sorted.slice(0, limit).map((c) => ({
    id: c?.id,
    createdAt: c?.createdAt,
    message: c?.message,
    influencesLaunch: Boolean(c?.influencesLaunch),
  }));

  return NextResponse.json({ ok: true, chats: previews });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const message = typeof body?.message === "string" ? body.message : "";
  const wallet = typeof body?.wallet === "string" ? body.wallet : null;
  const influencesLaunch = Boolean(body?.influencesLaunch);

  const profile = await loadPersonalityProfile();
  const phrases = normalizePhrases(profile);
  const reply = buildParodyReply(message, phrases);

  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    wallet,
    influencesLaunch,
    message,
    reply,
  };

  await appendJsonArrayItem("chats.json", record);

  return NextResponse.json({
    ok: true,
    reply,
    chatId: record.id,
  });
}
