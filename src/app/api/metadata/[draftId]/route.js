import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(req, { params }) {
  try {
    const draftId = String(params?.draftId ?? "").trim();
    if (!draftId) {
      return NextResponse.json({ ok: false, error: "draftId_required" }, { status: 400 });
    }

    const draft = await prisma.scheduledLaunchDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const image = String(draft.metadataImageUrl ?? "").trim();

    return NextResponse.json({
      name: draft.name,
      symbol: draft.ticker,
      description: draft.description || "",
      image: image || undefined,
      external_url: draft.pumpUrl || undefined,
    });
  } catch (e) {
    console.error("[Metadata] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "metadata_failed" }, { status: 500 });
  }
}
