import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getHolderStatus } from "@/lib/holderGate";
import { generateDannyResponse } from "@/lib/dannyAgent";

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

  // Get conversation history for context
  const history = await prisma.dannyChat.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  // Generate AI response using OpenAI
  const reply = await generateDannyResponse(message, history);

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
