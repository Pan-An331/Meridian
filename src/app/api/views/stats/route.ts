import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getDailySummaries } from "@/lib/ai/daily-summary";
import { analyzeDailyBehavior } from "@/lib/ai/memory-learning";
import { aggregateThemeCounts, buildThemePrev } from "@/lib/task/theme";

/** Behavioral insights for Review page */
interface BehavioralData {
  peakHours: { hour: number; count: number; label: string }[];
  efficiencyByTag: { tag: string; ratio: number; count: number; totalActual: number; totalEstimated: number }[];
  weekOverWeek: { completedChange: number; minutesChange: number; direction: "up" | "down" | "flat" };
  procrastinationRate: number;
  delayedCount: number;
  totalActive: number;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "week";
  const themeFilter = searchParams.get("theme")?.trim() || null;
  const days = range === "month" ? 30 : 7;

  // Daily summaries
  const summaries = await getDailySummaries(userId, days);

  // Async behavior learning
  analyzeDailyBehavior(userId).catch(() => {});

  const dailyBreakdown = summaries.map(s => ({
    date: s.date,
    completedCount: s.completedCount,
    totalMinutes: s.totalMinutes,
    summaryText: s.summaryText,
  }));

  const totalCompleted = summaries.reduce((sum, s) => sum + (s.completedCount || 0), 0);
  const totalMinutes = summaries.reduce((sum, s) => sum + (s.totalMinutes || 0), 0);
  const avgCompletionRate = summaries.length > 0
    ? Math.round(summaries.reduce((sum, s) => sum + (s.completionRate || 0), 0) / summaries.length)
    : 0;

  // Behavioral insights (async fetch in parallel)
  const behavioral = await computeBehavioral(userId, days);

