import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const launches = await prisma.launch.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      ok: true,
      launches: launches.map((l) => ({
        id: l.id,
        createdAt: l.createdAt.toISOString(),
        name: l.name,
        ticker: l.ticker,
        status: l.status,
        pumpUrl: l.pumpUrl,
        mint: l.mint,
      })),
    });
  } catch (e) {
    console.error("[Launches GET] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ticker = typeof body?.ticker === "string" ? body.ticker.trim() : "";

  if (!name || !ticker) {
    return NextResponse.json(
      { ok: false, error: "name_and_ticker_required" },
      { status: 400 },
    );
  }

  try {
    const status = typeof body?.status === "string" ? body.status : "draft";
    const pumpUrl = typeof body?.pumpUrl === "string" ? body.pumpUrl : null;
    const mint = typeof body?.mint === "string" ? body.mint : null;

    const launch = await prisma.launch.create({
      data: {
        name,
        ticker,
        status,
        pumpUrl,
        mint,
      },
    });

    return NextResponse.json({
      ok: true,
      launch: {
        id: launch.id,
        createdAt: launch.createdAt.toISOString(),
        name: launch.name,
        ticker: launch.ticker,
        status: launch.status,
        pumpUrl: launch.pumpUrl,
        mint: launch.mint,
      },
    });
  } catch (e) {
    console.error("[Launches POST] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
}
