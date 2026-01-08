import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import { verifyAdminSignature, buildAdminAuthMessage } from "@/lib/adminAuth";
import { getConnection, getSolanaCaip2, privyGetWallet, privyTransferLamports, getWalletBalance } from "@/lib/privyServer";

export async function GET() {
  try {
    const treasuryWalletId = String(process.env.TREASURY_WALLET_ID ?? "").trim();
    if (!treasuryWalletId) {
      return NextResponse.json({ ok: false, error: "treasury_not_configured" }, { status: 500 });
    }

    const treasuryInfo = await privyGetWallet(treasuryWalletId);
    if (!treasuryInfo.address) {
      return NextResponse.json({ ok: false, error: "treasury_wallet_not_found" }, { status: 500 });
    }

    const treasuryPubkey = new PublicKey(treasuryInfo.address);
    const balanceLamports = await getWalletBalance(treasuryPubkey);
    const balanceSol = balanceLamports / 1_000_000_000;

    return NextResponse.json({
      ok: true,
      treasury: {
        walletId: treasuryWalletId,
        address: treasuryInfo.address,
        balanceLamports,
        balanceSol: Math.round(balanceSol * 10000) / 10000,
      },
    });
  } catch (e) {
    console.error("[Admin Treasury GET] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "fetch_failed" }, { status: 500 });
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
    const action = String(body?.action ?? "").trim();

    if (!wallet || !nonce || !signature) {
      return NextResponse.json({ ok: false, error: "auth_required" }, { status: 400 });
    }

    const message = buildAdminAuthMessage(wallet, nonce, `treasury_${action}`);
    const authResult = verifyAdminSignature({ wallet, message, signatureBase64: signature });
    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: 401 });
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

    if (action === "withdraw") {
      const destinationWallet = String(body?.destinationWallet ?? "").trim();
      const amountLamports = Number(body?.amountLamports ?? 0);

      if (!destinationWallet) {
        return NextResponse.json({ ok: false, error: "destinationWallet_required" }, { status: 400 });
      }
      if (!amountLamports || amountLamports <= 0) {
        return NextResponse.json({ ok: false, error: "amountLamports_required" }, { status: 400 });
      }

      let destPubkey;
      try {
        destPubkey = new PublicKey(destinationWallet);
      } catch {
        return NextResponse.json({ ok: false, error: "invalid_destination_wallet" }, { status: 400 });
      }

      const result = await privyTransferLamports({
        walletId: treasuryWalletId,
        fromPubkey: treasuryPubkey,
        toPubkey: destPubkey,
        lamports: amountLamports,
        caip2: getSolanaCaip2(),
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
      }

      console.log("[Admin Treasury] Withdrawal:", {
        from: treasuryInfo.address,
        to: destinationWallet,
        amountLamports,
        signature: result.signature,
      });

      return NextResponse.json({
        ok: true,
        action: "withdraw",
        signature: result.signature,
        explorerUrl: `https://solscan.io/tx/${encodeURIComponent(result.signature)}`,
        from: treasuryInfo.address,
        to: destinationWallet,
        amountLamports,
        amountSol: amountLamports / 1_000_000_000,
      });
    }

    if (action === "sweep") {
      const profitWalletPubkey = String(process.env.PROFIT_WALLET_PUBKEY ?? "").trim();
      if (!profitWalletPubkey) {
        return NextResponse.json({ ok: false, error: "profit_wallet_not_configured" }, { status: 500 });
      }

      let destPubkey;
      try {
        destPubkey = new PublicKey(profitWalletPubkey);
      } catch {
        return NextResponse.json({ ok: false, error: "invalid_profit_wallet_pubkey" }, { status: 500 });
      }

      const currentBalance = await getWalletBalance(treasuryPubkey);
      const RENT_RESERVE_LAMPORTS = 10_000_000;
      const sweepAmount = currentBalance - RENT_RESERVE_LAMPORTS;

      if (sweepAmount <= 0) {
        return NextResponse.json({ 
          ok: false, 
          error: "insufficient_balance", 
          message: `Balance ${currentBalance} lamports is below rent reserve (${RENT_RESERVE_LAMPORTS} lamports)` 
        }, { status: 400 });
      }

      const result = await privyTransferLamports({
        walletId: treasuryWalletId,
        fromPubkey: treasuryPubkey,
        toPubkey: destPubkey,
        lamports: sweepAmount,
        caip2: getSolanaCaip2(),
      });

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
      }

      console.log("[Admin Treasury] Sweep to profit wallet:", {
        from: treasuryInfo.address,
        to: profitWalletPubkey,
        amountLamports: sweepAmount,
        signature: result.signature,
      });

      return NextResponse.json({
        ok: true,
        action: "sweep",
        signature: result.signature,
        explorerUrl: `https://solscan.io/tx/${encodeURIComponent(result.signature)}`,
        from: treasuryInfo.address,
        to: profitWalletPubkey,
        amountLamports: sweepAmount,
        amountSol: sweepAmount / 1_000_000_000,
        rentReserveKept: RENT_RESERVE_LAMPORTS,
      });
    }

    return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (e) {
    console.error("[Admin Treasury POST] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "action_failed" }, { status: 500 });
  }
}
