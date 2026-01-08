import crypto from "crypto";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

function canonicalizeJson(value) {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "string") return JSON.stringify(value);
  if (t === "number") return JSON.stringify(value);
  if (t === "boolean") return value ? "true" : "false";
  if (t !== "object") return "null";

  if (Array.isArray(value)) {
    const parts = value.map((v) => (v === undefined ? "null" : canonicalizeJson(v)));
    return `[${parts.join(",")}]`;
  }

  const obj = value;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const parts = [];
  for (const k of keys) {
    parts.push(`${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
  }
  return `{${parts.join(",")}}`;
}

function getPrivyAuthorizationPrivateKeys() {
  const raw =
    String(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEYS ?? "").trim() ||
    String(process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY ?? "").trim() ||
    String(process.env.PRIVY_AUTHORIZATION_KEY ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function privateKeyToKeyObject(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) throw new Error("Missing authorization private key");

  if (trimmed.includes("BEGIN PRIVATE KEY")) {
    return crypto.createPrivateKey({ key: trimmed, format: "pem" });
  }

  const base64 = trimmed.startsWith("wallet-auth:") ? trimmed.slice("wallet-auth:".length) : trimmed;
  const pem = `-----BEGIN PRIVATE KEY-----\n${base64}\n-----END PRIVATE KEY-----`;
  return crypto.createPrivateKey({ key: pem, format: "pem" });
}

function signPrivyRequest({ method, url, appId, body, idempotencyKey }) {
  const payloadHeaders = {
    "privy-app-id": appId,
    "content-type": "application/json",
  };
  if (idempotencyKey) payloadHeaders["privy-idempotency-key"] = idempotencyKey;

  const payload = {
    version: 1,
    method,
    url,
    body: body == null ? {} : body,
    headers: payloadHeaders,
  };

  const serializedPayload = canonicalizeJson(payload);
  const buf = Buffer.from(serializedPayload);

  const keys = getPrivyAuthorizationPrivateKeys();
  if (keys.length === 0) return "";

  const sigs = [];
  for (const k of keys) {
    const keyObj = privateKeyToKeyObject(k);
    const data = new Uint8Array(buf);
    const signatureBuffer = crypto.sign("sha256", data, keyObj);
    sigs.push(signatureBuffer.toString("base64"));
  }
  return sigs.join(",");
}

function mustGetPrivyCreds() {
  const appId = String(process.env.PRIVY_APP_ID ?? "").trim();
  const appSecret = String(process.env.PRIVY_APP_SECRET ?? "").trim();
  if (!appId || !appSecret) {
    throw new Error("PRIVY_APP_ID and PRIVY_APP_SECRET are required");
  }
  return { appId, appSecret };
}

function basicAuthHeader(appId, appSecret) {
  const raw = `${appId}:${appSecret}`;
  return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
}

function idempotencyKey(prefix) {
  const rand = crypto.randomBytes(12).toString("hex");
  return `${prefix}:${rand}`;
}

async function privyFetchJson({ method, path, body, idempotencyKey: idemKey }) {
  const { appId, appSecret } = mustGetPrivyCreds();

  const url = `https://api.privy.io${path}`;

  const headers = {
    authorization: basicAuthHeader(appId, appSecret),
    "content-type": "application/json",
    "privy-app-id": appId,
  };

  if (idemKey) {
    headers["privy-idempotency-key"] = idemKey;
    headers["idempotency-key"] = idemKey;
  }

  if (method !== "GET") {
    const sig = signPrivyRequest({
      method,
      url,
      appId,
      body,
      idempotencyKey: idemKey,
    });
    if (sig) headers["privy-authorization-signature"] = sig;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = typeof json?.error === "string" && json.error.length ? json.error : `Privy request failed (${res.status})`;
    throw new Error(msg);
  }

  return json;
}

export async function privyCreateSolanaWallet() {
  const json = await privyFetchJson({
    method: "POST",
    path: "/v1/wallets",
    body: { chain_type: "solana" },
    idempotencyKey: idempotencyKey("dd:createWallet"),
  });

  const walletId = String(json?.id ?? "").trim();
  const address = String(json?.address ?? "").trim();

  if (!walletId || !address) {
    throw new Error("Privy returned an invalid wallet response");
  }

  return { walletId, address };
}

export async function privyGetWallet(walletId) {
  const json = await privyFetchJson({
    method: "GET",
    path: `/v1/wallets/${encodeURIComponent(walletId)}`,
  });

  return {
    walletId: String(json?.id ?? "").trim(),
    address: String(json?.address ?? "").trim(),
    chainType: String(json?.chain_type ?? "").trim(),
  };
}

export async function privySignAndSendSolanaTransaction({ walletId, caip2, transactionBase64 }) {
  const wId = String(walletId ?? "").trim();
  const chain = String(caip2 ?? "").trim();
  const tx = String(transactionBase64 ?? "").trim();

  if (!wId) throw new Error("walletId required");
  if (!chain) throw new Error("caip2 required");
  if (!tx) throw new Error("transactionBase64 required");

  const json = await privyFetchJson({
    method: "POST",
    path: `/v1/wallets/${encodeURIComponent(wId)}/rpc`,
    body: {
      method: "signAndSendTransaction",
      caip2: chain,
      sponsor: false,
      params: {
        transaction: tx,
        encoding: "base64",
      },
    },
    idempotencyKey: idempotencyKey("dd:signAndSendSolana"),
  });

  const signature = String(json?.data?.hash ?? "").trim();
  const transactionId = json?.data?.transaction_id != null ? String(json.data.transaction_id) : undefined;

  if (!signature) {
    throw new Error("Privy did not return a transaction hash");
  }

  return { signature, transactionId };
}

export async function privySignSolanaTransaction({ walletId, transactionBase64 }) {
  const wId = String(walletId ?? "").trim();
  const tx = String(transactionBase64 ?? "").trim();

  if (!wId) throw new Error("walletId required");
  if (!tx) throw new Error("transactionBase64 required");

  const json = await privyFetchJson({
    method: "POST",
    path: `/v1/wallets/${encodeURIComponent(wId)}/rpc`,
    body: {
      method: "signTransaction",
      params: {
        transaction: tx,
        encoding: "base64",
      },
    },
    idempotencyKey: idempotencyKey("dd:signSolana"),
  });

  const signed =
    String(json?.data?.signed_transaction ?? "").trim() ||
    String(json?.data?.signedTransaction ?? "").trim() ||
    String(json?.data?.transaction ?? "").trim();

  if (!signed) {
    throw new Error("Privy did not return a signed transaction");
  }

  return { signedTransactionBase64: signed };
}

export function getConnection() {
  const endpoint =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    "https://api.mainnet-beta.solana.com";
  return new Connection(endpoint, "confirmed");
}

export function getSolanaCaip2() {
  const explicit = String(process.env.SOLANA_CAIP2 ?? "").trim();
  if (explicit) return explicit;

  const cluster =
    String(process.env.SOLANA_CLUSTER ?? "").trim() ||
    String(process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "").trim() ||
    "mainnet-beta";

  if (cluster === "devnet") return "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
  if (cluster === "testnet") return "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z";
  return "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
}

export async function privyTransferLamports({ walletId, fromPubkey, toPubkey, lamports, caip2 }) {
  const wId = String(walletId ?? "").trim();
  const chain = String(caip2 ?? "").trim();
  const amount = Math.floor(Number(lamports ?? 0));

  if (!wId) return { ok: false, error: "walletId required" };
  if (!chain) return { ok: false, error: "caip2 required" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "lamports must be > 0" };

  try {
    const connection = getConnection();
    const tx = new Transaction();
    tx.feePayer = fromPubkey;
    tx.add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: amount,
      })
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;

    const txBytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const txBase64 = Buffer.from(Uint8Array.from(txBytes)).toString("base64");

    const sent = await privySignAndSendSolanaTransaction({
      walletId: wId,
      caip2: chain,
      transactionBase64: txBase64,
    });

    return { ok: true, signature: sent.signature };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function getWalletBalance(pubkey) {
  const connection = getConnection();
  const balance = await connection.getBalance(pubkey, "confirmed");
  return balance;
}

export async function getTokenBalance(ownerPubkey, mintPubkey) {
  const connection = getConnection();
  const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
  
  try {
    const resp = await connection.getParsedTokenAccountsByOwner(ownerPubkey, { mint: mintPubkey });
    const amount = (resp.value || []).reduce((sum, a) => {
      const ui = a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount;
      const n = typeof ui === "number" ? ui : Number(ui || 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    return amount;
  } catch {
    return 0;
  }
}
