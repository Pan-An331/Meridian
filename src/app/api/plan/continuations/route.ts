// V5 D4 续排（自动部分）：未完成任务 → "明天继续"建议
// GET /api/plan/continuations → [{ taskId, title, lastStart, lastEnd, suggestedStart }]
// 规则：昨天/今天已过时段有排期但未 completed 的任务（排除 accumulate——积累型每天都有排期）

import { NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const userId = session.user.id;

  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // 昨天或今天已结束的排期（scheduledEnd < now），任务未完成
  const pastSchedules = await prisma.schedule.findMany({
    where: {
      userId,
      OR: [
        { scheduledEnd: { gte: yesterday, lt: now } },
        { scheduledStart: { gte: yesterday, lt: now }, scheduledEnd: null },
      ],
    },
    include: { task: { select: { id: true, title: true, status: true, accumulate: true, estimatedMinutes: true } } },
    orderBy: { scheduledStart: "desc" },
    take: 100,
  });

  const seen = new Set<string>();
  const suggestions: { taskId: string; title: string; lastStart: string | null; lastEnd: string | null; suggestedStart: string | null; estimatedMinutes: number | null }[] = [];

  for (const s of pastSchedules) {
    const t = s.task;
    if (!t || seen.has(t.id)) continue;
    // 未完成 + 非积累型 + 未被取消
    if (t.status === "completed" || t.status === "cancelled" || t.accumulate) continue;
    // 明天还没有该任务的排期 → 才建议（避免重复建议）
    const hasTomorrow = await prisma.schedule.findFirst({
      where: { userId, taskId: t.id, scheduledStart: { gte: tomorrow } },
      select: { id: true },
    });
    if (hasTomorrow) { seen.add(t.id); continue; }

    const dur = s.scheduledEnd && s.scheduledEnd > s.scheduledStart
      ? Math.round((s.scheduledEnd.getTime() - s.scheduledStart.getTime()) / 60000)
      : (t.estimatedMinutes || 60);
    const suggested = new Date(tomorrow);
    suggested.setHours(s.scheduledStart.getHours(), 0, 0, 0);

    suggestions.push({
      taskId: t.id, title: t.title,
      lastStart: s.scheduledStart.toISOString(), lastEnd: s.scheduledEnd?.toISOString() ?? null,
      suggestedStart: suggested.toISOString(),
      estimatedMinutes: dur,
    });
    seen.add(t.id);
    if (suggestions.length >= 10) break;
  }

  return NextResponse.json({ suggestions, generatedAt: localDateStr(now) });
}
