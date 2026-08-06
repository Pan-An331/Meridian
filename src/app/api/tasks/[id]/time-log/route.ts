// POST /api/tasks/[id]/time-log — 手动补记实际用时（完成未计时时的人为补录）
// body: { durationMinutes: number, note?: string }
// 写 TimeLog（type: "manual"），Review/统计/卡片已用时间自动生效

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  try {
    const { id } = await params;
    const body = await req.json();
    const durationMinutes = body.durationMinutes;
    if (typeof durationMinutes !== "number" || !Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      return badRequest("durationMinutes 需为 1-1440 的分钟数");
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : undefined;

    const task = await prisma.task.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
    if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

    const now = new Date();
    const startedAt = new Date(now.getTime() - durationMinutes * 60000);
    const log = await prisma.timeLog.create({
      data: {
        taskId: id,
        userId: session.user.id,
        startedAt,
        endedAt: now,
        durationSeconds: durationMinutes * 60,
        type: "manual",
        ...(note ? { detail: note } : {}),
      },
    });

    return NextResponse.json({ success: true, timeLog: log });
  } catch (e) {
    console.error("[time-log] create failed:", e);
    return NextResponse.json({ error: "补记失败" }, { status: 500 });
  }
}
