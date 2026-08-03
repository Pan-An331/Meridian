// Task Resolver — backend resolves task from user keywords
// LLM provides keyword, not taskId

import { prisma } from "@/lib/prisma";

export interface ResolvedTask {
  id: string;
  title: string;
  status: string;
  taskType: string;
  deadline: Date | null;
  estimatedMinutes: number | null;
  schedule: { start: string; end: string | null } | null;
}

export interface ResolveResult {
  success: boolean;
  task?: ResolvedTask;
  candidates?: { id: string; title: string; createdAt: string }[];
  needChoose?: boolean;
  message?: string;
}

export async function resolveTask(userId: string, keyword: string): Promise<ResolveResult> {
  const kw = keyword.trim();
  if (!kw || kw.length < 1) return { success: false, message: "请输入任务关键词" };

  // Exact match first
  const exact = await prisma.task.findFirst({
    where: { userId, title: kw, status: { notIn: ["completed", "cancelled", "snoozed"] } },
    include: { schedules: { where: { scheduledStart: { gte: new Date() } }, orderBy: { scheduledStart: "asc" }, take: 1 } },
  });
  if (exact) {
    return {
      success: true,
      task: {
        id: exact.id, title: exact.title, status: exact.status, taskType: exact.taskType,
        deadline: exact.deadline, estimatedMinutes: exact.estimatedMinutes,
        schedule: exact.schedules[0]
          ? { start: exact.schedules[0].scheduledStart.toISOString(), end: exact.schedules[0].scheduledEnd?.toISOString() || null }
          : null,
      },
    };
  }

  // Contains match
  const contains = await prisma.task.findMany({
    where: { userId, title: { contains: kw }, status: { notIn: ["completed", "cancelled", "snoozed"] } },
    include: { schedules: { where: { scheduledStart: { gte: new Date() } }, orderBy: { scheduledStart: "asc" }, take: 1 } },
    take: 10,
  });

  if (contains.length === 1) {
    const t = contains[0];
    return {
      success: true,
      task: {
        id: t.id, title: t.title, status: t.status, taskType: t.taskType,
        deadline: t.deadline, estimatedMinutes: t.estimatedMinutes,
        schedule: t.schedules[0]
          ? { start: t.schedules[0].scheduledStart.toISOString(), end: t.schedules[0].scheduledEnd?.toISOString() || null }
          : null,
      },
    };
  }

  if (contains.length > 1) {
    return {
      success: false,
      needChoose: true,
      candidates: contains.map(t => ({
        id: t.id, title: t.title,
        createdAt: t.createdAt?.toISOString() || "",
      })),
      message: "找到多个匹配任务",
    };
  }

  // Try by schedule title
  const bySchedule = await prisma.schedule.findFirst({
    where: { userId, task: { title: { contains: kw } }, scheduledStart: { gte: new Date() } },
    include: { task: { include: { schedules: { where: { scheduledStart: { gte: new Date() } }, orderBy: { scheduledStart: "asc" }, take: 1 } } } },
    orderBy: { scheduledStart: "asc" },
  });
  if (bySchedule) {
    const t = bySchedule.task;
    return {
      success: true,
      task: {
        id: t.id, title: t.title, status: t.status, taskType: t.taskType,
        deadline: t.deadline, estimatedMinutes: t.estimatedMinutes,
        schedule: t.schedules[0]
          ? { start: t.schedules[0].scheduledStart.toISOString(), end: t.schedules[0].scheduledEnd?.toISOString() || null }
          : null,
      },
    };
  }

  return { success: false, message: "没有找到相关任务" };
}
