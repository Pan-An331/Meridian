import { describe, it, expect } from "vitest";
import { NAV_ITEMS, NAV_ORDER, WIDE_PATHS, isActiveNav, isWidePath } from "@/lib/navigation";

describe("navigation · 工作流顺序", () => {
  it("五个页面按 理解→规划→执行→复盘→整理 排序（V5 含 Project）", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual(["/inbox", "/plan", "/today", "/review", "/projects"]);
  });

  it("Today 是默认落地页", () => {
    expect(NAV_ITEMS.find((i) => i.isDefault)?.href).toBe("/today");
  });

  it("快捷键顺序 = 工作流 5 页 + 设置", () => {
    expect(NAV_ORDER).toEqual(["/inbox", "/plan", "/today", "/review", "/projects", "/settings"]);
  });

  it("中英双语导航名（默认中文：收纳/蓝图/此刻/复盘/项目）", () => {
    expect(NAV_ITEMS.map((i) => i.labelZh)).toEqual(["收纳", "蓝图", "此刻", "复盘", "项目"]);
    expect(NAV_ITEMS.map((i) => i.labelEn)).toEqual(["Inbox", "Plan", "Today", "Review", "Projects"]);
  });

  it("副标题双语齐全", () => {
    for (const i of NAV_ITEMS) {
      expect(i.subZh.length).toBeGreaterThan(0);
      expect(i.subEn.length).toBeGreaterThan(0);
    }
  });
});

describe("isActiveNav · 激活判断", () => {
  it("精确路径激活", () => {
    expect(isActiveNav("/today", "/today")).toBe(true);
    expect(isActiveNav("/inbox", "/today")).toBe(false);
  });

  it("/week 兼容 Plan 激活", () => {
    expect(isActiveNav("/week", "/plan")).toBe(true);
    expect(isActiveNav("/week", "/today")).toBe(false);
  });

  it("子路径不误激活", () => {
    expect(isActiveNav("/inbox/xxx", "/inbox")).toBe(false);
  });
});

describe("isWidePath · 宽页面判断", () => {
  it("Today / Plan / Week / Review 是宽页面", () => {
    // Review 两栏化（V3 §7.2）后改全宽，与视觉稿 1100px 一致
    for (const p of ["/today", "/plan", "/week", "/review", "/projects"]) {
      expect(isWidePath(p)).toBe(true);
    }
  });

  it("阅读型页面是窄页面", () => {
    for (const p of ["/inbox", "/settings", "/login"]) {
      expect(isWidePath(p)).toBe(false);
    }
  });

  it("宽页面子路径继承宽度", () => {
    expect(isWidePath("/plan/2026-08-02")).toBe(true);
  });

  it("WIDE_PATHS 与导航定义一致（无重复）", () => {
    expect(new Set(WIDE_PATHS).size).toBe(WIDE_PATHS.length);
  });
});
