import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { executeDecisionAction } from "@/lib/ai/decision/executor";
import type { DecisionAction } from "@/lib/ai/decision/interface";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let action: DecisionAction, originalDecision: string;
  try {
    const body = await req.json();
    action = body.action;
    originalDecision = body.originalDecision || "";
  } catch { return badRequest("请求格式错误"); }

  if (!action || !action.type || !action.id) {
    return badRequest("缺少 action 参数");
  }

  try {
    const result = await executeDecisionAction(session.user.id, action, originalDecision);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[decision/confirm]", e);
    return NextResponse.json({ error: "执行失败" }, { status: 500 });
  }
}
