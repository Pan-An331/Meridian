// Result Message Generator — converts OperationResult to user-facing text
// chat route calls this instead of using AI's message

import type { OperationResult } from "./executor";

export function generateOperationMessage(result: OperationResult): string {
  if (!result.success) {
    if (result.needChoose && result.candidates?.length) {
      return "找到多个匹配任务，请指定具体是哪一个：" + result.candidates.map(c => c.title).join("、");
    }
    return result.error || "操作失败";
  }

  switch (result.operation) {
    case "create_task":
      return "已创建任务「" + (result.affected?.title || "") + "」"
        + (result.after?.scheduleStart ? "，安排在 " + fmtDate(result.after.scheduleStart) : "");

    case "schedule_move":
      if (result.affected?.title) {
        return "已将「" + result.affected.title + "」调整到" + (result.after?.scheduleStart ? fmtDate(result.after.scheduleStart) : "");
      }
      return "时间调整完成";

    case "task_update":
      return "已更新「" + (result.affected?.title || "") + "」";

    case "task_delete":
      return "已删除「" + (result.affected?.title || "") + "」";

    default:
      return "操作完成";
  }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.getMonth() + 1 + "月" + d.getDate() + "日 " +
      d.getHours().toString().padStart(2, "0") + ":" +
      d.getMinutes().toString().padStart(2, "0");
  } catch { return iso; }
}
