// Execution feedback statistics — pure code, no AI
import { prisma } from "@/lib/prisma";

export interface DifficultyPattern {
  taskType: string;
  averageOvertime: number;
  commonPauseReason: string;
  confidence: number;
}

export interface ExecutionPattern {
  frequentInterruptReason: string | null;
  underestimateRate: number;
  todayWarning: string | null;
  suggestion: string | null;
}

/** Analyze: which type of tasks tend to run overtime + why */
export async function getTaskDifficultyPattern(userId: string): Promise<DifficultyPattern | null> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: "completed", actualMinutes: { gt: 0 }, estimatedMinutes: { not: null } },
    select: { title: true, taskType: true, estimatedMinutes: true, actualMinutes: true },
    take: 30,
  });
  if (tasks.length < 3) return null;

  // Group by taskType
  const groups: Record<string, { total: number; overCount: number; totalOvertime: number }> = {};
  for (const t of tasks) {
    if (!groups[t.taskType]) groups[t.taskType] = { total: 0, overCount: 0, totalOvertime: 0 };
    groups[t.taskType].total++;
    if (t.estimatedMinutes && t.actualMinutes > t.estimatedMinutes) {
      groups[t.taskType].overCount++;
      groups[t.taskType].totalOvertime += t.actualMinutes - t.estimatedMinutes;
    }
  }

  // Find type with highest overtime rate
  let worst: { type: string; rate: number; avgOvertime: number } | null = null;
  for (const [type, g] of Object.entries(groups)) {
    const rate = g.overCount / g.total;
    const avgOvertime = g.overCount > 0 ? Math.round(g.totalOvertime / g.overCount) : 0;
    if (!worst || rate > worst.rate) worst = { type, rate, avgOvertime };
  }
  if (!worst || worst.rate < 0.5) return null;

  // Get common pause reason for this type
  const feedback = await prisma.taskExecutionFeedback.findMany({
    where: { userId, reason: { in: ["tired", "stuck", "distracted", "too_hard", "underestimated"] } },
    take: 10,
  });

  const reasonCounts: Record<string, number> = {};
  for (const f of feedback) { reasonCounts[f.reason] = (reasonCounts[f.reason] || 0) + 1; }
  let topReason = "unknown";
  let topCount = 0;
  for (const [r, c] of Object.entries(reasonCounts)) { if (c > topCount) { topCount = c; topReason = r; } }

  return {
    taskType: worst.type,
    averageOvertime: worst.avgOvertime,
    commonPauseReason: topReason,
    confidence: Math.min(0.8, worst.rate),
  };
}

/** Analyze user execution patterns for today warning */
export async function getUserExecutionPattern(userId: string): Promise<ExecutionPattern> {
  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const feedback = await prisma.taskExecutionFeedback.findMany({
    where: { userId, createdAt: { gte: fourteenDaysAgo } },
    take: 20,
  });

  const completed = await prisma.task.findMany({
    where: { userId, status: "completed", completedAt: { gte: fourteenDaysAgo }, actualMinutes: { gt: 0 }, estimatedMinutes: { not: null } },
    select: { title: true, estimatedMinutes: true, actualMinutes: true },
    take: 20,
  });

  // Most frequent interrupt reason（修复：排除 user_* 系统原因，防止污染中断统计）
  const fCounts: Record<string, number> = {};
  for (const f of feedback) { if (f.reason && !f.reason.startsWith("user_")) fCounts[f.reason] = (fCounts[f.reason] || 0) + 1; }
  let topReason: string | null = null;
  let topCnt = 0;
  for (const [r, c] of Object.entries(fCounts)) { if (c > topCnt) { topCnt = c; topReason = r; } }

  // Underestimate rate
  const overCount = completed.filter(t => t.actualMinutes > (t.estimatedMinutes || 0)).length;
  const underRate = completed.length > 0 ? Math.round((overCount / completed.length) * 100) : 0;

  // Generate warning
  let todayWarning: string | null = null;
  let suggestion: string | null = null;

  // Pattern: same task type overtime 3+ times
  if (completed.length >= 3 && underRate > 60) {
    todayWarning = "你最近" + completed.length + "次任务中有" + overCount + "次超过预计时间";
    suggestion = "以后类似任务建议预留更多时间";
  }
  if (topReason === "tired" && topCnt >= 3) {
    todayWarning = "你最近经常因为疲劳暂停任务";
    suggestion = "考虑在状态较好时段安排高难度任务";
  }
  if (topReason === "stuck" && topCnt >= 3) {
    todayWarning = "你最近经常因为任务困难暂停";
    suggestion = "可以尝试把大任务拆成更小步骤";
  }

  return {
    frequentInterruptReason: topReason,
    underestimateRate: underRate,
    todayWarning,
    suggestion,
  };
}
