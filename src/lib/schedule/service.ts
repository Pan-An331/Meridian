// Schedule Service V2 — unified schedule management with transaction safety

import { prisma } from "@/lib/prisma";
import { createDecisionLog } from "@/lib/ai/decision-log";
import type { Prisma } from "@prisma/client";

export async function createSchedule(userId: string, taskId: string, start: Date, end: Date): Promise<{ id: string }> {
  // Delete any existing schedules first to prevent duplicates (Step27 bugfix)
  // 事务化：先删后建原子执行，避免中途失败丢 schedule
  const schedule = await prisma.$transaction(async (tx) => {
    await tx.schedule.deleteMany({ where: { taskId, userId } });
    return tx.schedule.create({ data: { userId, taskId, scheduledStart: start, scheduledEnd: end, source: "user" } });
  });
  createDecisionLog({ userId, action: "schedule_create", targetId: taskId, reasoning: "任务创建时首次安排", actionDetail: JSON.stringify({ start: start.toISOString() }) }).catch(() => {});
  return { id: schedule.id };
}

export async function createScheduleWithSource(userId: string, taskId: string, start: Date, end: Date, source: string): Promise<{ id: string }> {
  const schedule = await prisma.$transaction(async (tx) => {
    await tx.schedule.deleteMany({ where: { taskId, userId } });
    return tx.schedule.create({ data: { userId, taskId, scheduledStart: start, scheduledEnd: end, source } });
  });
  createDecisionLog({ userId, action: "schedule_create", targetId: taskId, reasoning: "创建安排", actionDetail: JSON.stringify({ start: start.toISOString(), source }) }).catch(() => {});
  return { id: schedule.id };
}

/**
 * Add a single Schedule WITHOUT deleting existing ones. Used for repeat/batch creation.
 */
export async function addSchedule(userId: string, taskId: string, start: Date, end: Date, source = "user"): Promise<{ id: string }> {
  const schedule = await prisma.schedule.create({
    data: { userId, taskId, scheduledStart: start, scheduledEnd: end, source }
  });
  return { id: schedule.id };
}

/**
 * Batch-add multiple Schedules in a single transaction.
 */
export async function addManySchedules(
  userId: string,
  taskId: string,
  slots: { start: Date; end: Date }[],
  source = "user"
): Promise<{ ids: string[] }> {
  const ids: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const slot of slots) {
      const s = await tx.schedule.create({
        data: { userId, taskId, scheduledStart: slot.start, scheduledEnd: slot.end, source }
      });
      ids.push(s.id);
    }
  });
  createDecisionLog({ userId, action: "schedule_repeat_create", targetId: taskId, reasoning: "批量创建重复Schedule", actionDetail: JSON.stringify({ count: slots.length, source }) }).catch(() => {});
  return { ids };
}

/**
 * V5 积累型：生成未来 N 天每日重复排期（默认每晚 20:00 起，时长 minutes）。
 * 支持传入 tx（在 confirm 事务内调用），不传则自建事务。
 */
export async function createAccumulateSchedules(
  userId: string,
  taskId: string,
  minutes: number,
  days = 30,
  hour = 20,
  tx?: Prisma.TransactionClient
): Promise<number> {
  const dur = Math.max(10, Math.min(480, Math.round(minutes) || 20));
  const run = async (client: Prisma.TransactionClient | typeof prisma) => {
    const start = new Date();
    start.setHours(hour, 0, 0, 0);
    start.setDate(start.getDate() + 1); // 从明天开始
    for (let d = 0; d < days; d++) {
      const s = new Date(start.getTime() + d * 86400000);
      const e = new Date(s.getTime() + dur * 60000);
      await client.schedule.create({
        data: { userId, taskId, scheduledStart: s, scheduledEnd: e, source: "ai" },
      });
    }
  };
  if (tx) {
    await run(tx);
  } else {
    await prisma.$transaction(async (c) => { await run(c); });
  }
  createDecisionLog({ userId, action: "schedule_accumulate_create", targetId: taskId, reasoning: "积累型任务生成每日重复排期", actionDetail: JSON.stringify({ minutes: dur, days }) }).catch(() => {});
  return days;
}

/**
 * 移动排期。默认删除该任务全部 schedule 后重建（单排期任务语义）。
 * 传入 targetScheduleId 时只替换目标那条（重复任务场景，修复：原实现会清空所有重复排期）。
 */
