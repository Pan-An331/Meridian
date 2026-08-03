// ⚠️ 已知未接线（无前端消费）：排期批量编辑（this/future/all），详情面板未来功能预留
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/plan/edit-schedule
 * Edit a single schedule or batch-update future/all schedules for a repeat task.
 * Body: { scheduleId, newStart, newEnd, scope: "this" | "future" | "all", taskDate?: string, taskId: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let scheduleId: string, newStart: string, newEnd: string | undefined;
  let scope = "this";
  let taskDate: string | undefined;
  let taskId: string;
  try {
    const body = await req.json();
    scheduleId = body.scheduleId;
    newStart = body.newStart;
    newEnd = body.newEnd;
    scope = body.scope || "this";
    taskDate = body.taskDate;
    taskId = body.taskId;
  } catch { return badRequest("请求格式错误"); }

  if (!scheduleId || !newStart || !taskId) return badRequest("缺少必要参数");

  try {
    if (scope === "this") {
      // 修复 IDOR：更新前校验 schedule 归属（userId + taskId），先删后建原子替换
      const owned = await prisma.schedule.findFirst({ where: { id: scheduleId, userId: session.user.id, taskId } });
      if (!owned) return NextResponse.json({ error: "Schedule不存在或无权操作" }, { status: 404 });
      await prisma.$transaction(async (tx) => {
        await tx.schedule.deleteMany({ where: { id: scheduleId, userId: session.user.id, taskId } });
        await tx.schedule.create({
          data: {
            userId: session.user.id, taskId,
            scheduledStart: new Date(newStart),
            scheduledEnd: newEnd ? new Date(newEnd) : owned.scheduledEnd,
            source: owned.source || "user",
          },
        });
      });
      return NextResponse.json({ success: true, updated: 1, scope: "this" });
    }

    // Get time offset from the edited schedule（校验归属）
    const refSchedule = await prisma.schedule.findFirst({ where: { id: scheduleId, userId: session.user.id, taskId } });
    if (!refSchedule) return NextResponse.json({ error: "Schedule不存在" }, { status: 404 });

    const oldStart = new Date(refSchedule.scheduledStart);
    const oldEnd = new Date(refSchedule.scheduledEnd!);
    const newStartDate = new Date(newStart);
    const newEndDate = newEnd ? new Date(newEnd) : new Date(newStartDate.getTime() + (oldEnd.getTime() - oldStart.getTime()));

    // Time offset to apply
    const offsetMs = newStartDate.getTime() - oldStart.getTime();
    const durationMs = oldEnd.getTime() - oldStart.getTime();

    if (scope === "all") {
      // 修复 P1-4：平移收口到 service（shiftSchedules），不再路由内直写时间
      const { shiftSchedules } = await import("@/lib/schedule/service");
      const updated = await shiftSchedules(session.user.id, taskId, offsetMs, { scope: "all" });
      return NextResponse.json({ success: true, updated, scope: "all" });
    }

    // scope === "future"
    const { shiftSchedules } = await import("@/lib/schedule/service");
    const updated = await shiftSchedules(session.user.id, taskId, offsetMs, { scope: "future", refStart: oldStart });
    return NextResponse.json({ success: true, updated, scope: "future" });
  } catch (e) {
    console.error("[edit-schedule]", e);
    return NextResponse.json({ error: "编辑失败" }, { status: 500 });
  }
}
