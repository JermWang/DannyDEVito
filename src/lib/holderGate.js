import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

function parseMinAmount(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export async function getHolderStatus(wallet) {
  const mint = process.env.NEXT_PUBLIC_HOLDER_TOKEN_MINT;
  const minAmount = parseMinAmount(process.env.NEXT_PUBLIC_HOLDER_MIN_AMOUNT);

  if (!mint) {
    return { ok: false, error: "holder_gate_not_configured" };
  }

  let owner;
  let mintPk;
  try {
    owner = new PublicKey(wallet);
    mintPk = new PublicKey(mint);
  } catch {
    return { ok: false, error: "invalid_wallet" };
  }

  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    process.env.SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com";

  const connection = new Connection(endpoint);

  try {
    const resp = await connection.getParsedTokenAccountsByOwner(owner, { mint: mintPk });
    const amount = (resp.value || []).reduce((sum, a) => {
      const ui = a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      const n = typeof ui === "number" ? ui : Number(ui || 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);

    return {
      ok: true,
      mint,
      minAmount,
      amount,
      isHolder: amount >= (minAmount || 0),
    };
  } catch {
    return { ok: false, error: "rpc_error" };
  }
}

export function buildAuthMessage(wallet, nonce) {
  return `Sign this message to verify wallet ownership for Danny DEVito Chat Logs.\n\nWallet: ${wallet}\nNonce: ${nonce}`;
}

export function verifySignature(wallet, message, signatureBase64) {
  try {
    const pubkey = new PublicKey(wallet);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Uint8Array.from(Buffer.from(signatureBase64, "base64"));
    return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkey.toBytes());
  } catch {
    return false;
  }
}
