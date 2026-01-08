import { NextResponse } from "next/server";

import { verifyAdminRequest } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { getOrInitLaunchSchedule, computePreviewGenerateAt, ensureScheduledDraft, buildDraftMetadataUri } from "@/lib/launchScheduler";

function authStatus(error) {
  if (error === "auth_required") return 400;
  return 401;
}

const EDIT_WINDOW_MS = 45 * 60 * 1000;

export async function GET(req) {
  try {
    const wallet = String(req.headers.get("x-admin-wallet") ?? "").trim();
    const nonce = String(req.headers.get("x-admin-nonce") ?? "").trim();
    const signature = String(req.headers.get("x-admin-signature") ?? "").trim();

    const authResult = await verifyAdminRequest({
      wallet,
      nonce,
      signatureBase64: signature,
      action: "schedule_get",
      payload: {},
      consumeNonce: false,
    });

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authStatus(authResult.error) });
    }

    const schedule = await getOrInitLaunchSchedule();
    const nextLaunchAt = schedule.nextLaunchAt;
    const previewAt = computePreviewGenerateAt(nextLaunchAt);
    const editOpensAt = new Date(new Date(nextLaunchAt).getTime() - EDIT_WINDOW_MS);

    const now = Date.now();
    const shouldHaveDraft = now >= new Date(previewAt).getTime();

    let draft = null;
    if (shouldHaveDraft) {
      draft = await ensureScheduledDraft({ scheduledAt: nextLaunchAt });
      const computedUri = buildDraftMetadataUri(draft.id);
      if (computedUri && draft.metadataUri !== computedUri) {
        draft = await prisma.scheduledLaunchDraft.update({
          where: { id: draft.id },
          data: { metadataUri: computedUri },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      nextLaunchAt: nextLaunchAt.toISOString(),
      cadenceHours: schedule.cadenceHours,
      previewAt: previewAt.toISOString(),
      editOpensAt: editOpensAt.toISOString(),
      canEdit: now >= editOpensAt.getTime() && now < new Date(nextLaunchAt).getTime(),
      draft: draft
        ? {
            id: draft.id,
            scheduledAt: draft.scheduledAt.toISOString(),
            name: draft.name,
            ticker: draft.ticker,
            description: draft.description,
            metadataImageUrl: draft.metadataImageUrl,
            metadataUri: draft.metadataUri,
            spendableSolLamports: draft.spendableSolLamports,
            generatedAt: draft.generatedAt?.toISOString() || null,
            editedAt: draft.editedAt?.toISOString() || null,
            launchedAt: draft.launchedAt?.toISOString() || null,
            mint: draft.mint,
            pumpUrl: draft.pumpUrl,
          }
        : null,
    });
  } catch (e) {
    console.error("[Admin Schedule GET] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const wallet = String(body?.wallet ?? "").trim();
    const nonce = String(body?.nonce ?? "").trim();
    const signature = String(body?.signature ?? "").trim();

    const payload = {
      draftId: String(body?.draftId ?? "").trim(),
      name: String(body?.name ?? "").trim(),
      ticker: String(body?.ticker ?? "").trim(),
      description: String(body?.description ?? "").trim(),
      metadataImageUrl: String(body?.metadataImageUrl ?? "").trim(),
      spendableSolLamports: String(body?.spendableSolLamports ?? "").trim(),
    };

    const authResult = await verifyAdminRequest({
      wallet,
      nonce,
      signatureBase64: signature,
      action: "schedule_update",
      payload,
    });

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authStatus(authResult.error) });
    }

    const schedule = await getOrInitLaunchSchedule();
    const nextLaunchAt = schedule.nextLaunchAt;
    const editOpensAt = new Date(new Date(nextLaunchAt).getTime() - EDIT_WINDOW_MS);
    const now = Date.now();

    if (now < editOpensAt.getTime()) {
      return NextResponse.json({ ok: false, error: "edit_window_not_open" }, { status: 400 });
    }

    if (now >= new Date(nextLaunchAt).getTime()) {
      return NextResponse.json({ ok: false, error: "already_launching" }, { status: 400 });
    }

    const draftId = payload.draftId;
    if (!draftId) {
      return NextResponse.json({ ok: false, error: "draftId_required" }, { status: 400 });
    }

    const nextDraft = await prisma.scheduledLaunchDraft.findUnique({ where: { id: draftId } });
    if (!nextDraft) {
      return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 404 });
    }

    if (nextDraft.scheduledAt.getTime() !== new Date(nextLaunchAt).getTime()) {
      return NextResponse.json({ ok: false, error: "draft_not_for_next_launch" }, { status: 400 });
    }

    if (nextDraft.launchedAt) {
      return NextResponse.json({ ok: false, error: "already_launched" }, { status: 400 });
    }

    const name = payload.name.slice(0, 32);
    const ticker = payload.ticker.replace(/^\$/, "").toUpperCase().slice(0, 10);
    const description = payload.description.slice(0, 500);
    const metadataImageUrl = payload.metadataImageUrl;
    const spendableSolLamports = payload.spendableSolLamports;

    const updated = await prisma.scheduledLaunchDraft.update({
      where: { id: nextDraft.id },
      data: {
        name: name || nextDraft.name,
        ticker: ticker || nextDraft.ticker,
        description: description || nextDraft.description,
        metadataImageUrl: metadataImageUrl || null,
        spendableSolLamports: spendableSolLamports || null,
        editedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      draft: {
        id: updated.id,
        scheduledAt: updated.scheduledAt.toISOString(),
        name: updated.name,
        ticker: updated.ticker,
        description: updated.description,
        metadataImageUrl: updated.metadataImageUrl,
        metadataUri: updated.metadataUri,
        spendableSolLamports: updated.spendableSolLamports,
        editedAt: updated.editedAt?.toISOString() || null,
      },
    });
  } catch (e) {
    console.error("[Admin Schedule POST] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}
