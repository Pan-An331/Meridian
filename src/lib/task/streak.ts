// V5 积累型：打卡连续天数统计
// 数据源：timeLog（type=checkin），按 startedAt 本地日期去重

import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";

export interface StreakInfo {
  current: number;        // 当前连续天数
  longest: number;        // 历史最长连续天数
  lastDate: string | null; // 最近一次打卡日期（本地 YYYY-MM-DD）
  todayChecked: boolean;  // 今天是否已打卡
  last30: string[];       // 近 30 天打卡日期列表（点阵数据）
}

/** 连续段统计：dates 为升序去重的本地日期字符串数组 */
export function computeStreak(dates: string[], todayStr: string): Omit<StreakInfo, "last30"> {
  const set = new Set(dates);
  const today = set.has(todayStr);

  // 当前连续：从今天（或昨天）往前数
  let current = 0;
  if (today) {
    current = 1;
    for (let i = 1; ; i++) {
      const d = new Date(todayStr + "T00:00:00");
      d.setDate(d.getDate() - i);
      if (set.has(localDateStr(d))) current++;
      else break;
    }
  } else {
    // 今天没打卡：看昨天是否连续（未断则显示"昨天为止的连续"）
    const y = new Date(todayStr + "T00:00:00");
    y.setDate(y.getDate() - 1);
    if (set.has(localDateStr(y))) {
      current = 1;
      for (let i = 2; ; i++) {
        const d = new Date(todayStr + "T00:00:00");
        d.setDate(d.getDate() - i);
        if (set.has(localDateStr(d))) current++;
        else break;
      }
    }
  }

  // 历史最长：排序后扫描连续段
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const s of sorted) {
    const d = new Date(s + "T00:00:00");
    if (prev && d.getTime() - prev.getTime() === 86400000) run++;
    else run = 1;
    if (run > longest) longest = run;
    prev = d;
  }

  return {
    current,
    longest,
    lastDate: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    todayChecked: today,
  };
}

export async function getStreak(userId: string, taskId: string): Promise<StreakInfo> {
  const logs = await prisma.timeLog.findMany({
    where: { userId, taskId, type: "checkin" },
    select: { startedAt: true },
    orderBy: { startedAt: "asc" },
  });

  const todayStr = localDateStr(new Date());
  const seen = new Set<string>();
  const dates: string[] = [];
  for (const l of logs) {
    const d = localDateStr(l.startedAt);
    if (!seen.has(d)) { seen.add(d); dates.push(d); }
  }

  const base = computeStreak(dates, todayStr);

  // 近 30 天点阵
  const last30: string[] = [];
  const from = new Date(todayStr + "T00:00:00");
  from.setDate(from.getDate() - 29);
  for (let i = 0; i < 30; i++) {
    const d = new Date(from.getTime() + i * 86400000);
    const s = localDateStr(d);
    if (seen.has(s)) last30.push(s);
  }

  return { ...base, last30 };
}
