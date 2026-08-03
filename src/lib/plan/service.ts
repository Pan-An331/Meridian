// Plan Service — unified plan business logic
// All plan queries must go through this service

import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";
import { moveSchedule } from "@/lib/schedule/service";
import type { PlanItem, DailyPlan, WeeklyPlan } from "./types";
import type { Prisma } from "@prisma/client";

/** Prisma schedule 查询结果的形状（含 task） */
type ScheduleWithTask = Prisma.ScheduleGetPayload<{
  include: { task: { select: { id: true; title: true; taskType: true; status: true; importance: true } } };
}>;

/** Get weekly plan with consistency check */
export async function getWeeklyPlan(userId: string, weekStart: Date): Promise<WeeklyPlan> {
  const start = new Date(weekStart); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);

  const entries = await prisma.schedule.findMany({
    where: { userId, scheduledStart: { gte: start, lt: end } },
    include: { task: { select: { id: true, title: true, taskType: true, status: true, importance: true } } },
    orderBy: { scheduledStart: "asc" },
  });

  const items = deduplicate(entries).map(toPlanItem);
  return { weekStart: start.toISOString(), weekEnd: end.toISOString(), items };
}

/** Get daily plan */
export async function getDailyPlan(userId: string, date: Date): Promise<DailyPlan> {
  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);

  const entries = await prisma.schedule.findMany({
    where: { userId, scheduledStart: { gte: dayStart, lt: dayEnd } },
    include: { task: { select: { id: true, title: true, taskType: true, status: true, importance: true } } },
    orderBy: { scheduledStart: "asc" },
  });

  const items = deduplicate(entries).map(toPlanItem);
  return { date: localDateStr(dayStart), items };
}

/**
 * Delete a plan item by taskId — removes the schedule, keeps the Task.
 * The task will reappear in UnscheduledPool on next Plan load.
 */
export async function deletePlanItem(userId: string, taskId: string) {
  const schedule = await prisma.schedule.findFirst({
    where: { taskId, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!schedule) return { deleted: 0 };

  const { deleteScheduleById } = await import("@/lib/schedule/service");
  await deleteScheduleById(schedule.id, schedule.userId);
  return { deleted: 1, taskId: schedule.taskId };
}

/**
 * 统一去重规则：同任务 + 同自然日 → 保留最新一条排期（修复 P1-1：三处实现不一致）
 * week-calendar / task-execution-state 复用本函数，保证周历、日计划、执行状态显示一致
 */
export function deduplicateByDay<T extends { taskId: string; scheduledStart: Date }>(entries: T[]): T[] {
  const seen = new Map<string, number>();
  const result: T[] = [];
  for (const e of entries) {
    const key = localDateStr(e.scheduledStart) + "_" + e.taskId; // 本地自然日（修复：原实现用 toISOString 精确时间）
    const idx = seen.get(key);
    if (idx !== undefined && e.scheduledStart > result[idx].scheduledStart) result[idx] = e;
    else if (idx === undefined) { seen.set(key, result.length); result.push(e); }
  }
  if (result.length !== entries.length) {
    console.warn("[plan] deduped " + (entries.length - result.length) + " duplicate schedules");
  }
  return result;
}

/** 兼容：plan/service 内部用（类型化版本） */
function deduplicate(entries: ScheduleWithTask[]): ScheduleWithTask[] {
  return deduplicateByDay(entries);
}

function toPlanItem(entry: ScheduleWithTask): PlanItem {
  return {
    taskId: entry.task.id,
    title: entry.task.title,
    schedule: { id: entry.id, start: entry.scheduledStart.toISOString(), end: entry.scheduledEnd?.toISOString() || null, source: entry.source },
    status: entry.task.status,
    importance: entry.task.importance,
    taskType: entry.task.taskType,
  };
}
