/* ═══════════════════════════════════════════
   任务层级锚点解析（2026-08-06 · 修复：★ 执行清单优先）
   · 用户层级：项目 → 大阶段 → 小阶段（task 锚点）→ 执行清单条目（清单项，非锚点）
   · 语义：★（执行清单）= 可安排锚点，无论 level 字段是什么
     （level=task 的子任务只是清单项，不应作为排期/执行单位 —— 修复"拖采购元器件显示杜邦线"）
   · 规则：
     1. 任务自身 ★ → 自身（锚点）
     2. 容器（project/phase/未★）→ BFS 找第一个 ★ 子孙；无 ★ 子孙则找第一个 level=task 子孙
     3. 兜底返回自身
   ═══════════════════════════════════════════ */

import { prisma } from "@/lib/prisma";

/**
 * 解析任务的排期/执行锚点：
 * - 任务自身标记 ★（执行清单）→ 自身（★ = 用户钦定的可安排单位）
 * - project/phase 容器（未 ★）→ BFS 找第一个未完成的 ★ 子孙；无则第一个 task 级子孙
 * - 无可用子孙 → 自身（退化）
 */
export async function resolveAnchorTask(userId: string, taskId: string): Promise<string> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, level: true, star: true },
  });
  if (!task) return taskId;
  // ★ 执行清单 = 锚点（无论 level；子任务未 ★ 永远不会被选中）
  if (task.star) return taskId;

  // 容器（未 ★）：BFS 向下找锚点子级（★ 优先，level=task 兜底）
  const stack = [taskId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const children = await prisma.task.findMany({
      where: { userId, parentId: cur, status: { notIn: ["completed", "cancelled"] } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, level: true, star: true },
    });
    for (const c of children) {
      if (c.star) return c.id;                 // ★ 子任务 = 锚点
      if (c.level === "task") return c.id;     // 兜底：task 级
      stack.push(c.id);
    }
  }
  return taskId;
}
