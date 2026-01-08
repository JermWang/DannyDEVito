import { NextResponse } from "next/server";
import { PublicKey, Transaction } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

import { prisma } from "@/lib/prisma";
import { verifyAdminSignature, buildAdminAuthMessage } from "@/lib/adminAuth";
import { getConnection, getSolanaCaip2, privySignAndSendSolanaTransaction, privyGetWallet, getTokenBalance } from "@/lib/privyServer";

const STAKER_SHARE_PERCENT = 0.03;
const TOTAL_SUPPLY = 1_000_000_000;

function calculateMultiplier(stakedAt) {
  if (!stakedAt) return 1.0;
  const now = Date.now();
  const stakedTime = new Date(stakedAt).getTime();
  const daysSinceStake = (now - stakedTime) / (1000 * 60 * 60 * 24);
  const multiplier = 1.0 + Math.min(daysSinceStake / 30, 1.0);
  return Math.round(multiplier * 100) / 100;
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

    if (!wallet || !nonce || !signature) {
      return NextResponse.json({ ok: false, error: "auth_required" }, { status: 400 });
    }

    const message = buildAdminAuthMessage(wallet, nonce, "distribute");
    const authResult = verifyAdminSignature({ wallet, message, signatureBase64: signature });
    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: 401 });
    }

    if (!launchId) {
      return NextResponse.json({ ok: false, error: "launchId_required" }, { status: 400 });
    }

    const launch = await prisma.launch.findUnique({ where: { id: launchId } });
    if (!launch || !launch.mint) {
      return NextResponse.json({ ok: false, error: "launch_not_found" }, { status: 404 });
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
    const mintPubkey = new PublicKey(launch.mint);

    const stakers = await prisma.stakeAccount.findMany({
      where: {
        stakedAmount: { gt: 0 },
      },
    });

    if (stakers.length === 0) {
      return NextResponse.json({ ok: false, error: "no_stakers" }, { status: 400 });
    }

    let totalWeightedStake = 0;
    const stakerData = stakers.map((s) => {
      const staked = Number(s.stakedAmount);
      const multiplier = calculateMultiplier(s.stakedAt);
      const weighted = staked * multiplier;
      totalWeightedStake += weighted;
      return {
        account: s,
        staked,
        multiplier,
        weighted,
      };
    });

    const totalTokensForStakers = Math.floor(TOTAL_SUPPLY * STAKER_SHARE_PERCENT);

    const allocations = stakerData.map((sd) => {
      const sharePercent = sd.weighted / totalWeightedStake;
      const tokenAmount = Math.floor(totalTokensForStakers * sharePercent);
      return {
        ...sd,
        sharePercent,
        tokenAmount,
      };
    });

    const connection = getConnection();
    const results = [];

    for (const alloc of allocations) {
      if (alloc.tokenAmount <= 0) continue;

      try {
        const recipientPubkey = new PublicKey(alloc.account.userWallet);

        const treasuryAta = await getAssociatedTokenAddress(
          mintPubkey,
          treasuryPubkey,
          false,
          TOKEN_2022_PROGRAM_ID
        );

        const recipientAta = await getAssociatedTokenAddress(
          mintPubkey,
          recipientPubkey,
          false,
          TOKEN_2022_PROGRAM_ID
        );

        const tx = new Transaction();
        tx.feePayer = treasuryPubkey;

        const recipientAtaInfo = await connection.getAccountInfo(recipientAta);
        if (!recipientAtaInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              treasuryPubkey,
              recipientAta,
              recipientPubkey,
              mintPubkey,
              TOKEN_2022_PROGRAM_ID
            )
          );
        }

        const tokenAmountRaw = BigInt(alloc.tokenAmount) * BigInt(1_000_000);

        tx.add(
          createTransferInstruction(
            treasuryAta,
            recipientAta,
            treasuryPubkey,
            tokenAmountRaw,
            [],
            TOKEN_2022_PROGRAM_ID
          )
        );

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;

        const txBytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const txBase64 = Buffer.from(Uint8Array.from(txBytes)).toString("base64");

        const sent = await privySignAndSendSolanaTransaction({
          walletId: treasuryWalletId,
          caip2: getSolanaCaip2(),
          transactionBase64: txBase64,
        });

        await prisma.allocation.create({
          data: {
            accountId: alloc.account.id,
            launchId: launch.id,
            stakedAtSnapshot: alloc.staked,
            multiplier: alloc.multiplier,
            weightedStake: alloc.weighted,
            sharePercent: alloc.sharePercent,
            tokenAmount: alloc.tokenAmount,
            claimed: true,
            claimedAt: new Date(),
            claimTxSignature: sent.signature,
          },
        });

        results.push({
          wallet: alloc.account.userWallet,
          tokenAmount: alloc.tokenAmount,
          signature: sent.signature,
          ok: true,
        });

        console.log("[Distribute] Sent tokens:", {
          wallet: alloc.account.userWallet,
          amount: alloc.tokenAmount,
          signature: sent.signature,
        });
      } catch (e) {
        console.error("[Distribute] Error for wallet:", alloc.account.userWallet, e?.message || e);
        results.push({
          wallet: alloc.account.userWallet,
          tokenAmount: alloc.tokenAmount,
          ok: false,
          error: e?.message || "transfer_failed",
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failCount = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: true,
      launchId: launch.id,
      mint: launch.mint,
      totalStakers: stakers.length,
      totalTokensDistributed: results.filter((r) => r.ok).reduce((sum, r) => sum + r.tokenAmount, 0),
      successCount,
      failCount,
      results,
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
