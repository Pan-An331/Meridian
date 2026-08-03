import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { analyzeToday } from "@/lib/ai/today-decide";
import { prisma } from "@/lib/prisma";
import { getCurrentState } from "@/lib/ai/user-state";
import { localDateStr } from "@/lib/date";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let body: { message: string };
  try { body = await req.json(); } catch { return badRequest("请求格式错误"); }
  if (!body.message?.trim()) return badRequest("请输入内容");

  const userId = session.user.id.trim();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [inProgress, todaySchedules, todayDec, userState, todayTimeLogs, todayFeedbacks, stateHistory] = await Promise.all([
    prisma.task.findFirst({ where: { userId, status: "in_progress" }, select: { id: true, title: true, estimatedMinutes: true, importance: true, deadline: true } }),
    prisma.schedule.findMany({
      where: { userId, scheduledStart: { gte: today } },
      include: { task: { select: { id: true, title: true, estimatedMinutes: true, importance: true, deadline: true } } },
      orderBy: { scheduledStart: "asc" },
    }),
    prisma.todayDecision.findFirst({ where: { userId, date: localDateStr() } }),
    getCurrentState(userId).catch(() => null),
    prisma.timeLog.findMany({ where: { userId, startedAt: { gte: today } }, select: { taskId: true, durationSeconds: true, type: true } }),
    prisma.taskExecutionFeedback.findMany({ where: { userId, createdAt: { gte: today } }, select: { reason: true } }),
    prisma.userState.findMany({ where: { userId, createdAt: { gte: today } }, orderBy: { createdAt: "desc" }, select: { stateType: true, value: true } }),
  ]);

  // Current task with elapsed
  const currentTask = inProgress ? (() => {
    const elapsed = Math.round(todayTimeLogs.filter(l => l.taskId === inProgress.id).reduce((s, l) => s + l.durationSeconds, 0) / 60);
    return { id: inProgress.id, title: inProgress.title, plannedMinutes: inProgress.estimatedMinutes || 0, importance: inProgress.importance, deadline: inProgress.deadline?.toISOString() || null, elapsedMinutes: elapsed };
  })() : null;

  const todayTasks = todaySchedules.map(s => ({
    taskId: s.task.id, title: s.task.title, estimatedMinutes: s.task.estimatedMinutes, importance: s.task.importance, deadline: s.task.deadline?.toISOString() || null,
  }));

  // State history summary
  const prevEnergy = stateHistory.find(s => s.stateType === "energy");
  const hasHistory = stateHistory.length > 1;

  // Context summary for richer analysis
  const context = {
    totalTodayTasks: todayTasks.length,
    completedToday: todayTimeLogs.filter(l => l.type === "complete").length,
    totalPausesToday: todayFeedbacks.length,
    stateChanged: hasHistory,
    previousEnergy: prevEnergy?.value || null,
  };

  const result = await analyzeToday({
    message: body.message, userId, currentTask, todayTasks,
    userState: userState ? { energy: userState.energy, focus: userState.focusLevel || null, stress: userState.stress } : null,
    context,
  });

  return NextResponse.json(result);
}
