import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true, title: true, status: true, importance: true,
      taskType: true, estimatedMinutes: true, deadline: true, tags: true,
    },
  });

  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  // ★ Return ALL schedules (not just findFirst) for repeat-task detection
  const schedules = await prisma.schedule.findMany({
    where: { taskId: id },
    orderBy: { scheduledStart: "asc" },
    select: { id: true, scheduledStart: true, scheduledEnd: true, source: true },
  });

  const decisionLogs = await prisma.decisionLog.findMany({
    where: { targetId: id, action: { in: ["schedule_move", "schedule_create", "decision_reschedule"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { action: true, actionDetail: true, reasoning: true, createdAt: true },
  });

  return NextResponse.json({
    task: {
      id: task.id, title: task.title, status: task.status,
      importance: task.importance, taskType: task.taskType,
      estimatedMinutes: task.estimatedMinutes, deadline: task.deadline?.toISOString(), tags: task.tags || null,
    },
    schedules: schedules.map(s => ({
      id: s.id,
      start: s.scheduledStart.toISOString(),
      end: s.scheduledEnd?.toISOString() || null,
      source: s.source,
    })),
    schedule: schedules.length > 0 ? {
      id: schedules[0].id,
      start: schedules[0].scheduledStart.toISOString(),
      end: schedules[0].scheduledEnd?.toISOString() || null,
      source: schedules[0].source,
    } : null,
    history: decisionLogs.map(log => {
      try {
        const detail = JSON.parse(log.actionDetail || "{}");
        return { action: log.action, detail, reasoning: log.reasoning, time: log.createdAt.toISOString() };
      } catch {
        return { action: log.action, detail: {}, reasoning: log.reasoning, time: log.createdAt.toISOString() };
      }
    }),
  });
}
