// V5 层级重构测试：streak 连续天数 + task-builder 多级建树
process.env.TZ = "Asia/Shanghai";

import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/task/streak";
import { buildTasksFromDraft } from "@/lib/inbox/task-builder";
import type { InboxDraftItem } from "@/types/inbox";

describe("computeStreak — 连续天数统计", () => {
  it("今天已打卡：连续天数从今天往前数", () => {
    const dates = ["2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02"];
    const r = computeStreak(dates, "2026-08-02");
    expect(r.current).toBe(6);
    expect(r.longest).toBe(6);
    expect(r.todayChecked).toBe(true);
    expect(r.lastDate).toBe("2026-08-02");
  });

  it("今天未打卡但昨天有：连续 = 到昨天为止", () => {
    const dates = ["2026-07-29", "2026-07-30", "2026-07-31", "2026-08-01"];
    const r = computeStreak(dates, "2026-08-02");
    expect(r.current).toBe(4);
    expect(r.todayChecked).toBe(false);
  });

  it("中断后重新开始：当前连续从最近段算，最长保留历史", () => {
    const dates = ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-28", "2026-07-29"];
    const r = computeStreak(dates, "2026-07-29");
    expect(r.current).toBe(2);
    expect(r.longest).toBe(3);
  });

  it("空记录：连续 0、最长 0、未打卡", () => {
    const r = computeStreak([], "2026-08-02");
    expect(r.current).toBe(0);
    expect(r.longest).toBe(0);
    expect(r.todayChecked).toBe(false);
  });

  it("乱序重复日期去重后统计", () => {
    const dates = ["2026-08-01", "2026-07-31", "2026-07-31", "2026-07-30"];
    const r = computeStreak(dates, "2026-08-01");
    expect(r.current).toBe(3);
    expect(r.longest).toBe(3);
  });
});

describe("buildTasksFromDraft — 多级建树", () => {
  const base: InboxDraftItem = {
    id: "item1", title: "4轴飞行器", category: "practice", taskType: "planned",
    aiReason: "test", confidence: 1,
  };

  it("四层树：根(project) → phase → task → 执行项，parents 表达关系", () => {
    const draft: InboxDraftItem = {
      ...base,
      breakdown: {
        shouldBreakdown: true, reason: "复杂项目",
        phases: [{
          title: "硬件设计", phaseOrder: 1,
          tasks: [{
            title: "画原理图", estimatedMinutes: 120,
            children: [{ title: "芯片模块" }, { title: "LED 模块" }],
          }],
        }],
      },
    };
    const r = buildTasksFromDraft(draft);
    expect(r.params.length).toBe(5); // 根 + 硬件设计 + 画原理图 + 芯片 + LED
    expect(r.params[0].level).toBe("project");
    expect(r.params[1].level).toBe("phase");
    expect(r.params[2].level).toBe("task");
    expect(r.params[3].level).toBe("phase");
    expect(r.params[3].title).toBe("芯片模块");
    expect(r.parents).toEqual([-1, 0, 1, 2, 2]);
    // 执行项挂在画原理图（idx 2）下
    expect(r.parents[3]).toBe(2);
    expect(r.parents[4]).toBe(2);
  });

  it("两层树：根 → 子任务（无 children 时 parents=[-1,0]）", () => {
    const draft: InboxDraftItem = {
      ...base,
      breakdown: {
        shouldBreakdown: true, reason: "简单拆解",
        phases: [{ title: "阶段A", phaseOrder: 1, tasks: [{ title: "任务A", estimatedMinutes: 60 }] }],
      },
    };
    const r = buildTasksFromDraft(draft);
    expect(r.params.length).toBe(3);
    expect(r.parents).toEqual([-1, 0, 1]);
  });

  it("积累型：accumulate 标记 + repeatMinutes 作为估计时长", () => {
    const draft: InboxDraftItem = {
      ...base, title: "背单词", accumulate: true, repeatMinutes: 30,
    };
    const r = buildTasksFromDraft(draft);
    expect(r.params.length).toBe(1);
    expect(r.params[0].accumulate).toBe(true);
    expect(r.params[0].estimatedMinutes).toBe(30);
    expect(r.params[0].level).toBe("task");
    expect(r.params[0].deadline).toBeNull();
  });

  it("简单任务：parents=[-1]，level 默认 task", () => {
    const draft: InboxDraftItem = { ...base, title: "采购" };
    const r = buildTasksFromDraft(draft);
    expect(r.params.length).toBe(1);
    expect(r.params[0].level).toBe("task");
    expect(r.params[0].accumulate).toBe(false);
    expect(r.parents).toEqual([-1]);
  });
});
