import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const MESSAGE_COOLDOWN_MS = 3000;
const SPAM_THRESHOLD = 5;
const SPAM_WINDOW_MS = 30000;
const BAN_DURATION_MS = 10 * 60 * 1000;

const recentMessages = new Map();

function getIdentifier(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, data] of recentMessages.entries()) {
    data.timestamps = data.timestamps.filter((t) => now - t < SPAM_WINDOW_MS);
    if (data.timestamps.length === 0 && now - data.lastMessage > 60000) {
      recentMessages.delete(key);
    }
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(200, Number(limitRaw || 50) || 50));

  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const sorted = messages.reverse().map((m) => ({
      id: m.id,
      username: m.nickname || "anon",
      message: m.message,
      wallet: m.wallet,
      color: m.color || null,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ ok: true, messages: sorted });
  } catch (error) {
    console.error("Failed to fetch chat messages:", error);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
  }
}

export async function POST(req) {
  const identifier = getIdentifier(req);

  try {
    const ban = await prisma.chatBan.findUnique({ where: { identifier } });
    if (ban) {
      if (!ban.expiresAt || new Date(ban.expiresAt) > new Date()) {
        const remaining = ban.expiresAt
          ? Math.ceil((new Date(ban.expiresAt).getTime() - Date.now()) / 1000)
          : null;
        return NextResponse.json(
          {
            ok: false,
            error: "banned",
            reason: ban.reason || "Spam abuse",
            expiresIn: remaining,
          },
          { status: 403 }
        );
      } else {
        await prisma.chatBan.delete({ where: { identifier } });
      }
    }
  } catch (e) {
    console.error("Ban check error:", e);
  }

  cleanupOldEntries();

  const now = Date.now();
  let userData = recentMessages.get(identifier);
  if (!userData) {
    userData = { timestamps: [], lastMessage: 0, lastContent: "" };
    recentMessages.set(identifier, userData);
  }

  const timeSinceLast = now - userData.lastMessage;
  if (timeSinceLast < MESSAGE_COOLDOWN_MS) {
    const waitSec = Math.ceil((MESSAGE_COOLDOWN_MS - timeSinceLast) / 1000);
    return NextResponse.json(
      { ok: false, error: "cooldown", waitSeconds: waitSec },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));

  const username = typeof body?.username === "string" ? body.username.trim().slice(0, 32) : "anon";
  let message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";
  const wallet = typeof body?.wallet === "string" ? body.wallet : null;
  const color = typeof body?.color === "string" ? body.color.trim().slice(0, 10) : null;

  const slurPattern = /\bn+[i1!]+g+[e3]*[r]+s?\b/gi;
  if (slurPattern.test(message)) {
    message = "Message removed by moderation.";
  }

  if (!message) {
    return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
  }

  userData.timestamps.push(now);
  userData.lastMessage = now;

  const isRepeat = userData.lastContent.toLowerCase() === message.toLowerCase();
  userData.lastContent = message;

  const recentCount = userData.timestamps.filter((t) => now - t < SPAM_WINDOW_MS).length;

  if (recentCount >= SPAM_THRESHOLD || (isRepeat && recentCount >= 3)) {
    try {
      await prisma.chatBan.upsert({
        where: { identifier },
        create: {
          identifier,
          reason: isRepeat ? "Repetitive message spam" : "Message spam",
          expiresAt: new Date(now + BAN_DURATION_MS),
        },
        update: {
          reason: isRepeat ? "Repetitive message spam" : "Message spam",
          expiresAt: new Date(now + BAN_DURATION_MS),
        },
      });
    } catch (e) {
      console.error("Failed to create ban:", e);
    }

    return NextResponse.json(
      {
        ok: false,
        error: "banned",
        reason: "You've been temporarily banned for spamming",
        expiresIn: Math.ceil(BAN_DURATION_MS / 1000),
      },
      { status: 403 }
    );
  }

  try {
    const data = {
      nickname: username || "anon",
      message,
      wallet,
    };

    if (color) {
      data.color = color;
    }

    const entry = await prisma.chatMessage.create({ data });

    return NextResponse.json({
      ok: true,
      entry: {
        id: entry.id,
        username: entry.nickname,
        message: entry.message,
        wallet: entry.wallet,
        color: entry.color,
        createdAt: entry.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to save chat message:", error);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
  }
}