  // ── V3 C8 / D3+D17：主题投入（按本周排期任务数聚合，非时长）+ 周环比 prev（上周同主题） ──
  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - days);
  const prevPeriodStart = new Date(periodStart);
  prevPeriodStart.setDate(prevPeriodStart.getDate() - days);
  const [scheduledThisPeriod, scheduledPrevPeriod] = await Promise.all([
    prisma.schedule.findMany({
      where: { userId, scheduledStart: { gte: periodStart } },
      include: { task: { select: { theme: true } } },
    }),
    // 上周周期：[prevPeriodStart, periodStart) —— 口径与本周一致（按排期任务数）
    prisma.schedule.findMany({
      where: { userId, scheduledStart: { gte: prevPeriodStart, lt: periodStart } },
      include: { task: { select: { theme: true } } },
    }),
  ]);
  const cur = aggregateThemeCounts(scheduledThisPeriod);
  const prev = aggregateThemeCounts(scheduledPrevPeriod);
  const themeBreakdown = [...cur.byTheme.entries()]
    .map(([theme, count]) => ({
      theme,
      count,
      percent: cur.total > 0 ? Math.round((count / cur.total) * 100) : 0,
      // 周环比：上周同主题聚合（count/percent，口径一致按任务数）；上周无该主题 → null
      prev: buildThemePrev(theme, cur.total, prev),
    }))
    .sort((a, b) => b.count - a.count)
    .map((row, i) => ({
      ...row,
      label: i === 0 ? "主攻" : "待加强", // 占比最高的主题 = 主攻，其余 = 待加强
    }));

  // ── V3 C8 / D2：指标卡数据（采纳率 / 堆积率 / 打卡保持率） ──
  // 采纳率：本周 AI 排期建议被确认比例（AgentFeedback 数据源）
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const feedbacks = await prisma.agentFeedback.findMany({
    where: { userId, agentAction: "schedule_task", createdAt: { gte: weekAgo } },
    select: { userResponse: true },
  });
  const accepted = feedbacks.filter(f => f.userResponse === "accepted").length;
  const declined = feedbacks.filter(f => ["rejected", "modified"].includes(f.userResponse)).length;
  const adoptionRate = accepted + declined > 0 ? Math.round((accepted / (accepted + declined)) * 100) : null;

  // 堆积率：>7 天未处理任务占比（过滤失败信号，越低越好）
  const weekAgoDate = new Date(); weekAgoDate.setDate(weekAgoDate.getDate() - 7);
  const [backlogged, totalActive] = await Promise.all([
    prisma.task.count({ where: { userId, status: { in: ["not_started", "in_progress", "delayed"] }, createdAt: { lt: weekAgoDate } } }),
    prisma.task.count({ where: { userId, status: { in: ["not_started", "in_progress", "delayed"] } } }),
  ]);
  const backlogRate = totalActive > 0 ? Math.round((backlogged / totalActive) * 100) : 0;

  // 打卡保持率：积累型任务本周打卡完成度（daily=7 次 / weekly=weekTarget）
  const accumTasks = await prisma.task.findMany({ where: { userId, accumulate: true }, select: { id: true } });
  let checkinKeepRate: number | null = null;
  if (accumTasks.length > 0) {
    const checkins = await prisma.timeLog.findMany({
      where: { userId, type: "checkin", taskId: { in: accumTasks.map(t => t.id) }, startedAt: { gte: weekAgoDate } },
      select: { startedAt: true, taskId: true },
    });
    const byTask = new Map<string, Set<string>>();
    for (const c of checkins) {
      const d = c.startedAt.toISOString().slice(0, 10);
      if (!byTask.has(c.taskId)) byTask.set(c.taskId, new Set());
      byTask.get(c.taskId)!.add(d);
    }
    let totalDays = 0;
    let expected = 0;
    for (const t of accumTasks) {
      const days = byTask.get(t.id)?.size || 0;
      const expectedDays = 7; // 每日型；频次型按 weekTarget 简化——取 min(7, 实际≥1 视为达标的 7 天口径偏差小，用 7 天口径）
      totalDays += days;
      expected += Math.min(expectedDays, 7);
    }
    checkinKeepRate = expected > 0 ? Math.round((totalDays / expected) * 100) : null;
  }

  // 指标卡汇总（供 Review 顶部 4 格：周完成率 / 采纳率 / 堆积率 / 打卡保持率）
  const metrics = {
    completionRate: avgCompletionRate,
    adoptionRate,
    backlogRate,
    checkinKeepRate,
  };

  // Completed tasks for review display（V3 C8：?theme= 过滤）
  const completedTasks = await prisma.task.findMany({
    where: {
      userId, status: "completed", completedAt: { not: null },
      ...(themeFilter ? { theme: themeFilter } : {}),
    },
    orderBy: { completedAt: "desc" },
    take: 50,
    select: {
      id: true, title: true, taskType: true, importance: true,
      actualMinutes: true, tags: true, completedAt: true, theme: true,
      // startedAt/type 用于时段偏好统计与"深度专注/分2段/打断"标签
      timeLogs: { select: { id: true, durationSeconds: true, startedAt: true, type: true } },
    },
  });

  // Tag breakdown
  const tagMap: Record<string, { count: number; minutes: number }> = {};
  for (const t of completedTasks) {
    const tags = (t.tags || "").split(",").map(s => s.trim()).filter(Boolean).filter(tag => !tag.startsWith("domain:"));
    for (const tag of tags) {
      if (!tagMap[tag]) tagMap[tag] = { count: 0, minutes: 0 };
      tagMap[tag].count++;
      tagMap[tag].minutes += t.actualMinutes || 0;
    }
  }
  const tagBreakdown = Object.entries(tagMap).map(([tag, data]) => ({ tag, ...data }));

  // 时段分组（用户可在 Settings 修改）：preferences.periodBoundaries → Review 时段偏好矩阵
  const profile = await prisma.userProfile.findUnique({ where: { userId }, select: { preferences: true } }).catch(() => null);
  let periodBoundaries: [number, number, number, number] = [8, 12, 18, 22];
  if (profile?.preferences) {
    try {
      const pb = JSON.parse(profile.preferences)?.periodBoundaries;
      if (Array.isArray(pb) && pb.length === 4 && pb.every((n: unknown) => typeof n === "number" && n >= 0 && n <= 23)) {
        periodBoundaries = pb as [number, number, number, number];
      }
    } catch { /* 忽略非法 */ }
  }

  return NextResponse.json({
    // 返回真实日期范围（如 "2026-07-27 - 2026-08-02"），供周数/日期范围展示；无数据时回退请求参数
    range: dailyBreakdown.length >= 2 ? `${dailyBreakdown[0].date} - ${dailyBreakdown[dailyBreakdown.length - 1].date}` : (dailyBreakdown.length === 1 ? `${dailyBreakdown[0].date} - ${dailyBreakdown[0].date}` : range),
    totalCompleted,
    totalMinutes,
    avgCompletionRate,
    streakDays: summaries.filter(s => s.completedCount > 0).length,
    dailyBreakdown,
    completedTasks,
    tagBreakdown,
    behavioral,
    periodBoundaries,
    // V3 C8：主题投入（D3/D17，按任务数）+ 指标卡（D2）
    themeBreakdown,
    metrics,
  });
}

