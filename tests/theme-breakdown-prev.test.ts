import { describe, expect, it } from "vitest";
import { aggregateThemeCounts, buildThemePrev } from "@/lib/task/theme";

/* Review 主题趋势周环比（分工指令 §2：themeBreakdown[].prev）
   口径：D3/D17 按排期任务数聚合（非时长）；prev = 上周同主题 {count, percent} */

describe("aggregateThemeCounts · 单周期主题聚合（D17 按任务数）", () => {
  it("按排期任务数计数，无主题任务不计入", () => {
    const r = aggregateThemeCounts([
      { task: { theme: "考研" } },
      { task: { theme: "考研" } },
      { task: { theme: "竞赛" } },
      { task: { theme: null } },   // 无主题 → 跳过
      { task: { theme: "考研" } },
    ]);
    expect(r.byTheme.get("考研")).toBe(3);
    expect(r.byTheme.get("竞赛")).toBe(1);
    expect(r.total).toBe(4); // 只含有主题任务
  });

  it("空数据 → total 0，byTheme 空", () => {
    const r = aggregateThemeCounts([]);
    expect(r.total).toBe(0);
    expect(r.byTheme.size).toBe(0);
  });
});

describe("buildThemePrev · 周环比 prev（上周同主题）", () => {
  it("上周有该主题 → 返回 {count, percent}（口径与本周一致按任务数）", () => {
    const prev = aggregateThemeCounts([
      { task: { theme: "考研" } },
      { task: { theme: "考研" } },
      { task: { theme: "竞赛" } },
    ]);
    const p = buildThemePrev("考研", 5, prev);
    expect(p).toEqual({ count: 2, percent: Math.round((2 / 3) * 100) }); // 67
    expect(p?.count).toBe(2);
  });

  it("上周无该主题 → null（前端缺省显示 —）", () => {
    const prev = aggregateThemeCounts([{ task: { theme: "竞赛" } }]);
    expect(buildThemePrev("身材", 1, prev)).toBeNull();
  });

  it("上周空数据 → null", () => {
    const prev = aggregateThemeCounts([]);
    expect(buildThemePrev("考研", 1, prev)).toBeNull();
  });

  it("上周 total=0 时 percent 兜底 0（防御）", () => {
    const prev = aggregateThemeCounts([{ task: { theme: "考研" } }]);
    const p = buildThemePrev("考研", 0, prev);
    expect(p).toEqual({ count: 1, percent: Math.round((1 / 1) * 100) }); // 100
  });
});
