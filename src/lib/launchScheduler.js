import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";
import { generateLaunchPreviewFromHolderChats } from "@/lib/dannyAgent";

const INITIAL_DELAY_MS = 12 * 60 * 60 * 1000;
const CADENCE_HOURS_DEFAULT = 72;
const PREVIEW_GENERATE_MS = 60 * 60 * 1000;

export function getAppUrl() {
  const explicit = String(process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = String(process.env.VERCEL_URL ?? "").trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return "";
}

export async function getOrInitLaunchSchedule() {
  const existing = await prisma.launchSchedule.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;

  const nextLaunchAt = new Date(Date.now() + INITIAL_DELAY_MS);
  return prisma.launchSchedule.create({
    data: {
      nextLaunchAt,
      cadenceHours: CADENCE_HOURS_DEFAULT,
    },
  });
}

export function computePreviewGenerateAt(nextLaunchAt) {
  const t = new Date(nextLaunchAt).getTime();
  return new Date(t - PREVIEW_GENERATE_MS);
}

export async function getInfluenceWindow() {
  const last = await prisma.launch.findFirst({
    where: { launchedAt: { not: null } },
    orderBy: { launchedAt: "desc" },
    select: { launchedAt: true },
  });

  if (last?.launchedAt) return last.launchedAt;
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export async function fetchHolderInfluenceMessages({ since, limit = 200 }) {
  const rows = await prisma.dannyChat.findMany({
    where: {
      wallet: { not: null },
      role: "user",
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(500, Number(limit) || 200)),
    select: { content: true, wallet: true, createdAt: true },
  });

  return rows.map((r) => ({
    wallet: r.wallet,
    createdAt: r.createdAt,
    content: r.content,
  }));
}

function normalizeName(v) {
  const s = String(v ?? "").trim();
  if (!s) return "Danny's Magnum Coin";
  return s.slice(0, 32);
}

function normalizeTicker(v) {
  const s = String(v ?? "").trim().replace(/^\$/, "");
  const up = s.toUpperCase();
  if (!up) return "DEVITO";
  return up.slice(0, 10);
}

function normalizeDescription(v) {
  const s = String(v ?? "").trim();
  if (!s) return "A brand new magnum memecoin cooked up by Danny DEVito.";
  return s.slice(0, 500);
}

export async function ensureScheduledDraft({ scheduledAt }) {
  const when = new Date(scheduledAt);

  const existing = await prisma.scheduledLaunchDraft.findUnique({
    where: { scheduledAt: when },
  });
  if (existing) return existing;

  const since = await getInfluenceWindow();
  const messages = await fetchHolderInfluenceMessages({ since, limit: 200 });

  const suggestion = await generateLaunchPreviewFromHolderChats({
    messages: messages.map((m) => m.content),
  });

  const appUrl = getAppUrl();
  const image = appUrl ? `${appUrl}/DEVito.png` : null;

  return prisma.scheduledLaunchDraft.create({
    data: {
      scheduledAt: when,
      name: normalizeName(suggestion?.name),
      ticker: normalizeTicker(suggestion?.symbol || suggestion?.ticker),
      description: normalizeDescription(suggestion?.description),
      metadataImageUrl: typeof suggestion?.metadataImageUrl === "string" && suggestion.metadataImageUrl.trim()
        ? suggestion.metadataImageUrl.trim()
        : image,
      generatedAt: new Date(),
    },
  });
}

export function buildDraftMetadataUri(draftId) {
  const appUrl = getAppUrl();
  if (!appUrl) return "";
  return `${appUrl}/api/metadata/${encodeURIComponent(draftId)}`;
}

export function makeLaunchRunId() {
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}
