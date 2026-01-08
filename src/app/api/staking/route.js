import { NextResponse } from "next/server";

import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

import {
  getStakeSummary,
  initializeEscrowWallet,
  recordStake,
  requestUnstake,
  getAllActiveStakers,
  prepareClaimUnstakeAndAllocations,
  finalizeClaimUnstakeAndAllocations,
} from "@/lib/staking";

import { verifyAdminRequest } from "@/lib/adminAuth";

function asPositiveNumber(n) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  return v;
}

function buildStakingAuthMessage({
  wallet,
  action,
  nonce,
  amount,
  txSignature,
  allocationId,
  unstakeTxSignature,
  allocationTxSignatures,
  claimAmount,
}) {
  const allocTxs = Array.isArray(allocationTxSignatures) ? allocationTxSignatures.join(",") : allocationTxSignatures;
  return `Danny DEVito Staking Action\n\nWallet: ${wallet}\nAction: ${action}\nNonce: ${nonce}\nAmount: ${amount ?? ""}\nTx: ${txSignature ?? ""}\nAllocation: ${allocationId ?? ""}\nUnstakeTx: ${unstakeTxSignature ?? ""}\nAllocationTxs: ${allocTxs ?? ""}\nClaimAmount: ${claimAmount ?? ""}`;
}

function verifyWalletOwnership({ wallet, message, signatureBase64 }) {
  try {
    const pubkey = new PublicKey(wallet);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signatureBase64, "base64"));
    return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkey.toBytes());
  } catch {
    return false;
  }
}

function authStatus(error) {
  if (error === "auth_required") return 400;
  return 401;
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
      const adminWallet = String(req.headers.get("x-admin-wallet") ?? "").trim();
      const adminNonce = String(req.headers.get("x-admin-nonce") ?? "").trim();
      const adminSignature = String(req.headers.get("x-admin-signature") ?? "").trim();

      const authResult = await verifyAdminRequest({
        wallet: adminWallet,
        nonce: adminNonce,
        signatureBase64: adminSignature,
        action: "staking_get_all",
        payload: {},
        consumeNonce: false,
      });

      if (!authResult.ok) {
        return NextResponse.json({ ok: false, error: authResult.error }, { status: authStatus(authResult.error) });
      }

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
 * Actions: init_escrow, stake, request_unstake, claim_prepare, claim_finalize
 */
export async function POST(req) {
  const body = await req.json().catch(() => ({}));

  const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";
  const action = typeof body?.action === "string" ? body.action : "";

  const nonce = typeof body?.nonce === "string" ? body.nonce.trim() : "";
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";

  if (!wallet) {
    return NextResponse.json({ ok: false, error: "wallet_required" }, { status: 400 });
  }

  if (!action) {
    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  }

  if (!nonce || !signature) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 400 });
  }

  const amountForAuth = body?.amount;
  const txSignatureForAuth = body?.txSignature;
  const allocationIdForAuth = body?.allocationId;
  const unstakeTxSignatureForAuth = body?.unstakeTxSignature;
  const allocationTxSignaturesForAuth = body?.allocationTxSignatures;
  const claimAmountForAuth = body?.claimAmount;

  const authMessage = buildStakingAuthMessage({
    wallet,
    action,
    nonce,
    amount: amountForAuth,
    txSignature: txSignatureForAuth,
    allocationId: allocationIdForAuth,
    unstakeTxSignature: unstakeTxSignatureForAuth,
    allocationTxSignatures: allocationTxSignaturesForAuth,
    claimAmount: claimAmountForAuth,
  });

  const ok = verifyWalletOwnership({ wallet, message: authMessage, signatureBase64: signature });
  if (!ok) {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
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

      if (!txSignature || typeof txSignature !== "string" || !txSignature.trim()) {
        return NextResponse.json({ ok: false, error: "tx_signature_required" }, { status: 400 });
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

    // Prepare claim transactions (user pays gas)
    if (action === "claim" || action === "claim_prepare") {
      const prepared = await prepareClaimUnstakeAndAllocations(wallet);
      const summary = await getStakeSummary(wallet);
      return NextResponse.json({ ok: true, summary, prepared });
    }

    // Finalize claim after client sends transactions
    if (action === "claim_finalize") {
      const claimAmount = body?.claimAmount;
      const allocationIds = body?.allocationIds;
      const unstakeTxSignature = body?.unstakeTxSignature;
      const allocationTxSignatures = body?.allocationTxSignatures;

      if (!unstakeTxSignature || typeof unstakeTxSignature !== "string" || !unstakeTxSignature.trim()) {
        return NextResponse.json({ ok: false, error: "tx_signature_required" }, { status: 400 });
      }

      if (!Array.isArray(allocationIds)) {
        return NextResponse.json({ ok: false, error: "allocation_ids_required" }, { status: 400 });
      }

      if (!Array.isArray(allocationTxSignatures)) {
        return NextResponse.json({ ok: false, error: "allocation_tx_signatures_required" }, { status: 400 });
      }

      const result = await finalizeClaimUnstakeAndAllocations({
        userWallet: wallet,
        claimAmount,
        allocationIds,
        unstakeTxSignature,
        allocationTxSignatures,
      });

      const summary = await getStakeSummary(wallet);
      return NextResponse.json({ ok: true, summary, result });
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
      LAUNCH_MINT_MISSING: { error: "launch_mint_missing", status: 500 },
      MINT_REQUIRED: { error: "mint_required", status: 400 },
      MINT_NOT_FOUND: { error: "mint_not_found", status: 400 },
      TREASURY_WALLET_NOT_CONFIGURED: { error: "treasury_wallet_not_configured", status: 500 },
      TREASURY_ATA_NOT_FOUND: { error: "treasury_ata_not_found", status: 500 },
      UNSTAKE_TRANSFER_MISMATCH: { error: "unstake_transfer_mismatch", status: 400 },
      ALLOCATION_TRANSFER_MISMATCH: { error: "allocation_transfer_mismatch", status: 400 },
      DEVITO_MINT_NOT_CONFIGURED: { error: "devito_mint_not_configured", status: 500 },
      DEVITO_MINT_NOT_FOUND: { error: "devito_mint_not_found", status: 500 },
      TX_SIGNATURE_REQUIRED: { error: "tx_signature_required", status: 400 },
      TX_ALREADY_USED: { error: "tx_already_used", status: 400 },
      TX_NOT_FOUND: { error: "tx_not_found", status: 400 },
      TX_FAILED: { error: "tx_failed", status: 400 },
      TX_NOT_SIGNED_BY_WALLET: { error: "tx_not_signed_by_wallet", status: 400 },
      AMOUNT_INVALID: { error: "amount_invalid", status: 400 },
      DEPOSIT_AMOUNT_MISMATCH: { error: "deposit_amount_mismatch", status: 400 },
      DEPOSIT_SOURCE_MISMATCH: { error: "deposit_source_mismatch", status: 400 },
    };

    const mapped = errorMap[error.message];
    if (mapped) {
      return NextResponse.json({ ok: false, error: mapped.error }, { status: mapped.status });
    }

    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
