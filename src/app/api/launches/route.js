import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { appendJsonArrayItem, readJsonFile } from "@/lib/fileDb";

export async function GET() {
  const launches = await readJsonFile("launches.json", []);
  const sorted = Array.isArray(launches)
    ? launches.slice().sort((a, b) => {
        const at = new Date(a?.createdAt || 0).getTime();
        const bt = new Date(b?.createdAt || 0).getTime();
        return bt - at;
      })
    : [];

  return NextResponse.json({ ok: true, launches: sorted });
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

  const launch = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    name,
    ticker,
    status: typeof body?.status === "string" ? body.status : "draft",
    pumpUrl: typeof body?.pumpUrl === "string" ? body.pumpUrl : null,
    mint: typeof body?.mint === "string" ? body.mint : null,
    influencedByChatIds: Array.isArray(body?.influencedByChatIds)
      ? body.influencedByChatIds
      : [],
  };

  await appendJsonArrayItem("launches.json", launch);

  return NextResponse.json({ ok: true, launch });
}
