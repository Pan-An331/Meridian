/* ═══════════════════════════════════════════
   时间状态派生态（决策 2026-08-06 · 产品本人"状态不是分类"洞察）
   · 任务的时间性质 = 运行时推导（Schedule 唯一时间源 + deadline），不再是静态 taskType 分类
   · 三态：已排期（时间块）/ 截止日 / 事项（未安排时间）
   · 排期后标签自动变「时间块」，取消排期自动回「事项」——状态跟着 Schedule 走
   ═══════════════════════════════════════════ */

export type TimeState = "scheduled" | "deadline" | "unarranged";

export const TIME_STATE_LABEL: Record<TimeState, string> = {
  scheduled: "时间块",
  deadline: "截止日",
  unarranged: "事项",
};

export interface TimeStateSource {
  taskType?: string | null;
  deadline?: string | null;
  /** 有排期即已排期（Schedule 唯一时间源）：任一时段字段存在即可 */
  scheduledStart?: string | null;
  startTime?: string | null;
  hasSchedule?: boolean;
}

/** 推导时间状态：有排期 → 时间块；有截止 → 截止日；否则 → 事项 */
export function deriveTimeState(src: TimeStateSource): TimeState {
  if (src.hasSchedule ?? (!!src.scheduledStart || !!src.startTime)) return "scheduled";
  if (src.deadline) return "deadline";
  return "unarranged";
}

/** 三态标签（展示用） */
export function timeStateLabel(src: TimeStateSource): string {
  return TIME_STATE_LABEL[deriveTimeState(src)];
}
