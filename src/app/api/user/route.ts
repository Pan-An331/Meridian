import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// PUT /api/user — 更新用户资料（白名单字段，修复：昵称之前无保存入口）
export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let body: any;
  try { body = await req.json(); } catch { return badRequest("请求格式错误"); }

  const data: Record<string, unknown> = {};
  if (body.nickname !== undefined) {
    const nickname = String(body.nickname).trim();
    if (nickname.length < 1 || nickname.length > 30) return badRequest("昵称长度需在 1-30 字");
    data.nickname = nickname;
  }
  if (Object.keys(data).length === 0) return badRequest("没有可更新的字段");

  await prisma.user.update({ where: { id: session.user.id }, data });
  return NextResponse.json({ success: true });
}

// POST /api/user?action=cleanup — 清理学习数据（行为记录 + AI 记忆 + 决策日志，任务本身保留）
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  if (searchParams.get("action") !== "cleanup") return badRequest("未知操作");

  const userId = session.user.id;
  const [observations, patterns, memories, decisionLogs, todayDecisions, userModel] = await prisma.$transaction(async (tx) => {
    const observations = await tx.userObservation.deleteMany({ where: { userId } });
    const patterns = await tx.userPattern.deleteMany({ where: { userId } });
    const memories = await tx.agentMemory.deleteMany({ where: { userId } });
    const decisionLogs = await tx.decisionLog.deleteMany({ where: { userId } });
    const todayDecisions = await tx.todayDecision.deleteMany({ where: { userId } });
    const userModel = await tx.userModel.deleteMany({ where: { userId } });
    return [observations.count, patterns.count, memories.count, decisionLogs.count, todayDecisions.count, userModel.count];
  });

  return NextResponse.json({ success: true, cleared: { observations, patterns, memories, decisionLogs, todayDecisions, userModel } });
}

// DELETE /api/user — 永久删除账户（全部数据，事务内级联清理）
export async function DELETE() {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const userId = session.user.id;

  await prisma.$transaction(async (tx) => {
    // 按 FK 依赖顺序清理（SQLite 无自动级联）
    await tx.userState.deleteMany({ where: { userId } });
    await tx.agentMemory.deleteMany({ where: { userId } });
    await tx.agentFeedback.deleteMany({ where: { userId } });
    await tx.decisionLog.deleteMany({ where: { userId } });
    await tx.todayDecision.deleteMany({ where: { userId } });
    await tx.dailyBrief.deleteMany({ where: { userId } });
    await tx.dailySummary.deleteMany({ where: { userId } });
    await tx.dailyNote.deleteMany({ where: { userId } });
    await tx.userObservation.deleteMany({ where: { userId } });
    await tx.userPattern.deleteMany({ where: { userId } });
    await tx.userModel.deleteMany({ where: { userId } });
    await tx.userProfile.deleteMany({ where: { userId } });
    await tx.aIConfig.deleteMany({ where: { userId } });
    await tx.taskExecutionFeedback.deleteMany({ where: { userId } });
    await tx.timeLog.deleteMany({ where: { userId } });
    await tx.schedule.deleteMany({ where: { userId } });
    // 任务含子任务（parentId 无级联，先删子任务）
    const tasks = await tx.task.findMany({ where: { userId }, select: { id: true } });
    const taskIds = tasks.map((t) => t.id);
    if (taskIds.length > 0) {
      await tx.task.deleteMany({ where: { parentId: { in: taskIds } } });
    }
    await tx.task.deleteMany({ where: { userId } });
    // 草稿
    const drafts = await tx.taskDraft.findMany({ where: { userId }, select: { id: true } });
    if (drafts.length > 0) {
      await tx.taskDraftItem.deleteMany({ where: { draftId: { in: drafts.map((d) => d.id) } } });
    }
    await tx.taskDraft.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  return NextResponse.json({ success: true });
}
