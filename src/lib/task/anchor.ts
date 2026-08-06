/* ═══════════════════════════════════════════
   任务层级锚点解析（2026-08-06 · 用户反馈"Plan/Today 显示项目名而非小阶段"）
   · 用户层级：项目 → 大阶段 → 小阶段（level=task 锚点）→ 分任务（清单项）
   · 语义：project/phase 是结构容器，不可直接作为排期/执行粒度；
     level=task 的节点是"可安排锚点"（排期/执行的最小单位）
   · resolveAnchorTask：容器排期/执行时自动下沉到其下第一个未完成的 task 锚点子级
   ═══════════════════════════════════════════ */

import { prisma } from "@/lib/prisma";

/**
 * 解析任务的排期/执行锚点：
 * - level=task（或 null）→ 自身（已是锚点）
 * - project/phase 容器 → DFS 找第一个未完成的 task 级子孙（sortOrder asc）
 * - 无可用子孙 → 自身（退化：容器本身可排）
 */
export async function resolveAnchorTask(userId: string, taskId: string): Promise<string> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, level: true },
  });
  if (!task || task.level === "task" || task.level == null) return taskId;

  // 容器：BFS 向下找第一个未完成的 task 级子孙
  const stack = [taskId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const children = await prisma.task.findMany({
      where: { userId, parentId: cur, status: { notIn: ["completed", "cancelled"] } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, level: true },
    });
    for (const c of children) {
      if (c.level === "task") return c.id;
      stack.push(c.id);
    }
  }
  return taskId;
}
