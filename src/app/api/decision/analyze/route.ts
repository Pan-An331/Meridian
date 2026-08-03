import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { analyze } from "@/lib/ai/decision";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let message: string;
  try { const body = await req.json(); message = body.message; } catch { return badRequest("请求格式错误"); }
  if (!message || message.trim().length < 2) return badRequest("请输入决定内容");

  try {
    const result = await analyze(session.user.id, message.trim());
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "分析失败";
    if (msg === "AI_NOT_CONFIGURED") return NextResponse.json({ error: "请先配置AI" }, { status: 400 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