export async function moveSchedule(userId: string, taskId: string, newStart: Date, newEnd: Date, targetScheduleId?: string): Promise<{ id: string; oldStart: string | null }> {
  const oldWhere = targetScheduleId ? { id: targetScheduleId, userId, taskId } : { taskId, userId };
  const oldSchedule = await prisma.schedule.findFirst({ where: oldWhere, orderBy: { scheduledStart: "desc" } });
  const oldStart = oldSchedule?.scheduledStart.toISOString() || null;

  const schedule = await prisma.$transaction(async (tx) => {
    await tx.schedule.deleteMany({ where: oldWhere });
    const s = await tx.schedule.create({ data: { userId, taskId, scheduledStart: newStart, scheduledEnd: newEnd, source: "user" } });
    const verify = await tx.schedule.findUnique({ where: { id: s.id } });
    if (!verify || verify.scheduledStart.getTime() !== newStart.getTime()) throw new Error("schedule_verify_failed");
    return s;
  });

  createDecisionLog({ userId, action: "schedule_move", targetId: taskId, reasoning: "用户修改时间", actionDetail: JSON.stringify({ oldStart, newStart: newStart.toISOString(), targetScheduleId: targetScheduleId || null }) }).catch(() => {});
  return { id: schedule.id, oldStart };
}

/**
 * 删除该任务未来的所有 schedule（含全天事件 scheduledEnd=null）。
 * 修复：`scheduledEnd: { gt: now }` 会漏掉 scheduledEnd 为 null 的全天安排（SQL 中 NULL > x 不成立）。
 */
export async function deleteFutureSchedules(userId: string, taskId: string): Promise<number> {
  const now = new Date();
  const result = await prisma.schedule.deleteMany({
    where: { taskId, userId, OR: [{ scheduledEnd: { gt: now } }, { scheduledEnd: null }] },
  });
  return result.count;
}

export async function deleteAllSchedules(taskId: string): Promise<number> {
  const result = await prisma.schedule.deleteMany({ where: { taskId } });
  return result.count;
}

/**
 * 替换未来排期（同样处理 scheduledEnd=null 的全天事件）。
 * 已过去的历史排期保留，不删除。
 */
export async function replaceSchedule(userId: string, taskId: string, newStart: Date, newEnd: Date, source: string): Promise<{ id: string }> {
  const now = new Date();
  const schedule = await prisma.$transaction(async (tx) => {
    await tx.schedule.deleteMany({
      where: { taskId, userId, OR: [{ scheduledEnd: { gt: now } }, { scheduledEnd: null }] },
    });
    const s = await tx.schedule.create({ data: { userId, taskId, scheduledStart: newStart, scheduledEnd: newEnd, source } });
    return s;
  });
  createDecisionLog({ userId, action: "schedule_replace", targetId: taskId, reasoning: "批量重排替换", actionDetail: JSON.stringify({ start: newStart.toISOString(), source }) }).catch(() => {});
  return { id: schedule.id };
}

export async function updateSchedule(scheduleId: string, userId: string, data: { scheduledStart?: Date; scheduledEnd?: Date | null; source?: string }): Promise<void> {
  if (data.scheduledStart !== undefined) throw new Error("Schedule time modification must use moveSchedule()");
  if (data.scheduledEnd !== undefined) throw new Error("Schedule time modification must use moveSchedule()");
  const allowed: Record<string, unknown> = {};
  if (data.source !== undefined) allowed.source = data.source;
  if (Object.keys(allowed).length > 0) await prisma.schedule.update({ where: { id: scheduleId }, data: allowed });
}

export async function deleteScheduleById(scheduleId: string, userId: string): Promise<void> {
  await prisma.schedule.deleteMany({ where: { id: scheduleId, userId } });
}

/**
 * 批量平移排期（edit-schedule 的 all/future 收口到服务层，修复：原实现路由内直写时间绕过 service）
 * 全天事件（scheduledEnd=null）保持 null 平移，不崩溃。
 */
export async function shiftSchedules(
  userId: string,
  taskId: string,
  offsetMs: number,
  opts: { scope: "all" | "future"; refStart?: Date; tx?: Prisma.TransactionClient } = { scope: "all" }
): Promise<number> {
  const where: Prisma.ScheduleWhereInput = { taskId, userId };
  if (opts.scope === "future" && opts.refStart) {
    where.OR = [{ scheduledStart: { gte: opts.refStart } }, { scheduledEnd: null }];
  }
  const run = async (tx: Prisma.TransactionClient) => {
    const all = await tx.schedule.findMany({ where, orderBy: { scheduledStart: "asc" } });
    for (const s of all) {
      await tx.schedule.update({
        where: { id: s.id },
        data: {
          scheduledStart: new Date(s.scheduledStart.getTime() + offsetMs),
          scheduledEnd: s.scheduledEnd ? new Date(s.scheduledEnd.getTime() + offsetMs) : null,
        },
      });
    }
    return all.length;
  };
  if (opts.tx) return run(opts.tx);
  return prisma.$transaction(run);
}
