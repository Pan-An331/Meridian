import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const where: any = { userId: session.user.id };
  if (action) where.agentAction = action;
  const feedbacks = await prisma.agentFeedback.findMany({
    where, orderBy: { createdAt: "desc" }, take: 20,
  });
  return NextResponse.json(feedbacks);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  let body: any;
  try { body = await req.json(); } catch { return badRequest("请求格式错误"); }
  if (!body.agentAction || !body.userResponse) return badRequest("agentAction和userResponse不能为空");
  // 修复 P1-17：userResponse 白名单（防任意字符串污染 analyzeFeedback 规则）
  const VALID_RESPONSES = ["accepted", "modified", "rejected", "ignored"];
  if (!VALID_RESPONSES.includes(body.userResponse)) return badRequest("无效的 userResponse");
  // 修复：taskId 归属校验（防止给他人任务挂反馈）
  if (body.taskId) {
    const owned = await prisma.task.findFirst({ where: { id: body.taskId, userId: session.user.id }, select: { id: true } });
    if (!owned) return badRequest("任务不存在或无权操作");
  }

  const feedback = await prisma.agentFeedback.create({
    data: {
      userId: session.user.id,
      agentAction: body.agentAction,
      agentSuggestion: body.agentSuggestion || null,
      userResponse: body.userResponse,
      userModification: body.userModification || null,
      modifiedField: body.modifiedField || null,
      originalValue: body.originalValue || null,
      userValue: body.userValue || null,
      taskId: body.taskId || null,
      context: body.context || null,
    },
  });
  return NextResponse.json(feedback);
}
