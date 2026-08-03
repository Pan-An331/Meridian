// Execution Advisor — pure code, no AI calls
// Tells user: should I do this task now, given my state?

import { prisma } from "@/lib/prisma";
import { getCurrentState } from "@/lib/ai/user-state";

export interface ExecutionAdvice {
  type: "good" | "warning" | "risk";
  title: string;
  message: string;
  action?: string;
}

export async function getExecutionAdvice(userId: string): Promise<ExecutionAdvice | null> {
  const now = new Date();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

  // Get current in-progress task
  const currentTask = await prisma.task.findFirst({
    where: { userId, status: "in_progress" },
    select: { id: true, title: true, estimatedMinutes: true, deadline: true },
  });
  if (!currentTask) return null;

  // Get today's schedule for this task
  const schedule = await prisma.schedule.findFirst({
    where: { taskId: currentTask.id, scheduledStart: { gte: today, lt: tomorrow } },
  });

  // Get elapsed time
  const timeLogs = await prisma.timeLog.findMany({
    where: { taskId: currentTask.id, startedAt: { gte: today } },
  });
  // 修复：进行中 session（endedAt=null）的耗时也要计入，否则超时判定被低估
  const activeSession = timeLogs.find((l) => !l.endedAt);
  const activeSeconds = activeSession ? Math.max(0, (Date.now() - activeSession.startedAt.getTime()) / 1000) : 0;
  const elapsedMin = Math.round((timeLogs.reduce((s, l) => s + l.durationSeconds, 0) + activeSeconds) / 60);

  // Get user state
  const state = await getCurrentState(userId);

  // History: similar tasks average completion & feedback
  const pastSimilar = await prisma.task.findMany({
    where: { userId, status: "completed", actualMinutes: { gt: 0 } },
    select: { actualMinutes: true, estimatedMinutes: true },
    take: 10,
  });
  const avgRatio = pastSimilar.length > 0
    ? pastSimilar.reduce((s, t) => s + (t.actualMinutes / (t.estimatedMinutes || 1)), 0) / pastSimilar.length
    : 1;

  const pastFeedback = await prisma.taskExecutionFeedback.findMany({
    where: { userId, reason: { in: ["tired", "stuck", "interrupted"] } },
    take: 5,
  });

  // ─── Risk detection ───

  // Rule 1: Recovery mode + complex task → warning
  if (state.energy === "low" && state.stress === "high") {
    return {
      type: "warning",
      title: "当前可能不适合硬撑",
      message: "处于恢复模式，建议先完成30分钟整理或阅读",
      action: "建议切换到整理资料",
    };
  }

  // Rule 2: Deep work + high cognitive task → good
  if (state.energy === "high" && (state.focusLevel === "high" || state.focusLevel === "focused")) {
    return {
      type: "good",
      title: "当前适合继续推进",
      message: "深度工作状态，适合处理高认知任务",
    };
  }

  // Rule 3: Late night + tomorrow deadline → risk
  if (now.getHours() >= 22 && currentTask.deadline) {
    const dl = new Date(currentTask.deadline);
    if (dl <= tomorrow && currentTask.estimatedMinutes && currentTask.estimatedMinutes > elapsedMin) {
      return {
        type: "risk",
        title: "继续拖延风险较高",
        message: "明天截止，今晚需要至少再推进" + (currentTask.estimatedMinutes - elapsedMin) + "分钟",
        action: "建议今晚集中完成核心部分",
      };
    }
  }

  // Rule 4: Many past pauses → warning
  if (pastFeedback.length >= 3) {
    return {
      type: "warning",
      title: "过去类似任务经常中断",
      message: "你在这类任务上习惯性暂停，可以尝试切分成更小步骤",
    };
  }

  // Rule 5: History shows 1.5x extra time needed
  if (avgRatio > 1.5 && currentTask.estimatedMinutes) {
    const expected = Math.round(currentTask.estimatedMinutes * avgRatio);
    return {
      type: "warning",
      title: "实际耗时可能比预估长",
      message: "类似任务通常需要" + expected + "分钟（预估" + currentTask.estimatedMinutes + "分钟）",
      action: "可以预留更多时间或简化目标",
    };
  }

  // Default: no issues
  return {
    type: "good",
    title: "当前状态适合继续",
    message: schedule
      ? "按计划推进中，预计" + fmtTime(schedule.scheduledEnd)
      : "继续推进当前任务",
  };
}

function fmtTime(d: Date | null): string {
  if (!d) return "";
  return d.getHours() + ":" + d.getMinutes().toString().padStart(2, "0");
}
