import { prisma } from "@/lib/prisma";
import { localDateStr, parseLocalDate, addDays, endOfDay } from "@/lib/date";

/**
 * 生成每日统计摘要（纯代码统计，不调用AI）
 * 数据来源: Task + TimeLog + Schedule + AgentFeedback
 */
export async function createDailySummary(userId: string, dateStr: string) {
  const dayStart = parseLocalDate(dateStr);
  const dayEnd = endOfDay(dayStart);

  // 已完成任务
  const completed = await prisma.task.findMany({
    where: { userId, status: "completed", completedAt: { gte: dayStart, lte: dayEnd } },
  });

  // 当天创建/计划的活跃任务
  const planned = await prisma.task.findMany({
    where: { userId, status: { in: ["not_started", "in_progress"] }, createdAt: { lte: dayEnd } },
  });

  // 延期任务
  const delayed = await prisma.task.count({
    where: { userId, status: "delayed", deadline: { gte: dayStart, lte: dayEnd } },
  });

  // 专注时间
  const timeLogs = await prisma.timeLog.findMany({
    where: { userId, startedAt: { gte: dayStart, lte: dayEnd } },
  });
  const totalMinutes = Math.round(timeLogs.reduce((sum, t) => sum + t.durationSeconds, 0) / 60);

  // 完成率
  const todayRelevant = planned.filter(t => {
    const sched = t.taskType === "scheduled";
    // 修复 P2-20：deadline 必须落在当日窗口内，历史遗留 deadline 不算今日计划
    const hasDeadline = t.deadline && new Date(t.deadline) >= dayStart && new Date(t.deadline) <= dayEnd;
    return sched || hasDeadline;
  });
  const completedCount = completed.length;
  const plannedCount = todayRelevant.length; // 修复：无相关任务时完成率应为 0 而非恒 100%
  const completionRate = plannedCount > 0 ? Math.round((completedCount / plannedCount) * 100) : 0;

  // 行为摘要文字
  const parts: string[] = [];
  if (completedCount > 0) parts.push(`完成${completedCount}项任务`);
  if (totalMinutes > 0) parts.push(`专注${totalMinutes}分钟`);
  if (delayed > 0) parts.push(`${delayed}项延期`);
  const summaryText = parts.length > 0 ? parts.join("，") : "暂无记录";

  // Upsert
  await prisma.dailySummary.upsert({
    where: { userId_date: { userId, date: dateStr } },
    create: {
      userId,
      date: dateStr,
      completedCount,
      totalMinutes,
      summaryText,
    },
    update: {
      completedCount,
      totalMinutes,
      summaryText,
    },
  });

  return { date: dateStr, completedCount, totalMinutes, plannedCount, completionRate, delayedCount: delayed, summaryText };
}

/**
 * 获取或生成今日摘要
 */
export async function getOrCreateTodaySummary(userId: string) {
  const today = localDateStr();
  const existing = await prisma.dailySummary.findUnique({ where: { userId_date: { userId, date: today } } });
  if (existing) return existing;
  return createDailySummary(userId, today);
}

/**
 * 强制刷新今日摘要（BUG-20260807-027）：
 * getOrCreateTodaySummary 语义为"存在即返回"，Today 视图打开时会生成当日摘要并固化；
 * 之后完成任务/打卡不会更新 → Review 本周统计当天恒为 0（打开 Today 在先、完成在后）。
 * 任务 complete / checkin 落库后调用本函数强制重建（createDailySummary 内部 upsert 覆盖）。
 */
export async function refreshTodaySummary(userId: string) {
  return createDailySummary(userId, localDateStr());
}

/**
 * 获取近N天摘要（自动补生成缺失的）
 */
export async function getDailySummaries(userId: string, days: number = 7) {
  const result: any[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateStr = localDateStr(addDays(-i));
    const existing = await prisma.dailySummary.findUnique({ where: { userId_date: { userId, date: dateStr } } });
    if (existing) {
      result.push(existing);
    } else {
      const created = await createDailySummary(userId, dateStr);
      result.push(created);
    }
  }
  return result;
}
