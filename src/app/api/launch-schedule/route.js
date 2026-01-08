import { NextResponse } from "next/server";

import { getOrInitLaunchSchedule, computePreviewGenerateAt } from "@/lib/launchScheduler";

export async function GET() {
  try {
    const schedule = await getOrInitLaunchSchedule();
    const nextLaunchAt = schedule.nextLaunchAt;
    const previewAt = computePreviewGenerateAt(nextLaunchAt);
    const now = Date.now();

    return NextResponse.json({
      ok: true,
      nextLaunchAt: nextLaunchAt.toISOString(),
      cadenceHours: schedule.cadenceHours,
      previewAt: previewAt.toISOString(),
      msUntilNextLaunch: Math.max(0, new Date(nextLaunchAt).getTime() - now),
      msUntilPreview: Math.max(0, new Date(previewAt).getTime() - now),
    });
  } catch (e) {
    console.error("[Launch Schedule] Error:", e?.message || e);
    return NextResponse.json({ ok: false, error: "schedule_failed" }, { status: 500 });
  }
}
