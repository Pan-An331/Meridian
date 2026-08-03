import { describe, expect, it } from "vitest";
import {
  DOMAINS,
  THEMES,
  resolveDomain,
  resolveTheme,
  normalizeCategory,
  themeColor,
} from "@/lib/plan/colors";

/* V3 前端先行：领域 7 类 + 主题推断单测（指令 §2.3） */

describe("DOMAINS · 领域 7 类封顶", () => {
  it("恰好 7 类，且无 competition", () => {
    expect(Object.keys(DOMAINS)).toHaveLength(7);
    expect(DOMAINS).not.toHaveProperty("competition");
  });
  it("配色符合 V3 定稿（learning 提亮 / external 深琥珀）", () => {
    expect(DOMAINS.learning.border).toBe("#3B82F6");
    expect(DOMAINS.external.border).toBe("#92400E");
    expect(DOMAINS.health.border).toBe("#16A34A");
  });
});

describe("THEMES · 预设 3 个", () => {
  it("考研/竞赛/身材，配色正确", () => {
    expect(["考研", "竞赛", "身材"].every((k) => k in THEMES)).toBe(true);
    expect(THEMES["考研"].color).toBe("#F97316");
    expect(THEMES["竞赛"].color).toBe("#DB2777");
    expect(THEMES["身材"].color).toBe("#0D9488");
  });
  it("未知主题走灰色兜底", () => {
    expect(themeColor("秋招")).toEqual({ color: "#6B7280", deep: "#4B5563", bg: "#F3F4F6" });
  });
});

describe("resolveTheme · 主题推断", () => {
  it("tags 的 theme:* 前缀优先", () => {
    expect(resolveTheme("theme:秋招,domain:learning", "随便一个标题")).toBe("秋招");
    expect(resolveTheme("domain:learning", "随便")).toBeNull();
  });
  it("标题关键词兜底：考研/竞赛/身材", () => {
    expect(resolveTheme(null, "考研数学第三章")).toBe("考研");
    expect(resolveTheme(null, "电赛 PCB 布线")).toBe("竞赛");
    expect(resolveTheme(null, "健身 身材管理")).toBe("身材");
    expect(resolveTheme(null, "背单词")).toBe("考研");
  });
  it("拿不准留空（不强猜）", () => {
    expect(resolveTheme(null, "买示波器探头")).toBeNull();
  });
});

describe("resolveDomain · 领域推断（V3 D8 迁移）", () => {
  it("电赛/PCB/电路 → practice（不再有 competition）", () => {
    expect(resolveDomain(null, "电赛方案设计")).toBe("practice");
    expect(resolveDomain(null, "PCB 布线")).toBe("practice");
    expect(resolveDomain("domain:competition", "电赛调试")).toBe("practice");
  });
  it("课程/健身/学习映射正确", () => {
    expect(resolveDomain(null, "上数字电路课")).toBe("practice"); // 电路 → practice
    expect(resolveDomain(null, "健身")).toBe("health");
    expect(resolveDomain(null, "学习算法导论")).toBe("learning");
  });
});

describe("normalizeCategory · 7 类归一 + competition 迁移", () => {
  it("大写枚举归一", () => {
    expect(normalizeCategory("LEARNING")).toBe("learning");
    expect(normalizeCategory("PERSONAL")).toBe("life");
  });
  it("competition 存量迁移到 practice", () => {
    expect(normalizeCategory("competition")).toBe("practice");
    expect(normalizeCategory("COMPETITION")).toBe("practice");
  });
  it("未知 → other", () => {
    expect(normalizeCategory("whatever")).toBe("other");
    expect(normalizeCategory(null)).toBe("other");
  });
});
