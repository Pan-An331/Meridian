/* ═══════════════════════════════════════════
   V3 服务层 · 主题工具（任务信息架构规范 V3 §4.3 B4）
   · getTheme：字段优先 → tags/标题推断兜底（兼容迁移前旧数据）
   · themeColor：主题 → 配色（复用 colors.ts）
   · normalizeThemeInput：入参校验（≤20 字 / 去空白 / null 清除）
   ═══════════════════════════════════════════ */

import { resolveTheme, themeColor as colorsThemeColor } from "@/lib/plan/colors";

export interface ThemeSource {
  theme?: string | null;
  tags?: string | null;
  title?: string;
  category?: string | null;
}

/** 获取任务主题：theme 字段优先（V3 落库后的事实源），否则用 resolveTheme 推断（旧数据兼容） */
export function getTheme(src: ThemeSource): string | null {
  if (src.theme && src.theme.trim()) return src.theme.trim().slice(0, 20);
  return resolveTheme(src.tags, src.title || "", src.category);
}

/** 主题配色（3 预设 + 自定义兜底灰） */
export function themeColor(theme: string | null | undefined) {
  return colorsThemeColor(theme);
}

export interface NormalizedTheme {
  /** 合法主题名（≤20 字）或 null（清除） */
  value: string | null;
  ok: boolean;
  error?: string;
}

/** 入参归一化：null/空 → 清除；非字符串 → 拒绝；>20 字 → 拒绝 */
export function normalizeThemeInput(input: unknown): NormalizedTheme {
  if (input === null || input === undefined || input === "") return { value: null, ok: true };
  if (typeof input !== "string") return { value: null, ok: false, error: "theme 必须为字符串" };
  const trimmed = input.trim();
  if (!trimmed) return { value: null, ok: true };
  if (trimmed.length > 20) return { value: null, ok: false, error: "主题名称不能超过 20 字" };
  return { value: trimmed, ok: true };
}

/* ═══════════════════════════════════════════
   主题趋势周环比（决策 D3/D17 口径：按排期任务数聚合，非时长）
   · aggregateThemeCounts：单周期聚合（返回 byTheme 计数 + total，供跨周期合并 prev）
   ═══════════════════════════════════════════ */

export interface ThemeScheduleSource {
  task: { theme: string | null };
}

export interface ThemeCountResult {
  /** theme → 排期任务数 */
  byTheme: Map<string, number>;
  /** 有主题的排期任务总数（percent 分母） */
  total: number;
}

/** 按排期任务数聚合主题（D17 口径；无主题任务不计入） */
export function aggregateThemeCounts(scheduled: ThemeScheduleSource[]): ThemeCountResult {
  const byTheme = new Map<string, number>();
  for (const s of scheduled) {
    const th = s.task.theme;
    if (!th) continue;
    byTheme.set(th, (byTheme.get(th) || 0) + 1);
  }
  const total = [...byTheme.values()].reduce((a, b) => a + b, 0);
  return { byTheme, total };
}

/** 周环比 prev：本周主题 × 上周同主题聚合（count/percent；上周无该主题 → null） */
export function buildThemePrev(
  theme: string,
  currentTotal: number,
  prev: ThemeCountResult
): { count: number; percent: number } | null {
  const prevCount = prev.byTheme.get(theme);
  if (prevCount === undefined) return null;
  return {
    count: prevCount,
    percent: prev.total > 0 ? Math.round((prevCount / prev.total) * 100) : 0,
  };
}
