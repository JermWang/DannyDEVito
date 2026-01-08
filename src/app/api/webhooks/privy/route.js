import crypto from "crypto";
import { NextResponse } from "next/server";

function mustGetWebhookSecret() {
  const raw = String(process.env.PRIVY_WEBHOOK_SIGNING_SECRET ?? "").trim();
  if (!raw) throw new Error("PRIVY_WEBHOOK_SIGNING_SECRET is required");
  return raw;
}

function parseSvixSignatures(header) {
  const parts = header
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);

  const out = [];
  for (const p of parts) {
    const [version, sig] = p.split(",");
    if (version === "v1" && sig) out.push(sig);
  }
  return out;
}

function timingSafeEqualBase64(a, b) {
  try {
    const aa = Buffer.from(a, "base64");
    const bb = Buffer.from(b, "base64");
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  } catch {
    return false;
  }
}

const seenWebhookIds = new Map();

function markAndCheckDuplicate(id) {
  const now = Date.now();
  const existing = seenWebhookIds.get(id);
  if (existing) return true;

  seenWebhookIds.set(id, { ts: now });

  if (seenWebhookIds.size > 1000) {
    for (const [k, v] of seenWebhookIds) {
      if (now - v.ts > 10 * 60 * 1000) seenWebhookIds.delete(k);
    }
  }

  return false;
}

function verifySvix({ body, id, timestamp, signature, secret }) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 5 * 60) return false;

  const signedContent = `${id}.${timestamp}.${body}`;

  const secretPart = secret.startsWith("whsec_") ? secret.split("_")[1] : secret;
  if (!secretPart) return false;

  const secretBytes = Buffer.from(secretPart, "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent, "utf8").digest("base64");

  const candidates = parseSvixSignatures(signature);
  if (!candidates.length) return false;

  return candidates.some((sig) => timingSafeEqualBase64(sig, expected));
}

export async function POST(req) {
  try {
    const secret = mustGetWebhookSecret();

    const id = req.headers.get("svix-id") ?? "";
    const timestamp = req.headers.get("svix-timestamp") ?? "";
    const signature = req.headers.get("svix-signature") ?? "";

    if (!id || !timestamp || !signature) {
      return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
    }

    const body = await req.text();

    if (!verifySvix({ body, id, timestamp, signature, secret })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const type = typeof payload?.type === "string" ? payload.type : "";

    const walletId = typeof payload?.wallet_id === "string" ? payload.wallet_id : "";
    const transactionId = typeof payload?.transaction_id === "string" ? payload.transaction_id : "";
    const caip2 = typeof payload?.caip2 === "string" ? payload.caip2 : "";
    const transactionHash = typeof payload?.transaction_hash === "string" ? payload.transaction_hash : "";
    const isTransaction = type.startsWith("transaction.");
    const transactionStatus = isTransaction ? type.slice("transaction.".length) : "";

    if (markAndCheckDuplicate(id)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    console.log("[Privy Webhook]", {
      type,
      svixId: id,
      walletId: walletId || null,
      transactionId: transactionId || null,
      transactionHash: transactionHash || null,
      transactionStatus: transactionStatus || null,
    });

    if (isTransaction && (transactionStatus === "failed" || transactionStatus === "provider_error" || transactionStatus === "execution_reverted")) {
      console.error("[Privy Webhook] Transaction error:", {
        status: transactionStatus,
        walletId,
        transactionId,
        transactionHash,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Privy Webhook] Error:", e?.message || e);
    return NextResponse.json({ error: "Webhook handler error" }, { status: 500 });
  }
}
