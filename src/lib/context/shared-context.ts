// Shared context for both Inbox AI and Decision AI
// Common data: UserState, AgentMemory, Task, Schedule, TimeLog

import { prisma } from "@/lib/prisma";

export interface SharedContext {
  userState: string;
  agentMemory: string;
  tasks: string;
  schedules: string;
  timeLogSummary: string;
}

export async function buildSharedContext(userId: string): Promise<SharedContext> {
  const now = new Date();

  const [states, memories, tasks, schedules, timeLogs] = await Promise.all([
    prisma.userState.findMany({ where: { userId, OR: [{ validUntil: null }, { validUntil: { gte: now } }] }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.agentMemory.findMany({ where: { userId, status: "active" }, orderBy: { importance: "desc" }, take: 10 }),
    prisma.task.findMany({ where: { userId, status: { notIn: ["completed", "cancelled", "snoozed"] } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, status: true, taskType: true, deadline: true, importance: true } }),
    prisma.schedule.findMany({ where: { userId, scheduledStart: { gte: new Date(now.getTime() - 86400000) } }, take: 20, include: { task: { select: { title: true } } } }),
    prisma.timeLog.count({ where: { userId, startedAt: { gte: new Date(now.getTime() - 7 * 86400000) } } }),
  ]);

  return {
    userState: states.map(s => `[${s.stateType}] ${s.value}`).join("; ") || "none",
    agentMemory: memories.map(m => `[${m.memoryType}] ${m.content}`).join("; ") || "none",
    tasks: tasks.map(t => `${t.title} (${t.taskType}, ${t.status})`).join("\n"), // 修复 P2-19：不向 LLM 暴露内部 id
    schedules: schedules.map(s => `${s.scheduledStart.toTimeString().slice(0, 5)} ${s.task.title}`).join("\n"),
    timeLogSummary: `${timeLogs} time entries in last 7 days`,
  };
}
