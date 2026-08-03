import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { createSchedule } from "@/lib/schedule/service";
import { createAccumulateSchedules } from "@/lib/schedule/service";
import { normalizeCategory } from "@/lib/plan/colors";

const VALID_TYPES = ["inbox", "planned", "scheduled"];

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const taskType = searchParams.get("taskType");

  const where: Record<string, unknown> = { userId: session.user.id };
  if (status) where.status = status;
  if (taskType) where.taskType = taskType;
  if (!status) where.status = { notIn: ["snoozed", "cancelled", "completed"] };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { children: true, timeLogs: { orderBy: { createdAt: "desc" }, take: 5 } },
  });

  return NextResponse.json(tasks);
}

// POST /api/tasks - create task manually
// Schedule ops via Schedule Service
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const { title, description, taskType, importance, startTime, endTime, deadline, estimatedMinutes, tags, parentId } = body;

    if (!title?.trim()) return badRequest("任务标题不能为空");

    const type = VALID_TYPES.includes(taskType) ? taskType : "inbox";
    const imp = (typeof importance === "number" && importance >= 1 && importance <= 5) ? importance : 3;
    // 分类归一化：统一为小写 DOMAINS key（兼容历史大写枚举）
    const cat = normalizeCategory(body.category);
    // V3：theme 入参归一化（≤20 字，空则 null）
    const theme = typeof body.theme === "string" && body.theme.trim() ? body.theme.trim().slice(0, 20) : null;
    // Focus Card V2：purpose 入参归一化（≤50 字，空则 null）
    const purpose = typeof body.purpose === "string" && body.purpose.trim() ? body.purpose.trim().slice(0, 50) : null;
    // V5 层级重构：level 白名单 + 积累型标记
    const level = ["project", "phase", "task"].includes(body.level) ? body.level : "task";
    const accumulate = !!body.accumulate;

    let calcEstimated = estimatedMinutes;
    if (type === "scheduled" && startTime && endTime) {
      const diff = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
      if (diff > 0) calcEstimated = diff;
    }

    // 后端兜底：scheduled 类型缺 endTime 时按预估/1h 自动补（修复：原实现导致任务创建后无排期）
    let calcEnd = endTime;
    if (type === "scheduled" && startTime && !calcEnd) {
      const est = calcEstimated && calcEstimated > 0 ? calcEstimated : 60;
      calcEnd = new Date(new Date(startTime).getTime() + est * 60000).toISOString();
    }

    // 事务化：task + schedule 原子创建，避免中途失败留下无排期任务
    const task = await prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          userId: session.user.id,
          title: title.trim(),
          description: description || null,
          taskType: type,
          importance: imp,
          theme,
          purpose,
          deadline: deadline ? new Date(deadline) : null,
          estimatedMinutes: calcEstimated || null,
          tags: tags || null,
          parentId: parentId || null,
          category: cat === "other" ? null : cat,
          // V5：层级语义 + 积累型
          level,
          accumulate,
        },
        include: { children: true },
      });
      if (type === "scheduled" && startTime && calcEnd) {
        await tx.schedule.create({
          data: { userId: session.user.id, taskId: t.id, scheduledStart: new Date(startTime), scheduledEnd: new Date(calcEnd), source: "user" },
        });
      }
      // V5 积累型：自动生成未来 30 天每日重复排期（事务内）
      if (accumulate) {
        await createAccumulateSchedules(session.user.id, t.id, calcEstimated || 20, 30, 20, tx);
      }
      return t;
    });

    // 修复 P1-16：任务创建写观察（学习闭环数据源）
    prisma.userObservation.create({
      data: { userId: session.user.id, type: "task_create", taskId: task.id, category: task.category, detail: JSON.stringify({ taskType: task.taskType, importance: task.importance }) },
    }).catch(() => {});

    return NextResponse.json(task, { status: 201 });
  } catch (e) {
    console.error("[tasks] create failed:", e);
    return NextResponse.json({ error: "创建任务失败" }, { status: 500 });
  }
}
