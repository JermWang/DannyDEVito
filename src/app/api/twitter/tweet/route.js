import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/dannyAgent";
import { postTweet, isTwitterConfigured } from "@/lib/twitter";
import { verifyAdminSignature, buildAdminAuthMessage } from "@/lib/adminAuth";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    // Check if this is an admin-triggered tweet or a cron job
    const cronSecret = process.env.CRON_SECRET;
    const isCronRequest = body?.cronSecret && cronSecret && body.cronSecret === cronSecret;

    if (!isCronRequest) {
      // Require admin auth for manual tweets
      const wallet = String(body?.wallet ?? "").trim();
      const nonce = String(body?.nonce ?? "").trim();
      const signature = String(body?.signature ?? "").trim();

      if (!wallet || !nonce || !signature) {
        return NextResponse.json({ ok: false, error: "auth_required" }, { status: 400 });
      }

      const message = buildAdminAuthMessage(wallet, nonce, "tweet");
      const authResult = verifyAdminSignature({ wallet, message, signatureBase64: signature });
      if (!authResult.ok) {
        return NextResponse.json({ ok: false, error: authResult.error }, { status: 401 });
      }
    }

    if (!isTwitterConfigured()) {
      return NextResponse.json({ ok: false, error: "twitter_not_configured" }, { status: 500 });
    }

    // Get tweet context (launch, staking, or random)
    const context = body?.context || "random";
    const customText = body?.customText;

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
