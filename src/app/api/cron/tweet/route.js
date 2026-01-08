import { NextResponse } from "next/server";
import { generateTweet } from "@/lib/dannyAgent";
import { postTweet, isTwitterConfigured } from "@/lib/twitter";

/**
 * Cron endpoint for automated tweets
 * 
 * Set up in vercel.json to run periodically (e.g., every 6 hours)
 * Requires CRON_SECRET env var for security
 */
export async function GET(req) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ ok: false, error: "cron_not_configured" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    if (!isTwitterConfigured()) {
      return NextResponse.json({ ok: false, error: "twitter_not_configured" }, { status: 500 });
    }

    // Generate a random tweet
    const tweetText = await generateTweet("random");

    if (!tweetText) {
      return NextResponse.json({ ok: false, error: "tweet_generation_failed" }, { status: 500 });
    }

    const result = await postTweet(tweetText);

    if (!result.ok) {
      console.error("[Cron Tweet] Failed:", result.error);
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    console.log("[Cron Tweet] Success:", result.tweetId);
    return NextResponse.json({
      ok: true,
      tweetId: result.tweetId,
      text: tweetText,
    });
  } catch (error) {
    console.error("[Cron Tweet] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
