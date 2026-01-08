import { NextResponse } from "next/server";

import {
  getStakeSummary,
  initializeEscrowWallet,
  recordStake,
  requestUnstake,
  claimUnstaked,
  getAllActiveStakers,
  claimAllocation,
} from "@/lib/staking";

function asPositiveNumber(n) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  return v;
}

/**
 * GET /api/staking?wallet=<address>
 * Get staking summary for a wallet
 */
export async function GET(req) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");

  if (!wallet) {
    // Return all active stakers (admin view)
    try {
      const stakers = await getAllActiveStakers();
      return NextResponse.json({ ok: true, stakers });
    } catch (error) {
      console.error("Failed to get stakers:", error);
      return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
    }
  }

  try {
    const summary = await getStakeSummary(wallet);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("Failed to get stake summary:", error);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 500 });
  }
}

/**
 * POST /api/staking
 * Actions: init_escrow, stake, request_unstake, claim, claim_allocation
 */
export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";

  if (!wallet) {
    return NextResponse.json({ ok: false, error: "wallet_required" }, { status: 400 });
  }

  try {
    // Initialize escrow wallet for new staker
    if (action === "init_escrow") {
      const account = await initializeEscrowWallet(wallet);
      return NextResponse.json({
        ok: true,
        escrowWallet: account.privyWalletAddr,
        message: "Escrow wallet created. Send $DEVITO to this address to stake.",
      });
    }

    // Record a stake deposit (after user sends tokens to escrow)
    if (action === "stake") {
      const amount = asPositiveNumber(body?.amount);
      const txSignature = body?.txSignature;

      if (!amount) {
        return NextResponse.json({ ok: false, error: "amount_required" }, { status: 400 });
      }

      const account = await recordStake(wallet, amount, txSignature);
      const summary = await getStakeSummary(wallet);
      return NextResponse.json({ ok: true, summary });
    }

    // Request unstake - starts unlock timer
    if (action === "request_unstake") {
      const amount = asPositiveNumber(body?.amount);

      if (!amount) {
        return NextResponse.json({ ok: false, error: "amount_required" }, { status: 400 });
      }

      await requestUnstake(wallet, amount);
      const summary = await getStakeSummary(wallet);
      return NextResponse.json({ ok: true, summary });
    }

    // Claim unstaked tokens after unlock period
    if (action === "claim") {
      const result = await claimUnstaked(wallet);
      const summary = await getStakeSummary(wallet);
      return NextResponse.json({
        ok: true,
        summary,
        claimAmount: result.claimAmount,
        cooldownUntil: result.cooldownUntil,
      });
    }

    // Claim launch allocation tokens
    if (action === "claim_allocation") {
      const allocationId = body?.allocationId;

      if (!allocationId) {
        return NextResponse.json({ ok: false, error: "allocation_id_required" }, { status: 400 });
      }

      const allocation = await claimAllocation(wallet, allocationId);
      const summary = await getStakeSummary(wallet);
      return NextResponse.json({ ok: true, summary, allocation });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (error) {
    console.error("Staking action failed:", error);

    // Map known errors to user-friendly responses
    const errorMap = {
      COOLDOWN_ACTIVE: { error: "cooldown_active", status: 400 },
      ESCROW_NOT_INITIALIZED: { error: "escrow_not_initialized", status: 400 },
      ACCOUNT_NOT_FOUND: { error: "account_not_found", status: 404 },
      ALREADY_PENDING_UNLOCK: { error: "already_pending_unlock", status: 400 },
      INSUFFICIENT_STAKED: { error: "insufficient_staked", status: 400 },
      NO_PENDING_UNLOCK: { error: "no_pending_unlock", status: 400 },
      NOT_UNLOCKED_YET: { error: "not_unlocked_yet", status: 400 },
      ALLOCATION_NOT_FOUND: { error: "allocation_not_found", status: 404 },
    };

    const mapped = errorMap[error.message];
    if (mapped) {
      return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    }

    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
