import { describe, expect, it } from "vitest";
import { getTheme, normalizeThemeInput, themeColor } from "@/lib/task/theme";

/* V3 后端：服务层主题工具单测（阶段 B4） */

describe("normalizeThemeInput · 主题入参归一化", () => {
  it("null/空 → 清除（value=null, ok）", () => {
    expect(normalizeThemeInput(null)).toEqual({ value: null, ok: true });
    expect(normalizeThemeInput(undefined)).toEqual({ value: null, ok: true });
    expect(normalizeThemeInput("")).toEqual({ value: null, ok: true });
    expect(normalizeThemeInput("   ")).toEqual({ value: null, ok: true });
  });
  it("合法主题 → 去空白，≤20 字", () => {
    expect(normalizeThemeInput(" 考研 ")).toEqual({ value: "考研", ok: true });
    expect(normalizeThemeInput("考研数学冲刺")).toEqual({ value: "考研数学冲刺", ok: true });
  });
  it("超过 20 字 → 拒绝", () => {
    const r = normalizeThemeInput("这是一个非常非常非常非常非常非常长的主题名称超过二十个字");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("20");
  });
  it("非字符串 → 拒绝", () => {
    expect(normalizeThemeInput(123 as unknown).ok).toBe(false);
    expect(normalizeThemeInput({} as unknown).ok).toBe(false);
  });
});

describe("getTheme · 主题读取（字段优先 → 推断兜底）", () => {
  it("theme 字段优先", () => {
    expect(getTheme({ theme: "秋招", tags: "theme:考研", title: "背单词" })).toBe("秋招");
  });
  it("字段为空 → resolveTheme 推断（tags theme:* 优先）", () => {
    expect(getTheme({ theme: null, tags: "theme:竞赛", title: "随便" })).toBe("竞赛");
    expect(getTheme({ theme: null, tags: null, title: "考研数学第三章" })).toBe("考研");
  });
  it("都没有 → null（不强猜）", () => {
    expect(getTheme({ theme: null, tags: null, title: "买示波器探头" })).toBeNull();
  });
});

describe("themeColor · 配色复用", () => {
  it("预设主题配色正确", () => {
    expect(themeColor("考研")).toEqual({ color: "#F97316", deep: "#C2410C", bg: "#FFF7ED" });
    expect(themeColor("竞赛")?.color).toBe("#DB2777");
  });
  it("未知/空 → 灰兜底/null", () => {
    expect(themeColor("秋招")?.color).toBe("#6B7280");
    expect(themeColor(null)).toBeNull();
  });
});
