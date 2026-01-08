import { NextResponse } from "next/server";
import { Keypair, PublicKey } from "@solana/web3.js";

import { prisma } from "@/lib/prisma";
import { getConnection, getSolanaCaip2, privySignAndSendSolanaTransaction, privyGetWallet } from "@/lib/privyServer";
import { buildUnsignedPumpfunCreateV2Tx } from "@/lib/pumpfun";
import { buildDraftMetadataUri, ensureScheduledDraft, getOrInitLaunchSchedule, makeLaunchRunId } from "@/lib/launchScheduler";
import { calculateStakerTokensFromTotalSupply, createLaunchAllocations } from "@/lib/staking";

const TOTAL_SUPPLY = 1_000_000_000;
const STAKER_SHARE = 0.05 * 0.02;

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const schedule = await getOrInitLaunchSchedule();
    const nextLaunchAt = new Date(schedule.nextLaunchAt);

    const nowMs = Date.now();
    const nextMs = nextLaunchAt.getTime();

    if (nowMs < nextMs - 60 * 60 * 1000) {
      return NextResponse.json({ ok: true, status: "waiting", nextLaunchAt: nextLaunchAt.toISOString() });
    }

    const draft = await ensureScheduledDraft({ scheduledAt: nextLaunchAt });

    if (nowMs < nextMs) {
      return NextResponse.json({ ok: true, status: "preview_ready", nextLaunchAt: nextLaunchAt.toISOString(), draftId: draft.id });
    }

    const fresh = await prisma.scheduledLaunchDraft.findUnique({ where: { id: draft.id } });
    if (!fresh) {
      return NextResponse.json({ ok: false, error: "draft_not_found" }, { status: 500 });
    }

    if (fresh.launchedAt) {
      return NextResponse.json({ ok: true, status: "already_launched", nextLaunchAt: nextLaunchAt.toISOString(), draftId: fresh.id });
    }

    const runId = makeLaunchRunId();

    const locked = await prisma.scheduledLaunchDraft.updateMany({
      where: {
        id: fresh.id,
        launchedAt: null,
        launchingAt: null,
      },
      data: {
        launchingAt: new Date(),
        launchingId: runId,
      },
    });

    if (locked.count !== 1) {
      return NextResponse.json({ ok: true, status: "launch_in_progress" });
    }

    const lockedDraft = await prisma.scheduledLaunchDraft.findUnique({ where: { id: fresh.id } });
    if (!lockedDraft || lockedDraft.launchingId !== runId) {
      return NextResponse.json({ ok: true, status: "launch_in_progress" });
    }

    const treasuryWalletId = String(process.env.TREASURY_WALLET_ID ?? "").trim();
    if (!treasuryWalletId) {
      return NextResponse.json({ ok: false, error: "treasury_not_configured" }, { status: 500 });
    }

    const treasuryInfo = await privyGetWallet(treasuryWalletId);
    if (!treasuryInfo.address) {
      return NextResponse.json({ ok: false, error: "treasury_wallet_not_found" }, { status: 500 });
    }

    const treasuryPubkey = new PublicKey(treasuryInfo.address);

    const uri =
      (typeof lockedDraft.metadataUri === "string" && lockedDraft.metadataUri.trim())
        ? lockedDraft.metadataUri.trim()
        : buildDraftMetadataUri(lockedDraft.id);

    if (!uri) {
      return NextResponse.json({ ok: false, error: "metadata_uri_not_configured" }, { status: 500 });
    }

    const spendableSolLamports = BigInt(String(lockedDraft.spendableSolLamports || "100000000").trim() || "100000000");

    const mintKeypair = Keypair.generate();
    const connection = getConnection();

    const built = await buildUnsignedPumpfunCreateV2Tx({
      connection,
      user: treasuryPubkey,
      mint: mintKeypair.publicKey,
      name: lockedDraft.name,
      symbol: lockedDraft.ticker,
      uri,
      creator: treasuryPubkey,
      isMayhemMode: false,
      spendableSolInLamports: spendableSolLamports,
      minTokensOut: 1n,
    });

    built.tx.partialSign(mintKeypair);

    const txBytes = built.tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const txBase64 = Buffer.from(Uint8Array.from(txBytes)).toString("base64");

    const sent = await privySignAndSendSolanaTransaction({
      walletId: treasuryWalletId,
      caip2: getSolanaCaip2(),
      transactionBase64: txBase64,
    });

    const mint = mintKeypair.publicKey.toBase58();
    const pumpUrl = `https://pump.fun/coin/${mint}`;

    const launch = await prisma.launch.create({
      data: {
        name: lockedDraft.name,
        ticker: lockedDraft.ticker,
        mint,
        pumpUrl,
        status: "launched",
        launchedAt: new Date(),
        totalSupply: TOTAL_SUPPLY,
        stakerShare: STAKER_SHARE,
      },
    });

    try {
      const totalTokensForStakers = calculateStakerTokensFromTotalSupply(TOTAL_SUPPLY);
      await createLaunchAllocations(launch.id, totalTokensForStakers);
    } catch (e) {
      console.error("[Cron Launch] Failed to create allocations:", e?.message || e);
    }

    await prisma.scheduledLaunchDraft.update({
      where: { id: lockedDraft.id },
      data: {
        launchedAt: new Date(),
        launchTxSignature: sent.signature,
        mint,
        pumpUrl,
        metadataUri: uri,
      },
    });

    const nextAt = new Date(nextMs + Number(schedule.cadenceHours) * 60 * 60 * 1000);
    await prisma.launchSchedule.update({
      where: { id: schedule.id },
      data: { nextLaunchAt: nextAt },
    });

    return NextResponse.json({
      ok: true,
      status: "launched",
      launchTxSignature: sent.signature,
      mint,
      pumpUrl,
      nextLaunchAt: nextAt.toISOString(),
      draftId: lockedDraft.id,
    });
  } catch (e) {
    console.error("[Cron Launch] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "launch_failed" }, { status: 500 });
  }
}
