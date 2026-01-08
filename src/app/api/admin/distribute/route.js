import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { calculateStakerTokensFromTotalSupply, createLaunchAllocations } from "@/lib/staking";

const TOTAL_SUPPLY = 1_000_000_000;

function authStatus(error) {
  if (error === "auth_required") return 400;
  return 401;
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
    const launchId = String(body?.launchId ?? "").trim();

    const payload = { launchId };
    const authResult = await verifyAdminRequest({
      wallet,
      nonce,
      signatureBase64: signature,
      action: "distribute",
      payload,
    });

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authStatus(authResult.error) });
    }

    if (!launchId) {
      return NextResponse.json({ ok: false, error: "launchId_required" }, { status: 400 });
    }

    const launch = await prisma.launch.findUnique({ where: { id: launchId } });
    if (!launch || !launch.mint) {
      return NextResponse.json({ ok: false, error: "launch_not_found" }, { status: 404 });
    }

    const totalSupply = launch.totalSupply != null ? Number(launch.totalSupply) : TOTAL_SUPPLY;
    const totalTokensForStakers = calculateStakerTokensFromTotalSupply(totalSupply);
    const allocations = await createLaunchAllocations(launch.id, totalTokensForStakers);

    return NextResponse.json({
      ok: true,
      launchId: launch.id,
      mint: launch.mint,
      totalSupply,
      totalTokensForStakers,
      allocationCount: allocations.length,
    });
  } catch (e) {
    console.error("[Admin Distribute] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "distribute_failed" }, { status: 500 });
  }
}

export async function GET(req) {
  const url = new URL(req.url);
  const launchId = url.searchParams.get("launchId") || "";

  try {
    const wallet = String(req.headers.get("x-admin-wallet") ?? "").trim();
    const nonce = String(req.headers.get("x-admin-nonce") ?? "").trim();
    const signature = String(req.headers.get("x-admin-signature") ?? "").trim();

    const payload = launchId ? { launchId: String(launchId ?? "").trim() } : {};

    const authResult = await verifyAdminRequest({
      wallet,
      nonce,
      signatureBase64: signature,
      action: "distribute_get",
      payload,
      consumeNonce: false,
    });

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authStatus(authResult.error) });
    }

    const where = launchId ? { launchId } : {};
    const allocations = await prisma.allocation.findMany({
      where,
      include: {
        account: { select: { userWallet: true } },
        launch: { select: { name: true, ticker: true, mint: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({
      ok: true,
      allocations: allocations.map((a) => ({
        id: a.id,
        wallet: a.account.userWallet,
        launchId: a.launchId,
        launchName: a.launch.name,
        launchTicker: a.launch.ticker,
        mint: a.launch.mint,
        stakedAtSnapshot: Number(a.stakedAtSnapshot),
        multiplier: Number(a.multiplier),
        weightedStake: Number(a.weightedStake),
        sharePercent: Number(a.sharePercent),
        tokenAmount: Number(a.tokenAmount),
        claimed: a.claimed,
        claimedAt: a.claimedAt?.toISOString() || null,
        claimTxSignature: a.claimTxSignature,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[Admin Distribute GET] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }
}
