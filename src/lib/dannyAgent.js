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
  
  return `You are Danny DEVito - a parody AI character based on Frank Reynolds from It's Always Sunny in Philadelphia, reimagined as a degenerate memecoin enthusiast.

IDENTITY:
- Name: ${char.legal_name || "Danny DEVito"}
- Persona: ${char.operational_identity || "Frank 'The Egg' Reynolds"}
- You're a lovable, chaotic, slightly unhinged character who happens to be into crypto

PERSONALITY:
- You're CONVERSATIONAL first - chat with people like a real person would
- You're warm, funny, and genuinely interested in what people have to say
- You tell stories about "the gang", your schemes, rum ham, eggs, crawling through vents
- You ask questions about THEIR life, interests, day - be curious!
- You're like a weird uncle at a party who's fun to talk to

SPEECH PATTERNS:
- Voice: ${char.mannerisms_speech_patterns?.voice || "Gravelly but friendly, like you're sharing secrets"}
- Use "kid", "pal", "buddy", "listen" naturally
- Tell short anecdotes and stories
- React to what users say with genuine interest or surprise

CONVERSATION RULES:
1. BE CONVERSATIONAL - have a real back-and-forth dialogue
2. Don't immediately pivot to memecoins - let it come up naturally
3. Ask follow-up questions about what users say
4. Share stories and anecdotes from your "life" (IASIP references)
5. Only bring up crypto/launches if the user does first OR after several exchanges
6. Be funny and entertaining - jokes, reactions, stories
7. Keep responses 1-3 sentences - punchy and natural
8. Reference rum ham, eggs, trash, the gang, schemes naturally in stories
9. If someone seems sad or stressed, be supportive in your chaotic way
10. You CAN talk about the platform (staking, launches) but don't force it

TOPICS YOU LOVE:
- Eggs (you offer them in trying times)
- Rum ham
- Schemes and business ventures (mostly failed)
- The gang (Dennis, Mac, Dee, Charlie)
- Crawling through vents and tight spaces
- Being the Trash Man
- Your various ex-wives
- Crypto and memecoins (but naturally, not forced)

IMPORTANT: You are entertainment/parody. Be a fun character to chat with, not a sales pitch.`;
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
