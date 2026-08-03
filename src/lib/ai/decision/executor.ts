// Decision AI Executor — executes user-confirmed decisions
// Does NOT auto-modify anything. Only runs after explicit user confirmation.

import { prisma } from "@/lib/prisma";
import { createDecisionLog } from "@/lib/ai/decision-log";
import { createFeedback } from "@/lib/ai/feedback";
import type { DecisionAction } from "./interface";

export interface ExecutionResult {
  success: boolean;
  action: string;
  message: string;
}

/**
 * Execute a user-confirmed DecisionAction
 * Only runs after user explicitly chose and confirmed
 */
export async function executeDecisionAction(
  userId: string,
  action: DecisionAction,
  originalDecision: string
): Promise<ExecutionResult> {
  switch (action.type) {
    case "reschedule":
      return executeReschedule(userId, action, originalDecision);
    case "modify_task":
      return executeModifyTask(userId, action, originalDecision);
    case "keep":
      return executeKeep(userId, action, originalDecision);
    // ── 修复 P1-18：兼容 today-decide 引擎产出的 DecideAction（前端接线即用，不再"未知操作类型"）──
    case "postpone": {
      // payload: { taskId, days } → 把未来排期整体后移 days 天
      const { taskId, days } = action.payload;
      if (!taskId || !days || days < 1) return { success: false, action: "postpone", message: "缺少 taskId 或天数" };
      const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
      if (!task) return { success: false, action: "postpone", message: "任务不存在" };
      const daysMs = days * 86400000;
      await prisma.$transaction(async (tx) => {
        const future = await tx.schedule.findMany({ where: { taskId, userId, OR: [{ scheduledEnd: { gt: new Date() } }, { scheduledEnd: null }] } });
        for (const s of future) {
          await tx.schedule.update({
            where: { id: s.id },
            data: {
              scheduledStart: new Date(s.scheduledStart.getTime() + daysMs),
              scheduledEnd: s.scheduledEnd ? new Date(s.scheduledEnd.getTime() + daysMs) : null,
            },
          });
        }
        // 修复 P1-5：与 /action postpone 语义对齐——snoozed 任务延期必须解冻并清 snoozeUntil
        const updateData: Record<string, unknown> = {};
        if (task.deadline) updateData.deadline = new Date(task.deadline.getTime() + daysMs);
        updateData.postponedCount = { increment: 1 };
        if (task.status === "snoozed") { updateData.status = "not_started"; updateData.snoozeUntil = null; }
        await tx.task.update({ where: { id: taskId }, data: updateData });
      });
      return { success: true, action: "postpone", message: `已延期 ${days} 天` };
    }
    case "reduce_time": {
      // payload: { taskId, factor } → 预估时间按比例缩减
      const { taskId, factor } = action.payload;
      if (!taskId || !factor || factor <= 0 || factor >= 1) return { success: false, action: "reduce_time", message: "参数无效" };
      const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
      if (!task || !task.estimatedMinutes) return { success: false, action: "reduce_time", message: "任务不存在或无预估时间" };
      const newEst = Math.max(10, Math.round(task.estimatedMinutes * factor));
      await prisma.task.update({ where: { id: taskId }, data: { estimatedMinutes: newEst } });
      return { success: true, action: "reduce_time", message: `预估时间 ${task.estimatedMinutes} → ${newEst} 分钟` };
    }
    case "skip": {
      // payload: { taskId } → 删除该任务未来排期（跳过今天）
      const { taskId } = action.payload;
      if (!taskId) return { success: false, action: "skip", message: "缺少 taskId" };
      // 修复 P1-6：走 service（deleteFutureSchedules 语义一致 + decisionLog）
      const { deleteFutureSchedules } = await import("@/lib/schedule/service");
      const deleted = await deleteFutureSchedules(userId, taskId);
      return { success: true, action: "skip", message: `已跳过（移除 ${deleted} 条未来排期）` };
    }
    case "swap": {
      // payload: { taskId, withTaskId } → 交换两个任务的排期
      const { taskId, withTaskId } = action.payload;
      if (!taskId || !withTaskId) return { success: false, action: "swap", message: "缺少任务" };
      const [a, b] = await Promise.all([
        prisma.schedule.findFirst({ where: { taskId, userId }, orderBy: { scheduledStart: "asc" } }),
        prisma.schedule.findFirst({ where: { taskId: withTaskId, userId }, orderBy: { scheduledStart: "asc" } }),
      ]);
      if (!a || !b) return { success: false, action: "swap", message: "两个任务都需要有排期才能交换" };
      const aStart = a.scheduledStart, aEnd = a.scheduledEnd;
      await prisma.$transaction(async (tx) => {
        await tx.schedule.update({ where: { id: b.id }, data: { scheduledStart: aStart, scheduledEnd: aEnd } });
        await tx.schedule.update({ where: { id: a.id }, data: { scheduledStart: b.scheduledStart, scheduledEnd: b.scheduledEnd } });
      });
      return { success: true, action: "swap", message: "已交换排期" };
    }
    case "reduce_all": {
      // payload: { factor } → 今日全部任务预估减半（仅改预估，不强制）
      const { factor } = action.payload;
      if (!factor || factor <= 0 || factor >= 1) return { success: false, action: "reduce_all", message: "参数无效" };
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const tasks = await prisma.task.findMany({ where: { userId, status: { in: ["not_started", "in_progress"] }, estimatedMinutes: { not: null } }, select: { id: true, estimatedMinutes: true } });
      let count = 0;
      for (const t of tasks) {
        if (t.estimatedMinutes && t.estimatedMinutes > 15) {
          await prisma.task.update({ where: { id: t.id }, data: { estimatedMinutes: Math.max(10, Math.round(t.estimatedMinutes * factor)) } });
          count++;
        }
      }
      return { success: true, action: "reduce_all", message: `已调整 ${count} 个任务的预估` };
    }
    case "keep_mustdo_only": {
      // 只保留 mustDo（未来排期仅保留最重要的 3 个任务）—— 保守实现：不删数据，仅提示
      return { success: true, action: "keep_mustdo_only", message: "已保留今日必做（未删除其他排期）" };
    }
    default:
      return { success: false, action: action.type, message: "未知操作类型" };
  }
}

