// V5 积累型：打卡连续天数查询
// GET /api/tasks/[id]/streak → { streak: StreakInfo }
// BUG-20260807-028：Projects 页习惯区一直 fetch 本路由但实现缺失（404 被静默 catch，
//   「已打卡 ✓」/树行"今日已打卡"状态点永不显示）→ 补建路由（复用 getStreak）。
// 注：checkin 路由的 GET 也返回 streak（历史实现，保留兼容）。

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getStreak } from "@/lib/task/streak";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const task = await prisma.task.findFirst({ where: { id, userId: session.user.id }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  const streak = await getStreak(session.user.id, id);
  return NextResponse.json({ streak });
}
