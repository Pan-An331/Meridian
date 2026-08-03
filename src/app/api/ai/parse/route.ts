import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { parseTask } from "@/lib/ai/parser";

// POST /api/ai/parse - parse natural language input into structured task
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let input;
  try {
    const body = await req.json();
    input = body.input;
  } catch {
    return badRequest("请求格式错误");
  }

  if (!input || typeof input !== "string" || input.trim().length < 2) {
    return badRequest("请输入任务描述");
  }

  try {
    const parsed = await parseTask(session.user.id, input.trim());
    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI 解析失败";
    if (message === "AI_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "请先在设置中配置 AI API" },
        { status: 400 }
      );
    }
    if (message.startsWith("AI_API_ERROR:")) {
      return NextResponse.json(
        { error: "AI 服务调用失败，请检查 API 配置" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}