"use client";

import { themeColor, THEME_FALLBACK } from "@/lib/plan/colors";

/* ═══════════════════════════════════════════
   ThemeBadge — V3 主题徽章（色点 + 文字）
   · 深字浅底 + 色点，对比度 ≥ 4.5:1（AA）
   · mini：小号（周历窄块只显示色点）
   ═══════════════════════════════════════════ */

export function ThemeBadge({ theme, mini = false }: { theme: string | null | undefined; mini?: boolean }) {
  if (!theme) return null;
  const t = themeColor(theme) ?? THEME_FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded shrink-0 font-semibold ${mini ? "px-0" : "px-1.5 py-px"}`}
      style={{ background: t.bg, color: t.deep, fontSize: mini ? 10 : 10.5, letterSpacing: "0.2px" }}
      title={`主题：${theme}`}
    >
      <span className="rounded-full shrink-0" style={{ width: mini ? 6 : 7, height: mini ? 6 : 7, background: t.color }} />
      {!mini && <span>{theme}</span>}
    </span>
  );
}

/** 无主题时的灰色占位（用于图例/统计） */
export function ThemeDot({ theme }: { theme: string | null | undefined }) {
  const t = themeColor(theme) ?? THEME_FALLBACK;
  return <span className="inline-block rounded-full shrink-0" style={{ width: 8, height: 8, background: t.color }} title={theme ?? "无主题"} />;
}
