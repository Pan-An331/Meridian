import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// GET /api/tasks/[id]/timer - get current session and total time
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  // Get current active session (started but not ended)
  const currentSession = await prisma.timeLog.findFirst({
    where: { taskId: id, userId: session.user.id, endedAt: null },
    orderBy: { createdAt: "desc" },
  });

  // Get all time logs
  const allLogs = await prisma.timeLog.findMany({
    where: { taskId: id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const totalSeconds = allLogs.reduce((sum, log) => sum + log.durationSeconds, 0);

  return NextResponse.json({
    currentSession: currentSession ? {
      startedAt: currentSession.startedAt.toISOString(),
      type: currentSession.type,
    } : null,
    totalSeconds,
    totalMinutes: task.actualMinutes,
    logs: allLogs.slice(0, 10),
  });
}

// POST /api/tasks/[id]/timer - timer actions
// Body: { action: "start" | "pause" | "resume" | "complete" }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  let action: string;
  try {
    const body = await req.json();
    action = body.action;
  } catch {
    return badRequest("请求格式错误");
  }

  const currentSession = await prisma.timeLog.findFirst({
    where: { taskId: id, userId: session.user.id, endedAt: null },
  });

  switch (action) {
    case "start":
    case "resume": {
      if (currentSession) return badRequest("已有进行中的计时");
      // 修复 P0-4：cancelled 不可复活；snoozed 开始必须清 snoozeUntil
      if (task.status === "cancelled") return badRequest("已取消的任务不可开始计时");
      // 互斥：同一时刻只允许一个 in_progress（与 /action start 一致）
      await prisma.$transaction(async (tx) => {
        await tx.timeLog.create({
          data: {
            taskId: id,
            userId: session.user.id,
            startedAt: new Date(),
            type: action,
          },
        });
        await tx.task.updateMany({ where: { userId: session.user.id, status: "in_progress" }, data: { status: "not_started" } });
        await tx.task.update({
          where: { id },
          data: { status: "in_progress", snoozeUntil: null },
        });
      });
      break;
    }

    case "pause": {
      if (!currentSession) return badRequest("没有进行中的计时");
      const now = new Date();
      const durationSeconds = Math.floor((now.getTime() - currentSession.startedAt.getTime()) / 1000);
      const addedMinutes = Math.round(durationSeconds / 60);
      await prisma.$transaction(async (tx) => {
        await tx.timeLog.update({
          where: { id: currentSession.id },
          data: { endedAt: now, durationSeconds, type: "pause" },
        });
        await tx.task.update({
          where: { id },
          data: {
            actualMinutes: addedMinutes > 0 ? { increment: addedMinutes } : undefined,
            status: "not_started",
          },
        });
      });
      break;
    }

    case "complete": {
      if (task.status === "cancelled") return badRequest("已取消的任务不可完成");
      await prisma.$transaction(async (tx) => {
        // End current session if any
        if (currentSession) {
          const now = new Date();
          const durationSeconds = Math.floor((now.getTime() - currentSession.startedAt.getTime()) / 1000);
          await tx.timeLog.update({
            where: { id: currentSession.id },
            data: { endedAt: now, durationSeconds, type: "complete" },
          });
          const addedMinutes = Math.round(durationSeconds / 60);
          if (addedMinutes > 0) {
            await tx.task.update({
              where: { id },
              data: { actualMinutes: { increment: addedMinutes } },
            });
          }
        }
        // Mark task as completed
        await tx.task.update({
          where: { id },
          data: { status: "completed", completedAt: new Date(), snoozeUntil: null }, // 修复 P1-10
        });
      });
      break;
    }

    default:
      return badRequest("未知计时操作: " + action);
  }

  // Return updated state
  const updatedTask = await prisma.task.findFirst({ where: { id, userId: session.user.id } });
  const newSession = await prisma.timeLog.findFirst({
    where: { taskId: id, userId: session.user.id, endedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    task: updatedTask,
    currentSession: newSession ? { startedAt: newSession.startedAt.toISOString(), type: newSession.type } : null,
    totalMinutes: updatedTask?.actualMinutes || 0,
  });
}