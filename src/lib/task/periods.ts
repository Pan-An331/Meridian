// ═══════════════════════════════════════════════════════════
// 时段分组（共享配置）—— 全天无缝覆盖，凌晨跨天
// 默认分界：上午 8 点 / 下午 12 点 / 晚上 18 点 / 凌晨 22 点
// · 用户可在 Settings 调整四个分界小时（存 UserProfile.preferences）
// · Review 时段偏好 / Plan 时段背景共用
// ═══════════════════════════════════════════════════════════

export const PERIOD_KEYS = ["morning", "afternoon", "evening", "midnight"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  morning: "上午",
  afternoon: "下午",
  evening: "晚上",
  midnight: "凌晨",
};

// 默认分界：morningStart / afternoonStart / eveningStart / midnightStart
export const DEFAULT_BOUNDARIES: [number, number, number, number] = [8, 12, 18, 22];

/** 从 preferences JSON 解析分界，非法时回退默认 */
export function parseBoundaries(preferences: string | null | undefined): [number, number, number, number] {
  if (!preferences) return DEFAULT_BOUNDARIES;
  try {
    const p = JSON.parse(preferences);
    const arr = p?.periodBoundaries;
    if (Array.isArray(arr) && arr.length === 4 && arr.every((n: unknown) => typeof n === "number" && n >= 0 && n <= 23 && Number.isInteger(n))) {
      return arr as [number, number, number, number];
    }
  } catch { /* 忽略非法 */ }
  return DEFAULT_BOUNDARIES;
}

/** 小时 → 时段（全天覆盖：凌晨跨天从 midnightStart 延续到 morningStart） */
export function periodOf(hour: number, b: [number, number, number, number] = DEFAULT_BOUNDARIES): PeriodKey {
  if (hour >= b[3] || hour < b[0]) return "midnight";
  if (hour >= b[2]) return "evening";
  if (hour >= b[1]) return "afternoon";
  return "morning";
}

/** 时段的显示范围（凌晨跨天：返回 endHour > 24 表示次日） */
export function periodRange(key: PeriodKey, b: [number, number, number, number] = DEFAULT_BOUNDARIES): { start: number; end: number } {
  const idx = PERIOD_KEYS.indexOf(key);
  const start = b[idx];
  const end = idx + 1 < 4 ? b[idx + 1] : b[0] + 24; // 凌晨结束 = 次日 morningStart
  return { start, end };
}

/** 显示文案：如 "22-8 点"（凌晨）/ "8-12 点" */
export function periodRangeLabel(key: PeriodKey, b: [number, number, number, number] = DEFAULT_BOUNDARIES): string {
  const { start, end } = periodRange(key, b);
  const e = end > 24 ? end - 24 : end;
  return `${start}-${e} 点`;
}

/** 汇总多个分界的边界小时列表（设置用） */
export function boundaryList(b: [number, number, number, number] = DEFAULT_BOUNDARIES): number[] {
  return [...b];
}
