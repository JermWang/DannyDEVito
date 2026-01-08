import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/dannyAgent";
import { postTweet, isTwitterConfigured } from "@/lib/twitter";
import { verifyAdminRequest } from "@/lib/adminAuth";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    const wallet = String(body?.wallet ?? "").trim();
    const nonce = String(body?.nonce ?? "").trim();
    const signature = String(body?.signature ?? "").trim();

    const context = String(body?.context ?? "random").trim() || "random";
    const customText = body?.customText;
    const payload = {
      context,
      customText: typeof customText === "string" ? customText.trim().slice(0, 280) : "",
    };

    const authResult = await verifyAdminRequest({
      wallet,
      nonce,
      signatureBase64: signature,
      action: "tweet",
      payload,
    });

    if (!authResult.ok) {
      const status = authResult.error === "auth_required" ? 400 : 401;
      return NextResponse.json({ ok: false, error: authResult.error }, { status });
    }

    if (!isTwitterConfigured()) {
      return NextResponse.json({ ok: false, error: "twitter_not_configured" }, { status: 500 });
    }

    let tweetText;
    if (customText && typeof customText === "string" && customText.trim()) {
      tweetText = customText.trim().slice(0, 280);
    } else {
      tweetText = await generateTweet(context);
    }

    if (!tweetText) {
      return NextResponse.json({ ok: false, error: "tweet_generation_failed" }, { status: 500 });
    }

    const result = await postTweet(tweetText);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      tweetId: result.tweetId,
      text: tweetText,
      context,
    });
  } catch (error) {
    console.error("[Twitter Tweet] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: isTwitterConfigured(),
  });
}
