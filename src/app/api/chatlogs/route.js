import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getHolderStatus, buildAuthMessage, verifySignature } from "@/lib/holderGate";

export async function GET(req) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet") || "";
  const nonce = url.searchParams.get("nonce") || "";
  const signature = url.searchParams.get("signature") || "";
  const sessionId = url.searchParams.get("sessionId") || "";
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(200, Number(limitRaw || 50) || 50));

  if (!wallet) {
    return NextResponse.json({ ok: false, error: "wallet_required" }, { status: 400 });
  }

  if (!nonce || !signature) {
    return NextResponse.json({ ok: false, error: "signature_required" }, { status: 400 });
  }

  const message = buildAuthMessage(wallet, nonce);
  const valid = verifySignature(wallet, message, signature);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
  }

  const gate = await getHolderStatus(wallet);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: 400 });
  }

  if (!gate.isHolder) {
    return NextResponse.json({ ok: false, error: "not_holder", gate }, { status: 403 });
  }

  if (sessionId) {
    const rows = await prisma.dannyChat.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 2000,
    });

    return NextResponse.json({
      ok: true,
      gate,
      sessionId,
      messages: rows.map((r) => ({
        id: r.id,
        role: r.role,
        content: r.content,
        wallet: r.wallet,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  }

  const rows = await prisma.dannyChat.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.max(500, limit * 40),
  });

  const sessions = new Map();

  for (const row of rows) {
    if (!row?.sessionId) continue;

    const existing = sessions.get(row.sessionId);
    if (!existing) {
      sessions.set(row.sessionId, {
        sessionId: row.sessionId,
        lastAt: row.createdAt.toISOString(),
        wallet: row.wallet,
        preview: row.role === "user" ? row.content : "…",
        messageCount: 1,
      });
      continue;
    }

    existing.messageCount += 1;

    if (!existing.wallet && row.wallet) {
      existing.wallet = row.wallet;
    }

    if (!existing.preview || existing.preview === "…") {
      if (row.role === "user" && row.content) existing.preview = row.content;
    }
  }

  const sessionsList = Array.from(sessions.values())
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
    .slice(0, limit);

  return NextResponse.json({ ok: true, gate, sessions: sessionsList });
}
