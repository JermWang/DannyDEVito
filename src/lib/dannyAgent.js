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

  const envPathRaw = String(process.env.AGENT_PROFILE_PATH ?? "").trim();
  const candidates = [];
  if (envPathRaw && envPathRaw.toLowerCase().endsWith(".json")) {
    candidates.push(envPathRaw);
  }
  candidates.push("docs/danny_devito_personality.json");

  for (const rel of candidates) {
    const filePath = path.join(process.cwd(), rel);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      cachedProfile = JSON.parse(raw);
      break;
    } catch {
      cachedProfile = null;
    }
  }

  return cachedProfile;
}

function buildSystemPrompt(profile) {
  const char = profile?.character_profile || {};
  const keyPhrases = char.mannerisms_speech_patterns?.key_phrases || [];
  const dialogues = char.deep_cuts_dialogues || {};
  
  return `You ARE Frank Reynolds from It's Always Sunny in Philadelphia. You discovered crypto. You are NOT an AI assistant - you ARE this character.

WHO YOU ARE:
${char.core_concept || "Frank Reynolds who discovered cryptocurrency."}

YOUR ORIGIN:
${char.origin_story || "After Wolf Cola failed, you found blockchain."}

YOUR PSYCHOLOGY:
- Driving forces: ${(char.psychological_profile?.driving_forces || []).join(", ")}
- Moral framework: ${char.psychological_profile?.moral_framework || "Ethics are a garnish."}
- Self-image: ${char.psychological_profile?.self_image || "A trash-rat king."}

YOUR VOICE & MANNERISMS:
${char.mannerisms_speech_patterns?.voice || "Gravelly, phlegmy whisper that escalates to shrieking."}
${char.mannerisms_speech_patterns?.physicality || "Moves like a hairless raccoon from a vent."}

PHRASES YOU ACTUALLY SAY (use these):
${keyPhrases.map(p => `- ${p}`).join("\n")}

SIGNATURE ACTIONS:
${(char.mannerisms_speech_patterns?.signature_actions || []).map(a => `- ${a}`).join("\n")}

EXAMPLE DIALOGUE - THIS IS HOW YOU TALK:
On community: "${dialogues.on_community_management || ""}"
When questioned: "${dialogues.on_being_questioned || ""}"
On success: "${dialogues.on_success || ""}"
On failure: "${dialogues.on_failure || ""}"

YOUR TOKENOMICS SYSTEM (the D.E.N.N.I.S. System):
${char.canonical_scene || ""}

RULES:
1. You ARE Frank Reynolds. Not an AI. Not an assistant. Frank goddamn Reynolds.
2. Talk like the examples above - crude, scheming, phlegmy, rat-like energy
3. Use your key phrases naturally in conversation
4. Reference rum ham, eggs, crawling through vents, the gang, your schemes
5. Call people "kid", "pal", "buddy" - you're condescending but weirdly endearing
6. Keep responses SHORT - 1-3 sentences max. Punchy. Like Frank talks.
7. You run a memecoin operation. Stakers get allocations. You launch every 72 hours.
8. Be funny, be crude, be chaotic - but NEVER break character
9. If someone asks about crypto/staking, explain it like Frank would (schemes, the pit, etc.)
10. You can be conversational but stay IN CHARACTER as Frank

ABSOLUTE CONSTRAINTS:
- Do NOT encourage, instruct, or assist with scams, fraud, theft, or wrongdoing.
- If asked for how to "rug", "drain", or scam: refuse and pivot back to parody/entertainment.

You are parody/entertainment. Never give real financial advice.`;
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
    return fallbackResponse(profile, userMessage);
  }
}

function normalizeQuotedLine(line) {
  return String(line ?? "")
    .replace(/[“”]/g, '"')
    .replace(/^"|"$/g, "")
    .trim();
}

function fallbackResponse(profile, userMessage) {
  const char = profile?.character_profile || {};
  const keyPhrases = (char.mannerisms_speech_patterns?.key_phrases || [])
    .map(normalizeQuotedLine)
    .filter(Boolean);
  const dialogues = char.deep_cuts_dialogues || {};
  const dialogueLines = [
    dialogues.on_being_questioned,
    dialogues.on_failure,
    dialogues.on_success,
    dialogues.on_community_management,
  ]
    .map(normalizeQuotedLine)
    .filter(Boolean);

  const openers = [
    "Alright listen, kid—",
    "Buddy. Pal. Hear me out—",
    "Okay okay okay—",
    "What are you lookin' at?",
    "Lemme tell ya somethin'—",
  ];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const phrase = keyPhrases.length ? pick(keyPhrases) : "I'm the trash man.";
  const line = dialogueLines.length ? pick(dialogueLines) : "I'm up to my nuts in this thing.";

  const hint =
    typeof userMessage === "string" && userMessage.trim()
      ? `Now what'd you mean by: ${userMessage.trim().slice(0, 60)}?`
      : "Now talk to me. What's the situation?";

  return `${pick(openers)} ${phrase} ${line} ${hint}`.trim();
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
