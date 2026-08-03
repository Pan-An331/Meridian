// V5 项目整理页：移动任务节点（改父子关系）
// POST /api/projects/move { taskId, newParentId: string | null, sortOrder? }
// 循环防护：newParentId 不能是 taskId 自身或其子孙

import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let taskId: string, newParentId: string | null, sortOrder: number | undefined;
  try {
    const body = await req.json();
    taskId = body.taskId;
    newParentId = body.newParentId || null;
    sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : undefined;
  } catch { return badRequest("请求格式错误"); }
  if (!taskId) return badRequest("缺少 taskId");

  // 归属校验（项目铁律：查 id 必须带 userId）
  const task = await prisma.task.findFirst({ where: { id: taskId, userId: session.user.id }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });

  if (newParentId) {
    const parent = await prisma.task.findFirst({ where: { id: newParentId, userId: session.user.id }, select: { id: true } });
    if (!parent) return NextResponse.json({ error: "目标父任务不存在" }, { status: 404 });
    // 循环防护：newParentId 不能是 taskId 自身或其任意层级子孙
    if (newParentId === taskId) return badRequest("不能挂到自己下面");
    const all = await prisma.task.findMany({ where: { userId: session.user.id }, select: { id: true, parentId: true } });
    const childMap = new Map<string, string[]>();
    for (const t of all) {
      if (t.parentId) {
        const arr = childMap.get(t.parentId) || [];
        arr.push(t.id);
        childMap.set(t.parentId, arr);
      }
    }
    const stack = [taskId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (cur === newParentId) return badRequest("不能挂到自己的子孙下面");
      for (const c of (childMap.get(cur) || [])) stack.push(c);
    }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { parentId: newParentId, ...(sortOrder !== undefined ? { sortOrder } : {}) },
  });

  // 写观察（层级调整行为，供 pattern mining）
  prisma.userObservation.create({
    data: { userId: session.user.id, type: "tree_move", taskId, detail: JSON.stringify({ newParentId }) },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
