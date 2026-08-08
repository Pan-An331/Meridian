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
  // 2026-08-07 修复（BUG-20260807-022）：Neon 高延迟下 6 表清理超过 Prisma 默认 5s 交互式事务超时 → "Transaction already closed"
  const [observations, patterns, memories, decisionLogs, todayDecisions, userModel] = await prisma.$transaction(async (tx) => {
    const observations = await tx.userObservation.deleteMany({ where: { userId } });
    const patterns = await tx.userPattern.deleteMany({ where: { userId } });
    const memories = await tx.agentMemory.deleteMany({ where: { userId } });
    const decisionLogs = await tx.decisionLog.deleteMany({ where: { userId } });
    const todayDecisions = await tx.todayDecision.deleteMany({ where: { userId } });
    const userModel = await tx.userModel.deleteMany({ where: { userId } });
    return [observations.count, patterns.count, memories.count, decisionLogs.count, todayDecisions.count, userModel.count];
  }, { timeout: 60_000 });

  return NextResponse.json({ success: true, cleared: { observations, patterns, memories, decisionLogs, todayDecisions, userModel } });
}

// DELETE /api/user — 永久删除账户（全部数据，事务内级联清理）
export async function DELETE() {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const userId = session.user.id;

  // 2026-08-07 修复（BUG-20260807-022/023）：DELETE 账户大事务在 Neon 高延迟下超 5s 超时 → 加 60s；
  // 且 Neon 连接池下 Prisma 交互式事务语句可能分到不同后端连接，事务内 FK 交叉检查
  // 不可见（daily_summaries 等删除后 user.delete 仍报 RESTRICT）→ 改为顺序执行（每步独立提交）
  const q = (table: string) => prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE "userId" = '${userId}'`);
  // 按 FK 依赖顺序清理（任务含子任务 parentId 无级联 → 先删子任务）
  const TABLES = [
    "user_states", "agent_memories", "agent_feedbacks", "decision_logs", "today_decisions",
    "daily_briefs", "daily_summaries", "daily_notes", "user_observations", "user_patterns",
    "user_models", "user_profiles", "ai_configs", "task_execution_feedback", "time_logs", "schedules",
  ];
  const cleanupUserTables = async () => {
    for (const t of TABLES) await q(t);
    await prisma.$executeRawUnsafe(`DELETE FROM "tasks" WHERE "parentId" IN (SELECT "id" FROM "tasks" WHERE "userId" = '${userId}')`);
    await q("tasks");
    await prisma.$executeRawUnsafe(`DELETE FROM "task_draft_items" WHERE "draftId" IN (SELECT "id" FROM "task_drafts" WHERE "userId" = '${userId}')`);
    await q("task_drafts");
  };
  await cleanupUserTables();
  // users 删除：容忍异步 pipeline（views/today 的 daily summary、stats 的 analyzeDailyBehavior 等）
  // 并发写入行为类表 → FK 冲突重试时【全量重清】（BUG-20260807-029：原实现仅重清 2 表，
  // user_models/user_patterns 等被异步写入时 10 次重试全失败）
  let userDeleted = false;
  for (let i = 0; i < 10 && !userDeleted; i++) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "users" WHERE "id" = '${userId}'`);
      userDeleted = true;
    } catch {
      await cleanupUserTables();
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  if (!userDeleted) {
    console.error(`[user] 删除账户失败（FK 残留）: ${userId}`);
    return NextResponse.json({ error: "删除账户失败，请重试" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
