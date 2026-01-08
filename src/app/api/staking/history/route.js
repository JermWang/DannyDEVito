import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(100, Number(limitRaw || 50) || 50));

  if (!wallet) {
    return NextResponse.json({ ok: false, error: "wallet_required" }, { status: 400 });
  }

  try {
    // Find the stake account
    const account = await prisma.stakeAccount.findUnique({
      where: { userWallet: wallet },
    });

    if (!account) {
      return NextResponse.json({ ok: true, transactions: [], summary: null });
    }

    // Get transaction history
    const transactions = await prisma.stakeEvent.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Get allocations (launch distributions)
    const allocations = await prisma.allocation.findMany({
      where: { accountId: account.id },
      include: { launch: true },
      orderBy: { createdAt: "desc" },
    });

    // Format transactions
    const formattedTxs = transactions.map((tx) => ({
      id: tx.id,
      action: tx.action,
      amount: Number(tx.amount),
      txSignature: tx.txSignature,
      createdAt: tx.createdAt.toISOString(),
    }));

    // Format allocations
    const formattedAllocations = allocations.map((a) => ({
      id: a.id,
      launchName: a.launch.name,
      ticker: a.launch.ticker,
      tokenAmount: Number(a.tokenAmount),
      sharePercent: Number(a.sharePercent),
      multiplier: Number(a.multiplier),
      claimed: a.claimed,
      claimedAt: a.claimedAt?.toISOString() || null,
      createdAt: a.createdAt.toISOString(),
    }));

    // Calculate summary stats
    const totalStaked = transactions
      .filter((t) => t.action === "stake")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalUnstaked = transactions
      .filter((t) => t.action === "request_unstake" || t.action === "claim")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalAllocations = allocations.length;
    const claimedAllocations = allocations.filter((a) => a.claimed).length;

    return NextResponse.json({
      ok: true,
      transactions: formattedTxs,
      allocations: formattedAllocations,
      summary: {
        totalStaked,
        totalUnstaked,
        netStaked: totalStaked - totalUnstaked,
        totalAllocations,
        claimedAllocations,
        pendingAllocations: totalAllocations - claimedAllocations,
        currentStake: Number(account.stakedAmount),
        pendingUnstake: Number(account.pendingUnstakeAmount),
        stakedSince: account.stakedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Failed to fetch staking history:", error);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
  }
}
