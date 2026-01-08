import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(200, Number(limitRaw || 50) || 50));

  try {
    const messages = await prisma.chatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Return in chronological order (oldest first)
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
  const body = await req.json().catch(() => ({}));

  const username = typeof body?.username === "string" ? body.username.trim().slice(0, 32) : "anon";
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";
  const wallet = typeof body?.wallet === "string" ? body.wallet : null;
  const color = typeof body?.color === "string" ? body.color.trim().slice(0, 10) : null;

  if (!message) {
    return NextResponse.json({ ok: false, error: "Empty message" }, { status: 400 });
  }

  try {
    // Build data object - color field may not exist in older schemas
    const data = {
      nickname: username || "anon",
      message,
      wallet,
    };
    
    // Only add color if it's provided (graceful handling if column doesn't exist)
    if (color) {
      data.color = color;
    }

    const entry = await prisma.chatMessage.create({
      data,
    });

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
