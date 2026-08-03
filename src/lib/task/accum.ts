/* V5 积累型任务：性质推断（每日型/频次型）+ 打卡统计
   供 Today Focus Card 打卡卡渲染（设计稿：每日型小日历 / 频次型周视图） */
import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";

export interface AccumStats {
  /** 任务性质：daily=每日型（断了从头数） / weekly=频次型（隔天练，按周目标） */
  freqType: "daily" | "weekly";
  /** 每周目标次数（daily=7；weekly=按近 28 天打卡频率推断，至少 1） */
  weekTarget: number;
  /** 本周（周一~今天）已打卡日期 */
  weekDates: string[];
  /** 本周打卡次数 */
  weekCount: number;
  /** 本月已打卡日期 */
  monthDates: string[];
  /** 本月打卡次数 */
  monthCount: number;
  /** 本月总天数 */
  monthTotalDays: number;
  /** 累计打卡时长（分钟） */
  totalMinutes: number;
}

/** 推断任务性质 + 汇总打卡统计（基于 checkin 类型 TimeLog） */
export async function getAccumStats(userId: string, taskId: string): Promise<AccumStats> {
  const logs = await prisma.timeLog.findMany({
    where: { userId, taskId, type: "checkin" },
    select: { startedAt: true, durationSeconds: true },
    orderBy: { startedAt: "asc" },
  });
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const l of logs) {
    const d = localDateStr(l.startedAt);
    if (!seen.has(d)) { seen.add(d); dates.push(d); }
  }
  dates.sort();

  const now = new Date();
  const todayStr = localDateStr(now);

  // 近 28 天打卡天数 → 性质推断（每日型 ≈ 天天打卡，频次型 = 有间隔）
  const from28 = new Date(now); from28.setDate(from28.getDate() - 27);
  const from28Str = localDateStr(from28);
  const recent28 = dates.filter((d) => d >= from28Str).length;
  const freqType: "daily" | "weekly" = recent28 >= 20 ? "daily" : "weekly";
  const weekTarget = freqType === "daily" ? 7 : Math.max(1, Math.round(recent28 / 4));

  // 本周（周一 ~ 今天）
  const monday = new Date(now); monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7));
  const mondayStr = localDateStr(monday);
  const weekDates = dates.filter((d) => d >= mondayStr && d <= todayStr);

  // 本月
  const monthPrefix = todayStr.slice(0, 7);
  const monthDates = dates.filter((d) => d.startsWith(monthPrefix));
  const monthTotalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const totalMinutes = Math.round(logs.reduce((s, l) => s + (l.durationSeconds || 0), 0) / 60);

  return {
    freqType,
    weekTarget,
    weekDates,
    weekCount: weekDates.length,
    monthDates,
    monthCount: monthDates.length,
    monthTotalDays,
    totalMinutes,
  };
}
