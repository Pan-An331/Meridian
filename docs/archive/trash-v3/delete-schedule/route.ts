// ⚠️ 已知未接线（无前端消费）：排期批量删除（this/future/all），详情面板未来功能预留
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/plan/delete-schedule
 * Delete schedules with scope: "this" | "future" | "all"
 * Body: { scheduleId, taskId, scope }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let scheduleId: string, taskId: string, scope: string;
  try {
    const body = await req.json();
    scheduleId = body.scheduleId;
    taskId = body.taskId;
    scope = body.scope || "this";
  } catch { return badRequest("请求格式错误"); }

  if (!scheduleId || !taskId) return badRequest("缺少必要参数");

  try {
    if (scope === "this") {
      // 修复 IDOR：走 service（deleteScheduleById 内部带归属校验）
      const { deleteScheduleById } = await import("@/lib/schedule/service");
      await deleteScheduleById(scheduleId, session.user.id);
      return NextResponse.json({ success: true, deleted: 1, scope: "this" });
    }

    const refSchedule = await prisma.schedule.findFirst({ where: { id: scheduleId, userId: session.user.id, taskId } });
    if (!refSchedule) return NextResponse.json({ error: "Schedule不存在" }, { status: 404 });

    if (scope === "future") {
      const result = await prisma.schedule.deleteMany({
        where: {
          taskId,
          userId: session.user.id,
          scheduledStart: { gte: refSchedule.scheduledStart },
        },
      });
      return NextResponse.json({ success: true, deleted: result.count, scope: "future" });
    }

    // scope === "all" — delete all schedules, keep the task
    if (scope === "all") {
      const result = await prisma.schedule.deleteMany({ where: { taskId, userId: session.user.id } });
      return NextResponse.json({ success: true, deleted: result.count, scope: "all", taskPreserved: true });
    }

    return badRequest("无效的 scope");
  } catch (e) {
    console.error("[delete-schedule]", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
