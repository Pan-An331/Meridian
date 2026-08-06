/* ═══════════════════════════════════════════
   预估单位工具（P1-10：分钟/小时/天）
   · estimatedMinutes 始终存分钟（内部标准），estimatedUnit 记录用户输入粒度
   ═══════════════════════════════════════════ */

export type EstimateUnit = "min" | "hour" | "day";
export const ESTIMATE_UNITS: EstimateUnit[] = ["min", "hour", "day"];
export const ESTIMATE_UNIT_LABEL: Record<EstimateUnit, string> = {
  min: "分钟",
  hour: "小时",
  day: "天",
};

/** 单位 → 分钟换算系数 */
export const UNIT_TO_MINUTES: Record<EstimateUnit, number> = { min: 1, hour: 60, day: 1440 };

/** 白名单校验（非法 → null） */
export function normalizeEstimateUnit(input: unknown): EstimateUnit | null {
  return ESTIMATE_UNITS.includes(input as EstimateUnit) ? (input as EstimateUnit) : null;
}

/** 按单位换算成分钟（取整 ≥1）；非法返回 null */
export function toMinutes(value: number, unit: EstimateUnit): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.max(1, Math.round(value * UNIT_TO_MINUTES[unit]));
}

/** 显示换算：如 90min+hour → "1.5 小时"；0/空 → null */
export function formatEstimate(minutes: number | null | undefined, unit: EstimateUnit | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  if (unit === "hour") return `${Math.round((minutes / 60) * 10) / 10} 小时`;
  if (unit === "day") return `${Math.round((minutes / 1440) * 10) / 10} 天`;
  return `${minutes} 分钟`;
}
