import { NextResponse } from "next/server";
import { Keypair, PublicKey } from "@solana/web3.js";

import { prisma } from "@/lib/prisma";
import { verifyAdminRequest } from "@/lib/adminAuth";
import { getConnection, getSolanaCaip2, privySignAndSendSolanaTransaction, privyGetWallet } from "@/lib/privyServer";
import { buildUnsignedPumpfunCreateV2Tx } from "@/lib/pumpfun";
import { calculateStakerTokensFromTotalSupply, createLaunchAllocations } from "@/lib/staking";

const TOTAL_SUPPLY = 1_000_000_000;
const STAKER_SHARE = 0.05 * 0.02;

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

    const payload = {
      name: String(body?.name ?? "").trim(),
      symbol: String(body?.symbol ?? "").trim(),
      uri: String(body?.uri ?? "").trim(),
      spendableSolLamports: String(body?.spendableSolLamports ?? "").trim(),
    };

    const authResult = await verifyAdminRequest({
      wallet,
      nonce,
      signatureBase64: signature,
      action: "launch",
      payload,
    });

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authStatus(authResult.error) });
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

    const name = payload.name;
    const symbol = payload.symbol;
    const uri = payload.uri;
    const spendableSolLamports = BigInt(payload.spendableSolLamports || "100000000");

    if (!name || name.length > 32) {
      return NextResponse.json({ ok: false, error: "name_invalid" }, { status: 400 });
    }
    if (!symbol || symbol.length > 10) {
      return NextResponse.json({ ok: false, error: "symbol_invalid" }, { status: 400 });
    }
    if (!uri || !/^https?:\/\//i.test(uri)) {
      return NextResponse.json({ ok: false, error: "uri_invalid" }, { status: 400 });
    }

    const mintKeypair = Keypair.generate();
    const connection = getConnection();

    const built = await buildUnsignedPumpfunCreateV2Tx({
      connection,
      user: treasuryPubkey,
      mint: mintKeypair.publicKey,
      name,
      symbol,
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

    const launch = await prisma.launch.create({
      data: {
        name,
        ticker: symbol,
        mint: mintKeypair.publicKey.toBase58(),
        pumpUrl: `https://pump.fun/coin/${mintKeypair.publicKey.toBase58()}`,
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
      console.error("[Admin Launch] Failed to create allocations:", e?.message || e);
    }

    console.log("[Admin Launch] Token launched:", {
      launchId: launch.id,
      mint: mintKeypair.publicKey.toBase58(),
      signature: sent.signature,
    });

    return NextResponse.json({
      ok: true,
      launchId: launch.id,
      signature: sent.signature,
      explorerUrl: `https://solscan.io/tx/${encodeURIComponent(sent.signature)}`,
      mint: mintKeypair.publicKey.toBase58(),
      pumpUrl: `https://pump.fun/coin/${mintKeypair.publicKey.toBase58()}`,
      bondingCurve: built.bondingCurve.toBase58(),
    });
  } catch (e) {
    console.error("[Admin Launch] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "launch_failed" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const wallet = String(req.headers.get("x-admin-wallet") ?? "").trim();
    const nonce = String(req.headers.get("x-admin-nonce") ?? "").trim();
    const signature = String(req.headers.get("x-admin-signature") ?? "").trim();

    const authResult = await verifyAdminRequest({
      wallet,
      nonce,
      signatureBase64: signature,
      action: "launch_get",
      payload: {},
      consumeNonce: false,
    });

    if (!authResult.ok) {
      return NextResponse.json({ ok: false, error: authResult.error }, { status: authStatus(authResult.error) });
    }

    const launches = await prisma.launch.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      launches: launches.map((l) => ({
        id: l.id,
        name: l.name,
        ticker: l.ticker,
        mint: l.mint,
        pumpUrl: l.pumpUrl,
        status: l.status,
        launchedAt: l.launchedAt?.toISOString() || null,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[Admin Launch GET] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }
}