async function executeReschedule(userId: string, action: DecisionAction, originalDecision: string): Promise<ExecutionResult> {
  const { taskId, newStart, newEnd } = action.payload;
  if (!taskId) return { success: false, action: "reschedule", message: "缺少taskId" };

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return { success: false, action: "reschedule", message: "任务不存在" };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // 修复：无 newStart 时不要执行（否则会删空未来排期）；delete+create 包进同一事务
  if (!newStart) return { success: false, action: "reschedule", message: "缺少新时间，未做任何修改" };

  await prisma.$transaction(async (tx) => {
    // 只删除该任务的 AI 来源未来排期，保留用户手动排期
    await tx.schedule.deleteMany({
      where: { taskId, userId, source: "ai", OR: [{ scheduledEnd: { gt: new Date() } }, { scheduledEnd: null }] },
    });
    await tx.schedule.create({
      data: { userId, taskId, scheduledStart: new Date(newStart), scheduledEnd: newEnd ? new Date(newEnd) : new Date(new Date(newStart).getTime() + 3600000), source: "user" },
    });
  });

  // Record decision log
  await createDecisionLog({
    userId,
    action: "decision_reschedule",
    targetId: taskId,
    reasoning: originalDecision,
    actionDetail: JSON.stringify(action.payload),
  }).catch(() => {});

  // Record feedback
  await createFeedback({
    userId,
    taskId,
    agentAction: "decision_choice",
    userResponse: "accepted",
    context: "decision_confirm",
    agentSuggestion: JSON.stringify(action),
  }).catch(() => {});

  return { success: true, action: "reschedule", message: "已重新安排" };
}

async function executeModifyTask(userId: string, action: DecisionAction, originalDecision: string): Promise<ExecutionResult> {
  const { taskId, deadline, importance, description } = action.payload;
  if (!taskId) return { success: false, action: "modify_task", message: "缺少taskId" };

  const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
  if (!task) return { success: false, action: "modify_task", message: "任务不存在" };

  const data: Record<string, any> = {};
  if (deadline) data.deadline = new Date(deadline);
  if (importance && importance >= 1 && importance <= 5) data.importance = importance;
  if (description !== undefined) data.description = description;

  if (Object.keys(data).length === 0) return { success: false, action: "modify_task", message: "无有效修改字段" };

  await prisma.task.update({ where: { id: taskId }, data });

  await createDecisionLog({
    userId, action: "decision_modify", targetId: taskId,
    reasoning: originalDecision, actionDetail: JSON.stringify(data),
  }).catch(() => {});

  await createFeedback({
    userId, taskId, agentAction: "decision_choice", userResponse: "accepted",
    context: "decision_confirm", agentSuggestion: JSON.stringify(action),
  }).catch(() => {});

  return { success: true, action: "modify_task", message: "任务已更新" };
}

async function executeKeep(userId: string, action: DecisionAction, originalDecision: string): Promise<ExecutionResult> {
  await createDecisionLog({
    userId, action: "decision_keep", targetId: action.payload?.taskId || null,
    reasoning: originalDecision, actionDetail: "用户选择保持原计划",
  }).catch(() => {});

  await createFeedback({
    userId, agentAction: "decision_choice", userResponse: "accepted",
    context: "decision_confirm", agentSuggestion: JSON.stringify(action),
  }).catch(() => {});

  return { success: true, action: "keep", message: "已保持原计划" };
}
