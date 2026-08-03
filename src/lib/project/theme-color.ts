/* ═══════════════════════════════════════════
   Project 页优化 · 阶段 A：项目派生色（themeColor）
   · 纯函数，零 LLM 依赖（Project页优化-后端开发指令 §2）
   · 聚合规则：项目下所有任务 theme 主频 > category 主频 > null（前端品牌蓝兜底）
   · pcolor = 主题/领域 border 色；pbg = 主题/领域 bg 色
   ═══════════════════════════════════════════ */

import { DOMAINS, THEMES, themeColor } from "@/lib/plan/colors";

export interface ProjectColorInput {
  theme: string | null;
  category: string | null;
}

export interface ProjectThemeColor {
  /** 主题/领域边框色（CSS 变量 --pcolor 消费） */
  pcolor: string;
  /** 主题/领域浅底色（CSS 变量 --pbg 消费） */
  pbg: string;
  /** 命中的主题名（领域兜底时为 null） */
  theme: string | null;
}

/** 单任务颜色输入：theme 优先于 category（阶段 A 规则 3 的输入归一） */
export function taskColorInput(t: ProjectColorInput): ProjectColorInput {
  return { theme: t.theme, category: t.category };
}

/**
 * 项目派生色：统计一组任务的 theme/category 主频
 * @param tasks 项目下所有任务（含子级）的 {theme, category}
 * @returns theme 主频命中 → THEMES 色；无 theme → category 主频 → 领域色；都无 → null
 */
export function deriveProjectThemeColor(tasks: ProjectColorInput[]): ProjectThemeColor | null {
  // 1. theme 主频（非空）
  const themeCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();
  for (const t of tasks) {
    if (t.theme && t.theme.trim()) {
      const key = t.theme.trim();
      themeCounts.set(key, (themeCounts.get(key) || 0) + 1);
    }
    if (t.category) catCounts.set(t.category, (catCounts.get(t.category) || 0) + 1);
  }

  // 2. theme 主频最高
  let topTheme: string | null = null;
  let topThemeCount = 0;
  for (const [th, c] of themeCounts) {
    if (c > topThemeCount) { topTheme = th; topThemeCount = c; }
  }
  if (topTheme) {
    const c = themeColor(topTheme);
    if (c) return { pcolor: c.color, pbg: c.bg, theme: topTheme };
    // 理论上 themeColor 非空字符串必返回色（THEMES 或 THEME_FALLBACK），此处防御兜底
    return null;
  }

  // 3. 无 theme → category 主频 → 领域色
  let topCat: string | null = null;
  let topCatCount = 0;
  for (const [cat, c] of catCounts) {
    if (c > topCatCount) { topCat = cat; topCatCount = c; }
  }
  if (topCat && DOMAINS[topCat as keyof typeof DOMAINS]) {
    const d = DOMAINS[topCat as keyof typeof DOMAINS];
    return { pcolor: d.border, pbg: d.bg, theme: null };
  }

  // 4. 都无 → null（前端品牌蓝兜底）
  return null;
}
