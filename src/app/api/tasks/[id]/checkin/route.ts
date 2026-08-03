// V5 积累型：打卡 API
// POST /api/tasks/[id]/checkin  { minutes?, date? } → 创建/更新当日打卡记录（timeLog type=checkin）
// GET  /api/tasks/[id]/checkin  → 打卡统计（连续天数/最长/30 天点阵）

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getStreak } from "@/lib/task/streak";
import { localDateStr } from "@/lib/date";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const task = await prisma.task.findFirst({ where: { id, userId: session.user.id }, select: { id: true, accumulate: true, estimatedMinutes: true } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (!task.accumulate) return badRequest("非积累型任务不支持打卡");

  let minutes: number | undefined, date: string | undefined, detail: string | undefined;
  try { const body = await req.json(); minutes = body.minutes; date = body.date; detail = body.detail; } catch { return badRequest("请求格式错误"); }
  // FCV2 C6：打卡内容白名单（≤200 字，空则 null）
  const detailNorm = typeof detail === "string" && detail.trim() ? detail.trim().slice(0, 200) : null;

  // 日期校验（支持补打，防未来打卡）
  let target = new Date();
  if (date) {
    target = new Date(date + "T00:00:00");
    if (isNaN(target.getTime())) return badRequest("日期格式错误");
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    if (target >= tomorrow) return badRequest("不能为未来日期打卡");
  }
  const dayStr = localDateStr(target);

  // 时长默认任务估计分钟（≥10）
  const durMin = Math.max(10, Math.min(480, typeof minutes === "number" && minutes > 0 ? Math.round(minutes) : (task.estimatedMinutes || 20)));

  // 当天已有打卡 → 更新时长；否则新增
  const existing = await prisma.timeLog.findFirst({
    where: { userId: session.user.id, taskId: id, type: "checkin", startedAt: { gte: target, lt: new Date(target.getTime() + 86400000) } },
    select: { id: true },
  });
  const now = new Date();
  if (existing) {
    await prisma.timeLog.update({
      where: { id: existing.id },
      data: { durationSeconds: durMin * 60, endedAt: now, type: "checkin", ...(detailNorm ? { detail: detailNorm } : {}) },
    });
  } else {
    await prisma.timeLog.create({
      data: {
        userId: session.user.id, taskId: id, type: "checkin",
        startedAt: target, endedAt: new Date(target.getTime() + durMin * 60000),
        durationSeconds: durMin * 60,
        detail: detailNorm,
      },
    });
  }

  // 打卡写观察（学习闭环：坚持行为）
  prisma.userObservation.create({
    data: { userId: session.user.id, type: "checkin", taskId: id, category: null, detail: JSON.stringify({ date: dayStr, minutes: durMin }) },
  }).catch(() => {});

  const streak = await getStreak(session.user.id, id);
  return NextResponse.json({ success: true, streak });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { id } = await params;

  const task = await prisma.task.findFirst({ where: { id, userId: session.user.id }, select: { id: true, accumulate: true } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  if (!task.accumulate) return badRequest("非积累型任务不支持打卡");

  const streak = await getStreak(session.user.id, id);
  return NextResponse.json({ streak });
}