async function computeBehavioral(userId: string, days: number): Promise<BehavioralData> {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setDate(periodStart.getDate() - days);

  // 1. Peak hours — based on TimeLog startedAt
  const timeLogs = await prisma.timeLog.findMany({
    where: { userId, startedAt: { gte: periodStart }, type: "start" },
    select: { startedAt: true },
  });
  const hourCount: Record<number, number> = {};
  for (const log of timeLogs) {
    const h = log.startedAt.getHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  }
  const peakHours = Object.entries(hourCount)
    .map(([h, c]) => ({ hour: parseInt(h), count: c, label: formatHourLabel(parseInt(h)) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 2. Efficiency by tag (actual / estimated)
  const completedWithEst = await prisma.task.findMany({
    where: {
      userId,
      status: "completed",
      completedAt: { gte: periodStart },
      estimatedMinutes: { not: null, gt: 0 },
      actualMinutes: { gt: 0 },
    },
    select: { tags: true, estimatedMinutes: true, actualMinutes: true },
  });
  const tagEfficiency: Record<string, { actual: number; estimated: number; count: number }> = {};
  for (const t of completedWithEst) {
    const tags = (t.tags || "").split(",").map(s => s.trim()).filter(Boolean).filter(tag => !tag.startsWith("domain:"));
    for (const tag of tags) {
      if (!tagEfficiency[tag]) tagEfficiency[tag] = { actual: 0, estimated: 0, count: 0 };
      tagEfficiency[tag].actual += t.actualMinutes || 0;
      tagEfficiency[tag].estimated += t.estimatedMinutes || 0;
      tagEfficiency[tag].count++;
    }
  }
  const efficiencyByTag = Object.entries(tagEfficiency)
    .filter(([, d]) => d.count >= 2)
    .map(([tag, d]) => ({
      tag,
      ratio: d.estimated > 0 ? Math.round((d.actual / d.estimated) * 100) / 100 : 0,
      count: d.count,
      totalActual: d.actual,
      totalEstimated: d.estimated,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // 3. Week-over-week trend
  const prevStart = new Date(periodStart);
  prevStart.setDate(prevStart.getDate() - days);
  const [currentTasks, prevTasks] = await Promise.all([
    prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: periodStart } } }),
    prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: prevStart, lt: periodStart } } }),
  ]);
  const [currentMin, prevMin] = await Promise.all([
    prisma.task.aggregate({ where: { userId, status: "completed", completedAt: { gte: periodStart } }, _sum: { actualMinutes: true } }),
    prisma.task.aggregate({ where: { userId, status: "completed", completedAt: { gte: prevStart, lt: periodStart } }, _sum: { actualMinutes: true } }),
  ]);
  const completedChange = currentTasks - prevTasks;
  const minutesChange = (currentMin._sum.actualMinutes || 0) - (prevMin._sum.actualMinutes || 0);
  const weekOverWeek = {
    completedChange,
    minutesChange,
    direction: completedChange > 0 ? "up" as const : completedChange < 0 ? "down" as const : "flat" as const,
  };

  // 4. Procrastination rate
  const [delayedCount, totalActive] = await Promise.all([
    prisma.task.count({ where: { userId, status: "delayed", createdAt: { gte: periodStart } } }),
    prisma.task.count({ where: { userId, status: { in: ["not_started", "in_progress", "completed", "delayed"] }, createdAt: { gte: periodStart } } }),
  ]);
  const procrastinationRate = totalActive > 0 ? Math.round((delayedCount / totalActive) * 100) : 0;

  return {
    peakHours,
    efficiencyByTag,
    weekOverWeek,
    procrastinationRate,
    delayedCount,
    totalActive,
  };
}

function formatHourLabel(hour: number): string {
  if (hour >= 6 && hour < 12) return hour + "时 上午";
  if (hour >= 12 && hour < 18) return hour + "时 下午";
  if (hour >= 18 && hour < 22) return hour + "时 晚间";
  return hour + "时 深夜";
}
