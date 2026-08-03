// ⚠️ 已知未接线（无前端消费）：重复任务批量排期，待功能规划。接线前需补 slots 格式校验
import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { addManySchedules } from "@/lib/schedule/service";

interface RepeatSlot {
  date: string;   // "2026-08-01"
  start: string;  // "20:00"
  end: string;    // "21:00"
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let taskId: string, slots: RepeatSlot[];
  try {
    const body = await req.json();
    taskId = body.taskId;
    slots = body.slots;
  } catch { return badRequest("请求格式错误"); }

  if (!taskId || !Array.isArray(slots) || slots.length === 0) {
    return badRequest("需要 taskId 和 slots 数组");
  }

  try {
    const scheduleSlots = slots.map(s => ({
      start: new Date(s.date + "T" + s.start + ":00"),
      end: new Date(s.date + "T" + s.end + ":00"),
    }));

    const result = await addManySchedules(session.user.id, taskId, scheduleSlots, "user");
    return NextResponse.json({ success: true, ids: result.ids, count: result.ids.length });
  } catch (e) {
    console.error("[repeat schedule]", e);
    return NextResponse.json({ error: "创建重复Schedule失败" }, { status: 500 });
  }
}
