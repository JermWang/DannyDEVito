import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateMultiplier } from "@/lib/staking";

export async function GET(req) {
  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.max(1, Math.min(50, Number(limitRaw || 20) || 20));

  try {
    const accounts = await prisma.stakeAccount.findMany({
      where: {
        stakedAmount: { gt: 0 },
      },
      orderBy: { stakedAmount: "desc" },
      take: limit,
      select: {
        userWallet: true,
        stakedAmount: true,
        stakedAt: true,
      },
    });

    const leaderboard = accounts.map((acc, index) => {
      const multiplier = calculateMultiplier(acc.stakedAt);
      const stakedAmount = Number(acc.stakedAmount);
      const weightedStake = stakedAmount * multiplier;

      return {
        rank: index + 1,
        wallet: acc.userWallet,
        walletShort: acc.userWallet.slice(0, 4) + "..." + acc.userWallet.slice(-4),
        stakedAmount,
        multiplier,
        weightedStake,
        stakedAt: acc.stakedAt?.toISOString() || null,
      };
    });

    const totalStaked = leaderboard.reduce((sum, l) => sum + l.stakedAmount, 0);
    const totalWeighted = leaderboard.reduce((sum, l) => sum + l.weightedStake, 0);

    return NextResponse.json({
      ok: true,
      leaderboard,
      stats: {
        totalStakers: leaderboard.length,
        totalStaked,
        totalWeighted,
      },
    });
  } catch (error) {
    console.error("Failed to fetch leaderboard:", error);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
  }
}
