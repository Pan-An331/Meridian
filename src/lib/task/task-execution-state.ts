// Step12+ 重构 — 统一任务执行状态计算
// 数据源：TimeLog（唯一真相源）+ Schedule（日程关系）
// Status priority: completed > running > paused > not_started

import { prisma } from "@/lib/prisma";
import { getPlannedMinutes } from "@/lib/task/execution";
import { localDateStr } from "@/lib/date";

export type TaskExecStatus = "not_started" | "running" | "paused" | "completed";
export type ScheduleRelation = "on_schedule" | "ahead" | "behind" | "idle";

export interface TaskExecutionState {
  status: TaskExecStatus;
  scheduleRelation: ScheduleRelation;
  elapsedMinutes: number;
  estimatedMinutes: number;
  actualMinutes: number;
  progress: number;
  lastAction: "start" | "pause" | "resume" | "complete" | null;
  lastActionTime: string | null;
  currentSessionStartedAt: string | null;
  canStart: boolean;
  canResume: boolean;
  canComplete: boolean;
  pauseCount: number;
  aheadMinutes: number | null;
  behindMinutes: number | null;
  completedAt: string | null;
  firstStartedAt: string | null;
}

export async function getTaskExecutionState(taskId: string, userId: string): Promise<TaskExecutionState> {
  const [task, logs, schedules] = await Promise.all([
    prisma.task.findFirst({
      where: { id: taskId, userId }, // 修复 IDOR：任务按归属查询
      select: { status: true, estimatedMinutes: true, actualMinutes: true, completedAt: true },
    }),
    prisma.timeLog.findMany({
      where: { taskId, userId },
      orderBy: { startedAt: "asc" },
      select: { type: true, startedAt: true, endedAt: true, durationSeconds: true },
    }),
    prisma.schedule.findMany({
      where: { taskId, userId }, // 修复 IDOR：排期按归属过滤
      orderBy: { scheduledStart: "asc" },
      select: { scheduledStart: true, scheduledEnd: true },
    }),
  ]);

  if (!task) throw new Error("TASK_NOT_FOUND");

  const isCompleted = task?.status === "completed";
  // 修复 P2-5：直接用已查到的 schedules 计算（去掉 getPlannedMinutes 二次查询）
  const lastSched = schedules[schedules.length - 1];
  const estimated = lastSched?.scheduledStart && lastSched.scheduledEnd
    ? Math.round((lastSched.scheduledEnd.getTime() - lastSched.scheduledStart.getTime()) / 60000)
    : task?.estimatedMinutes || 0;
  const actual = task?.actualMinutes || 0;
  const completedAt = task?.completedAt?.toISOString() || null;

  const completedSeconds = logs
    .filter((l: { endedAt: Date | null }) => l.endedAt)
    .reduce((s: number, l: { durationSeconds: number }) => s + l.durationSeconds, 0);
  const elapsedMin = Math.round(completedSeconds / 60);

  const activeLog = logs.find((l: { endedAt: Date | null }) => !l.endedAt);
  const pauseCount = logs.filter((l: { type: string }) => l.type === "pause").length;
  const lastLog = logs[logs.length - 1] || null;
  const firstStartedAt = logs.length > 0 ? logs[0].startedAt.toISOString() : null;

  const now = new Date();
  const todayStr = localDateStr(now);
  const todaySched = schedules.find(s => {
    const d = localDateStr(s.scheduledStart);
    return d === todayStr;
  });
  const schedStart = todaySched?.scheduledStart || null;
  const schedEnd = todaySched?.scheduledEnd || null;

  // Helper: is task within its scheduled window right now?
  const inScheduleWindow = schedStart != null && schedStart <= now && (!schedEnd || schedEnd >= now);
  // Helper: has the schedule window fully passed?
  const schedulePassed = schedStart != null && schedStart < now && schedEnd != null && schedEnd < now;

  // ★ PRIORITY 1: completed (always overrides everything)
  if (isCompleted) {
    return {
      status: "completed",
      scheduleRelation: "idle",
      elapsedMinutes: elapsedMin,
      estimatedMinutes: estimated,
      actualMinutes: actual,
      progress: 100,
      lastAction: "complete",
      lastActionTime: lastLog?.endedAt?.toISOString() || null,
      currentSessionStartedAt: null,
      canStart: false, canResume: false, canComplete: false,
      pauseCount,
      aheadMinutes: null, behindMinutes: null,
      completedAt,
      firstStartedAt,
    };
  }

  // ★ PRIORITY 2: running
  if (activeLog && !activeLog.endedAt) {
    let scheduleRelation: ScheduleRelation = "idle";
    let aheadMinutes: number | null = null;

    // ahead: running AND firstStartedAt < scheduledStart AND schedule not started yet
    if (schedStart && firstStartedAt) {
      const firstStart = new Date(firstStartedAt).getTime();
      if (firstStart < schedStart.getTime() && schedStart > now) {
        scheduleRelation = "ahead";
        // FIX #1: schedStart - now = positive (how far ahead of schedule)
        aheadMinutes = Math.round((schedStart.getTime() - now.getTime()) / 60000);
      }
    }

    if (scheduleRelation === "idle") {
      scheduleRelation = inScheduleWindow ? "on_schedule" : (schedulePassed ? "behind" : "idle");
    }

    const sessionElapsed = Math.round((Date.now() - activeLog.startedAt.getTime()) / 1000);
    const totalElapsed = completedSeconds + sessionElapsed;
    return {
      status: "running",
      scheduleRelation,
      elapsedMinutes: Math.round(totalElapsed / 60),
      estimatedMinutes: estimated,
      actualMinutes: actual,
      progress: estimated > 0 ? Math.min(100, Math.round((Math.round(totalElapsed / 60) / estimated) * 100)) : 0,
      lastAction: "start",
      lastActionTime: activeLog.startedAt.toISOString(),
      currentSessionStartedAt: activeLog.startedAt.toISOString(),
      canStart: false, canResume: false, canComplete: true,
      pauseCount,
      aheadMinutes,
      behindMinutes: null,
      completedAt,
      firstStartedAt,
    };
  }

  // ★ PRIORITY 3: paused
  if (logs.length > 0) {
    let scheduleRelation: ScheduleRelation = "idle";
    let behindMinutes: number | null = null;

    // FIX #2: behind only when window fully passed
    if (schedulePassed) {
      scheduleRelation = "behind";
      behindMinutes = Math.round((now.getTime() - schedStart.getTime()) / 60000);
    } else if (inScheduleWindow) {
      scheduleRelation = "on_schedule";
    } else if (schedStart != null && schedStart < now && !schedEnd) {
      // No end time, and start has passed — treat as behind
      scheduleRelation = "behind";
      behindMinutes = Math.round((now.getTime() - schedStart.getTime()) / 60000);
    }

    return {
      status: "paused",
      scheduleRelation,
      elapsedMinutes: elapsedMin,
      estimatedMinutes: estimated,
      actualMinutes: actual,
      progress: estimated > 0 ? Math.min(100, Math.round((elapsedMin / estimated) * 100)) : 0,
      lastAction: lastLog?.type === "pause" ? "pause" : (lastLog?.type === "resume" ? "resume" : null),
      lastActionTime: lastLog?.endedAt?.toISOString() || lastLog?.startedAt?.toISOString() || null,
      currentSessionStartedAt: null,
      canStart: false, canResume: true, canComplete: true,
      pauseCount,
      aheadMinutes: null,
      behindMinutes,
      completedAt,
      firstStartedAt,
    };
  }

  // ★ PRIORITY 4: not_started
  let scheduleRelation: ScheduleRelation = "idle";
  let behindMinutes: number | null = null;

  // FIX #2: behind only when window fully passed OR no-end-time past start
  if (schedulePassed) {
    scheduleRelation = "behind";
    behindMinutes = Math.round((now.getTime() - schedStart.getTime()) / 60000);
  } else if (schedStart != null && schedStart < now && !schedEnd) {
    scheduleRelation = "behind";
    behindMinutes = Math.round((now.getTime() - schedStart.getTime()) / 60000);
  } else if (inScheduleWindow) {
    scheduleRelation = "on_schedule";
  }

  return {
    status: "not_started",
    scheduleRelation,
    elapsedMinutes: 0,
    estimatedMinutes: estimated,
    actualMinutes: 0,
    progress: 0,
    lastAction: null, lastActionTime: null,
    currentSessionStartedAt: null,
    canStart: true, canResume: false, canComplete: false,
    pauseCount: 0,
    aheadMinutes: null,
    behindMinutes,
    completedAt,
    firstStartedAt,
  };
}
