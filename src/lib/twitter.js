/**
 * Twitter/X API Integration for Danny DEVito
 * 
 * Uses Twitter API v2 for posting tweets
 * Requires: TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET
 */

import crypto from "node:crypto";

const TWITTER_API_URL = "https://api.twitter.com/2/tweets";

function getTwitterConfig() {
  const clientId = String(process.env.X_CLIENT_ID ?? "").trim();
  const clientSecret = String(process.env.X_CLIENT_SECRET ?? "").trim();
  const redirectUri = String(process.env.X_REDIRECT_URI ?? "").trim();

  const consumerKey = String(process.env.TWITTER_API_KEY ?? "").trim() || clientId;
  const consumerSecret = String(process.env.TWITTER_API_SECRET ?? "").trim() || clientSecret;

  const oauth2AccessToken = String(process.env.X_ACCESS_TOKEN ?? "").trim();

  const accessToken = String(process.env.TWITTER_ACCESS_TOKEN ?? "").trim();
  const accessSecret = String(process.env.TWITTER_ACCESS_SECRET ?? "").trim();

  return {
    clientId,
    clientSecret,
    redirectUri,
    consumerKey,
    consumerSecret,
    oauth2AccessToken,
    accessToken,
    accessSecret,
  };
}

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, "%21")
    .replace(/\*/g, "%2A")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&");

  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sortedParams),
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;

  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBaseString)
    .digest("base64");

  return signature;
}

function generateOAuthHeader(method, url, consumerKey, consumerSecret, accessToken, accessSecret) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0",
  };

  const signature = generateOAuthSignature(
    method,
    url,
    oauthParams,
    consumerSecret,
    accessSecret
  );

  oauthParams.oauth_signature = signature;

  const authHeader = Object.keys(oauthParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${authHeader}`;
}

export async function postTweet(text) {
  const cfg = getTwitterConfig();

  const hasOAuth2 = Boolean(cfg.oauth2AccessToken);
  const hasOAuth1 = Boolean(cfg.consumerKey && cfg.consumerSecret && cfg.accessToken && cfg.accessSecret);

  if (!hasOAuth2 && !hasOAuth1) {
    console.error("Twitter credentials not configured");
    return { ok: false, error: "twitter_not_configured" };
  }

  try {
    const headers = {
      "Content-Type": "application/json",
    };

    if (hasOAuth2) {
      headers.Authorization = `Bearer ${cfg.oauth2AccessToken}`;
    } else {
      const authHeader = generateOAuthHeader(
        "POST",
        TWITTER_API_URL,
        cfg.consumerKey,
        cfg.consumerSecret,
        cfg.accessToken,
        cfg.accessSecret
      );
      headers.Authorization = authHeader;
    }

    const response = await fetch(TWITTER_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ text }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twitter API error:", data);
      return { ok: false, error: data?.detail || "tweet_failed", status: response.status };
    }

    console.log("Tweet posted successfully:", data?.data?.id);
    return { ok: true, tweetId: data?.data?.id, text };
  } catch (error) {
    console.error("Twitter post error:", error);
    return { ok: false, error: error.message };
  }
}

export function isTwitterConfigured() {
  const cfg = getTwitterConfig();
  const oauth2 = Boolean(cfg.oauth2AccessToken);
  const oauth1 = Boolean(cfg.consumerKey && cfg.consumerSecret && cfg.accessToken && cfg.accessSecret);
  return oauth2 || oauth1;
}
