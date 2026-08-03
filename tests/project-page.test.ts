import { describe, expect, it } from "vitest";
import { deriveProjectThemeColor } from "@/lib/project/theme-color";
import { suggestTarget } from "@/lib/project/suggestion";

/* ═══════════════════════════════════════════
   Project 页优化 · 阶段 A/B 纯函数单测
   · themeColor：theme 主频 > category 主频 > null
   · suggestion：标题匹配 > 主题匹配 > null（不强猜）
   ═══════════════════════════════════════════ */

describe("deriveProjectThemeColor · 项目派生色（阶段 A）", () => {
  it("theme 主频命中 → 取 THEMES 色（主题优先于领域）", () => {
    const r = deriveProjectThemeColor([
      { theme: "竞赛", category: "practice" },
      { theme: "竞赛", category: "practice" },
      { theme: "考研", category: "learning" },
      { theme: null, category: "health" },
    ]);
    expect(r).toEqual({ pcolor: "#DB2777", pbg: "#FDF2F8", theme: "竞赛" });
  });

  it("无 theme → category 主频 → 领域色（theme=null）", () => {
    const r = deriveProjectThemeColor([
      { theme: null, category: "learning" },
      { theme: null, category: "learning" },
      { theme: null, category: "health" },
    ]);
    expect(r).toEqual({ pcolor: "#3B82F6", pbg: "#DBEAFE", theme: null });
  });

  it("都无 → null（前端品牌蓝兜底）", () => {
    expect(deriveProjectThemeColor([])).toBeNull();
    expect(deriveProjectThemeColor([{ theme: null, category: null }])).toBeNull();
  });

  it("自定义主题（不在 THEMES）→ THEME_FALLBACK 灰", () => {
    const r = deriveProjectThemeColor([{ theme: "自定义主题", category: null }]);
    expect(r).toEqual({ pcolor: "#6B7280", pbg: "#F3F4F6", theme: "自定义主题" });
  });

  it("空 theme 字符串不计入（trim 后）", () => {
    const r = deriveProjectThemeColor([
      { theme: "  ", category: "practice" },
      { theme: null, category: "practice" },
    ]);
    expect(r?.theme).toBeNull();
    expect(r?.pcolor).toBe("#7C3AED"); // practice 领域色
  });
});

describe("suggestTarget · 孤儿建议归属（阶段 B）", () => {
  const targets = [
    { id: "p1", title: "四轴飞行器", theme: "竞赛" },
    { id: "p2", title: "考研复习", theme: "考研" },
    { id: "p3", title: "健身计划", theme: "身材" },
  ];

  it("标题匹配 → 建议挂入（title-match）", () => {
    const r = suggestTarget({ title: "四轴飞行器选型", theme: null }, targets);
    expect(r).toEqual({ targetId: "p1", targetTitle: "四轴飞行器", reason: "title-match" });
  });

  it("主题匹配 → 建议挂入（theme-match，标题未命中时）", () => {
    const r = suggestTarget({ title: "电赛备赛日程", theme: "竞赛" }, targets);
    // 标题"电赛备赛日程"不含任何目标标题关键词 → 主题匹配
    expect(r).toEqual({ targetId: "p1", targetTitle: "四轴飞行器", reason: "theme-match" });
  });

  it("都匹配不到 → null（拿不准不强猜）", () => {
    const r = suggestTarget({ title: "买菜", theme: null }, targets);
    expect(r).toBeNull();
  });

  it("目标标题 <2 字不参与标题匹配（太泛）", () => {
    const r = suggestTarget(
      { title: "学习高数", theme: null },
      [{ id: "pX", title: "学", theme: null }, ...targets]
    );
    // "学" <2 字跳过；"学习高数"不含"四轴飞行器/考研复习/健身计划" → null
    expect(r).toBeNull();
  });

  it("孤儿标题与目标标题完全相同 → 不匹配（自己不算）", () => {
    const r = suggestTarget({ title: "考研复习", theme: "考研" }, targets);
    expect(r?.reason).toBe("theme-match"); // 标题相同跳过，但主题一致仍可挂
  });

  it("多个候选命中 → 按顺序取第一个", () => {
    const r = suggestTarget({ title: "考研复习英语", theme: "考研" }, targets);
    expect(r).toEqual({ targetId: "p2", targetTitle: "考研复习", reason: "title-match" });
  });
});
