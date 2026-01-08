import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

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

export function buildAdminAuthMessage(wallet, nonce, action) {
  return `Danny DEVito Admin Action\n\nWallet: ${wallet}\nAction: ${action}\nNonce: ${nonce}`;
}
