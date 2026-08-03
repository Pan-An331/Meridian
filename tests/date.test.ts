// 时区回归测试：验证日期工具在 UTC+8（中国时区）下行为正确
// 历史 bug：toISOString().split("T")[0] 返回 UTC 日期，每晚 20:00 后"今天"变"昨天"
process.env.TZ = "Asia/Shanghai";

import { describe, it, expect, beforeEach } from "vitest";
import { localDateStr, localDateTimeStr, parseLocalDate, addDays, addDaysStr, startOfDay, endOfDay } from "@/lib/date";

// 固定一个"本地 00:30"时刻 —— 此时 UTC 还是前一天（旧代码会取错日期）
function lateNight(): Date {
  return new Date(2026, 7, 2, 0, 30, 0, 0); // 本地 2026-08-02 00:30 (UTC+8 → UTC 2026-08-01 16:30)
}

// 固定"本地 23:30"时刻 —— UTC 是当天 15:30，无跨天问题
function evening(): Date {
  return new Date(2026, 7, 2, 23, 30, 0, 0);
}

describe("localDateStr — 本地时区日期（回归 P0-1）", () => {
  it("深夜 00:30（UTC 尚未跨天时旧代码已错）返回正确的今天", () => {
    const d = lateNight();
    // 旧实现 toISOString().split("T")[0] 在此刻会返回 "2026-08-01"（错一天）
    expect(d.toISOString().split("T")[0]).toBe("2026-08-01"); // 证明旧逻辑确实错
    expect(localDateStr(d)).toBe("2026-08-02"); // 新实现正确
  });

  it("晚上 23:30 返回当天", () => {
    expect(localDateStr(evening())).toBe("2026-08-02");
  });

  it("默认参数返回今天的本地日期", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(localDateStr()).toBe(expected);
  });
});

describe("parseLocalDate — 本地零点解析", () => {
  it('把 "YYYY-MM-DD" 解析为本地零点（而非 UTC 零点）', () => {
    const d = parseLocalDate("2026-08-02");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(2);
    expect(d.getHours()).toBe(0);
  });

  it("解析结果与 old new Date('YYYY-MM-DD') 不同（UTC 零点会偏移）", () => {
    const parsed = parseLocalDate("2026-08-02");
    const old = new Date("2026-08-02"); // 按 UTC 解析
    // UTC+8 下 old 是本地 08:00，parseLocalDate 是本地 00:00
    expect(parsed.getHours()).toBe(0);
    expect(old.getHours()).toBe(8);
  });
});

describe("addDays / addDaysStr", () => {
  it("本地时区跨天计算：深夜 00:30 + 1 天 = 次日", () => {
    const d = addDays(1, lateNight());
    expect(localDateStr(d)).toBe("2026-08-03");
  });

  it("addDaysStr 返回本地日期字符串", () => {
    expect(addDaysStr(1, lateNight())).toBe("2026-08-03");
    expect(addDaysStr(-1, evening())).toBe("2026-08-01");
  });
});

describe("localDateTimeStr — 本地无时区 ISO（fallback parser 用）", () => {
  it("下午 3 点输出 15:00:00 而非 UTC 07:00:00", () => {
    const d = new Date(2026, 7, 2, 15, 0, 0);
    const s = localDateTimeStr(d);
    expect(s).toBe("2026-08-02T15:00:00");
    expect(s.endsWith("Z")).toBe(false);
    // 旧实现 toISOString().replace("Z","").slice(0,19) 会得到 "2026-08-02T07:00:00"（偏移 8h）
    expect(d.toISOString().replace("Z", "").slice(0, 19)).toBe("2026-08-02T07:00:00");
  });
});

describe("startOfDay / endOfDay", () => {
  it("startOfDay 归零到本地零点", () => {
    const d = startOfDay(evening());
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("endOfDay 到 23:59:59.999", () => {
    const d = endOfDay(evening());
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
  });
});
