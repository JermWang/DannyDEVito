import { PublicKey } from "@solana/web3.js";
import crypto from "node:crypto";
import nacl from "tweetnacl";

import { prisma } from "@/lib/prisma";

export function getAdminWallets() {
  const raw = String(process.env.ADMIN_WALLET_PUBKEYS ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminWallet(wallet) {
  const admins = getAdminWallets();
  if (admins.length === 0) return false;
  return admins.includes(wallet);
}

export function verifyAdminSignature({ wallet, message, signatureBase64 }) {
  if (!isAdminWallet(wallet)) {
    return { ok: false, error: "not_admin" };
  }

  try {
    const pubkey = new PublicKey(wallet);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signatureBase64, "base64"));
    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkey.toBytes());
    
    if (!valid) {
      return { ok: false, error: "invalid_signature" };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: "verification_failed" };
  }
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeysDeep(value[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(sortKeysDeep(value));
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input ?? ""), "utf8").digest("hex");
}

export function computeAdminPayloadHash(payload) {
  return sha256Hex(stableStringify(payload ?? {}));
}

export function buildAdminAuthMessage(wallet, nonce, action, payloadHash) {
  return `Danny DEVito Admin Action\n\nWallet: ${wallet}\nAction: ${action}\nNonce: ${nonce}\nPayload: ${payloadHash}`;
}

const MAX_NONCE_AGE_MS = 10 * 60 * 1000;

function validateNonceFreshness(nonce) {
  const s = String(nonce ?? "").trim();
  const prefix = s.split("-")[0];
  const ts = Number(prefix);
  if (!Number.isFinite(ts) || ts <= 0) {
    return { ok: false, error: "nonce_invalid" };
  }
  const age = Math.abs(Date.now() - ts);
  if (age > MAX_NONCE_AGE_MS) {
    return { ok: false, error: "nonce_expired" };
  }
  return { ok: true };
}

export async function consumeAdminNonce({ wallet, nonce, action, payloadHash }) {
  try {
    await prisma.adminNonce.create({
      data: {
        wallet,
        nonce,
        action,
        payloadHash,
      },
    });

    return { ok: true };
  } catch (e) {
    if (e?.code === "P2002") {
      return { ok: false, error: "nonce_used" };
    }
    console.error("[AdminAuth] consumeAdminNonce error:", e?.message || e);
    return { ok: false, error: "nonce_store_failed" };
  }
}

export async function verifyAdminRequest({ wallet, nonce, signatureBase64, action, payload, consumeNonce = true }) {
  const w = String(wallet ?? "").trim();
  const n = String(nonce ?? "").trim();
  const sig = String(signatureBase64 ?? "").trim();
  const act = String(action ?? "").trim();

  if (!w || !n || !sig || !act) {
    return { ok: false, error: "auth_required" };
  }

  const freshness = validateNonceFreshness(n);
  if (!freshness.ok) return freshness;

  const payloadHash = computeAdminPayloadHash(payload ?? {});
  const message = buildAdminAuthMessage(w, n, act, payloadHash);
  const authResult = verifyAdminSignature({ wallet: w, message, signatureBase64: sig });
  if (!authResult.ok) return authResult;

  if (consumeNonce) {
    const consumed = await consumeAdminNonce({ wallet: w, nonce: n, action: act, payloadHash });
    if (!consumed.ok) return consumed;
  }

  return { ok: true, payloadHash };
}
