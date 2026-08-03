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

  const [logs, feedbacks] = await Promise.all([
    prisma.timeLog.findMany({
      where: { taskId: id, userId: session.user.id },
      orderBy: { startedAt: "asc" },
      select: { type: true, startedAt: true, endedAt: true, durationSeconds: true },
    }),
    prisma.taskExecutionFeedback.findMany({
      where: { taskId: id, userId: session.user.id },
      orderBy: { createdAt: "asc" },
      select: { reason: true, createdAt: true },
    }),
  ]);

  const events: any[] = [];
  let pauseCount = 0;
  for (const log of logs) {
    const event: any = { time: log.startedAt.toISOString(), type: log.type };
    if (log.type === "pause") pauseCount++;
    if (log.type === "pause" || log.type === "complete") {
      event.durationMin = Math.round(log.durationSeconds / 60);
      if (log.endedAt) {
        const match = feedbacks.find(f => Math.abs(f.createdAt.getTime() - log.endedAt!.getTime()) < 5000);
        if (match) event.reason = match.reason;
      }
    }
    events.push(event);
  }

  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id }, // 修复 IDOR：按归属查询
    select: { title: true, estimatedMinutes: true, actualMinutes: true, status: true },
  });

  return NextResponse.json({
    taskTitle: task?.title || "",
    estimatedMin: task?.estimatedMinutes || 0,
    actualMin: task?.actualMinutes || 0,
    status: task?.status || "not_started",
    pauseCount,
    events,
  });
}
