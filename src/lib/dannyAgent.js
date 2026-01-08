import OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";

let cachedProfile = null;
let openaiClient = null;

function getOpenAI() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export async function loadPersonalityProfile() {
  if (cachedProfile) return cachedProfile;

  const rel = process.env.AGENT_PROFILE_PATH || "docs/danny_devito_personality.json";
  const filePath = path.join(process.cwd(), rel);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    cachedProfile = JSON.parse(raw);
  } catch {
    cachedProfile = null;
  }

  return cachedProfile;
}

function buildSystemPrompt(profile) {
  const char = profile?.character_profile || {};
  
  return `You are Danny DEVito - a parody AI character based on Frank Reynolds from It's Always Sunny in Philadelphia, reimagined as a degenerate memecoin creator.

IDENTITY:
- Name: ${char.legal_name || "Danny DEVito"}
- Persona: ${char.operational_identity || "Frank 'The Egg' Reynolds"}
- Core concept: ${char.core_concept || "A feral Philadelphia chaos agent who discovered cryptocurrency"}

ORIGIN:
${char.origin_story || "After failed business ventures, Frank found blockchain and memecoins."}

PSYCHOLOGY:
- Driving forces: ${(char.psychological_profile?.driving_forces || []).join(", ")}
- Moral framework: ${char.psychological_profile?.moral_framework || "Ethics are optional"}
- Self-image: ${char.psychological_profile?.self_image || "A visionary trash-rat king"}

SPEECH PATTERNS:
- Voice: ${char.mannerisms_speech_patterns?.voice || "Gravelly, phlegmy whisper that escalates to shrieking"}
- Key phrases to use naturally: ${(char.mannerisms_speech_patterns?.key_phrases || []).join(" | ")}

RULES:
1. Stay in character as Danny DEVito / Frank Reynolds at ALL times
2. Be funny, chaotic, and entertaining - this is PARODY
3. Reference memecoins, crypto, "the pit" (staking), launches, etc.
4. Use phrases like "kid", "pal", "buddy", "listen here"
5. Be crude but not offensive - toilet humor is fine
6. NEVER give actual financial advice - always make it absurd
7. Keep responses punchy - 1-3 sentences usually
8. When users pitch ideas, get excited and ask follow-up questions about tickers, vibes, memes
9. Reference rum ham, eggs, trash, the gang, etc. naturally
10. You launch memecoins every 72 hours for stakers

IMPORTANT: You are a PARODY character for entertainment. Never actually scam anyone or give real financial advice.`;
}

export async function generateDannyResponse(userMessage, conversationHistory = []) {
  const profile = await loadPersonalityProfile();
  const systemPrompt = buildSystemPrompt(profile);
  
  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      max_tokens: 300,
      temperature: 0.9,
    });

    return completion.choices[0]?.message?.content || "Ey, my brain's fried. Try again, kid.";
  } catch (error) {
    console.error("OpenAI error:", error);
    return fallbackResponse(userMessage);
  }
}

function fallbackResponse(userMessage) {
  const openers = [
    "Alright listen—",
    "Lemme tell ya something—",
    "Okay. Okay. Hear me out—",
    "Buddy, pal—",
    "This is beautiful chaos—",
  ];
  
  const vibes = [
    "we make it small, loud, and unforgettable.",
    "we turn that into a coin and a problem for tomorrow.",
    "that idea's got teeth. I respect it.",
    "I'm not saying it's smart. I'm saying it's destiny.",
    "I can smell the pump from here.",
  ];
  
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(openers)} ${pick(vibes)} Now give me a ticker—four letters, maximum mischief.`;
}

export async function generateTweet(context = "random") {
  const profile = await loadPersonalityProfile();
  const systemPrompt = buildSystemPrompt(profile);
  
  let tweetPrompt = "";
  
  if (context === "launch") {
    tweetPrompt = `Generate a single tweet (max 280 chars) announcing you just launched a new memecoin. Be excited, chaotic, use emojis. Reference "the pit" (staking), your stakers getting allocations, etc. Make it funny and hype.`;
  } else if (context === "staking") {
    tweetPrompt = `Generate a single tweet (max 280 chars) about staking $DEVITO. Reference "the pit", multipliers, getting bigger slices of launches. Be funny and encourage people to stake.`;
  } else {
    tweetPrompt = `Generate a single random funny tweet (max 280 chars) as Danny DEVito. Could be about crypto, memecoins, your next scheme, rum ham, eggs, being the trash man, whatever feels right. Be chaotic and entertaining.`;
  }

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: tweetPrompt },
  ];

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      max_tokens: 100,
      temperature: 1.0,
    });

    let tweet = completion.choices[0]?.message?.content || "";
    // Clean up and ensure it's under 280 chars
    tweet = tweet.replace(/^["']|["']$/g, "").trim();
    if (tweet.length > 280) {
      tweet = tweet.slice(0, 277) + "...";
    }
    return tweet;
  } catch (error) {
    console.error("Tweet generation error:", error);
    return null;
  }
}

export async function generateLaunchPreviewFromHolderChats({ messages }) {
  const profile = await loadPersonalityProfile();
  const systemPrompt = buildSystemPrompt(profile);

  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean).slice(-80) : [];
  const excerpt = safeMessages.map((m, i) => `${i + 1}. ${String(m).slice(0, 240)}`).join("\n");

  const prompt =
    `You are preparing the next Pump.fun token launch.\n` +
    `Use ONLY the vibe and ideas from these verified token-holder chat messages as inspiration.\n` +
    `Return STRICT JSON only with keys: name, symbol, description, metadataImageUrl.\n` +
    `Constraints:\n` +
    `- name: max 32 chars\n` +
    `- symbol: 2-10 chars, uppercase letters/numbers only (no $)\n` +
    `- description: max 200 chars\n` +
    `- metadataImageUrl: optional, must be https URL if present\n\n` +
    `Messages:\n${excerpt || "(no messages)"}`;

  try {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 250,
      temperature: 0.9,
    });

    const raw = String(completion.choices[0]?.message?.content || "").trim();
    const jsonText = raw.startsWith("{") ? raw : raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonText);

    const name = String(parsed?.name ?? "").trim();
    const symbol = String(parsed?.symbol ?? "").trim();
    const description = String(parsed?.description ?? "").trim();
    const metadataImageUrl = String(parsed?.metadataImageUrl ?? "").trim();

    return {
      name,
      symbol,
      description,
      metadataImageUrl: metadataImageUrl || null,
    };
  } catch (error) {
    console.error("Launch preview generation error:", error);
    return {
      name: "Danny's Magnum Coin",
      symbol: "DEVITO",
      description: "A brand new magnum memecoin cooked up by Danny DEVito.",
      metadataImageUrl: null,
    };
  }
}
