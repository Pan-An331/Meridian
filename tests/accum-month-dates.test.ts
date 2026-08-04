// 收尾批次：accumStats monthDates 过滤（当月打卡日期，升序去重）
process.env.TZ = "Asia/Shanghai";

import { describe, expect, it } from "vitest";
import { filterMonthDates } from "@/lib/task/accum";

describe("filterMonthDates — 当月打卡日期（收尾批次 A3）", () => {
  it("混合当月/上月/下月日期 → 只返回当月，升序去重", () => {
    const now = new Date("2026-08-04T10:00:00+08:00");
    const dates = [
      "2026-07-31", // 上月
      "2026-08-02",
      "2026-08-02", // 重复
      "2026-08-01",
      "2026-08-03",
      "2026-09-01", // 下月
    ];
    const r = filterMonthDates(dates, now);
    expect(r).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]); // 升序 + 去重
  });

  it("无当月日期 → 空数组", () => {
    const now = new Date("2026-08-04T10:00:00+08:00");
    expect(filterMonthDates(["2026-07-30", "2026-09-02"], now)).toEqual([]);
  });

  it("跨月边界：月末日期正确归属当月", () => {
    const now = new Date("2026-08-01T00:30:00+08:00");
    const r = filterMonthDates(["2026-07-31", "2026-08-01"], now);
    expect(r).toEqual(["2026-08-01"]);
  });
});
