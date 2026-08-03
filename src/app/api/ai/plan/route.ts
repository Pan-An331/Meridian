import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { generateSchedule, saveSchedule } from "@/lib/ai/planner";

// POST /api/ai/plan - 用户主动触发AI规划
// 要求传入 taskIds，禁止全量重排
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let taskIds: string[] = [];
  try {
    const body = await req.json();
    taskIds = body.taskIds || [];
  } catch {}

  if (!taskIds || taskIds.length === 0) {
    return badRequest("请指定需要规划的任务ID");
  }

  try {
    const result = await generateSchedule(session.user.id, taskIds);

    let saved = 0;
    if (result.suggestions && result.suggestions.length > 0) {
      saved = await saveSchedule(session.user.id, result.suggestions, "ai");
    }

    return NextResponse.json({
      success: true,
      scheduled: saved,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    if (message === "AI_NOT_CONFIGURED") {
      return NextResponse.json({ error: "请先在设置中配置 AI API" }, { status: 400 });
    }
    console.error("[ai/plan]", e);
    // 修复：不向客户端泄露内部错误详情（AI 错误统一提示）
    if (message.startsWith("AI_API_ERROR") || message.startsWith("AI_REQUEST_TIMEOUT")) {
      return NextResponse.json({ error: "AI 服务调用失败，请检查 API 配置" }, { status: 502 });
    }
    return NextResponse.json({ error: "规划失败" }, { status: 500 });
  }
}
