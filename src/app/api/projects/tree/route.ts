// V5 项目整理页：读取任务树
// GET /api/projects/tree → { roots: TreeNode[], orphans: TreeNode[] }
// 一次全查 + 内存组装（深度不限），orphans = 未挂树的任务级任务（可拖进任意树）

import { NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

interface TreeNode {
  id: string;
  title: string;
  level: string;
  status: string;
  accumulate: boolean;
  completedAt: string | null;
  category: string | null;
  estimatedMinutes: number | null;
  deadline: string | null;
  importance: number;
  parentId: string | null;
  children: TreeNode[];
}

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const tasks = await prisma.task.findMany({
    where: { userId: session.user.id },
    select: {
      id: true, title: true, level: true, status: true, accumulate: true,
      completedAt: true, category: true, estimatedMinutes: true,
      deadline: true, importance: true, parentId: true, sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const nodes = new Map<string, TreeNode>();
  for (const t of tasks) {
    nodes.set(t.id, {
      id: t.id, title: t.title, level: t.level || "task", status: t.status,
      accumulate: t.accumulate, completedAt: t.completedAt?.toISOString() ?? null,
      category: t.category, estimatedMinutes: t.estimatedMinutes,
      deadline: t.deadline?.toISOString() ?? null, importance: t.importance,
      parentId: t.parentId, children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const t of tasks) {
    const node = nodes.get(t.id)!;
    if (t.parentId && nodes.has(t.parentId)) {
      nodes.get(t.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // trees = 全部根节点（前端按树渲染，展开/折叠）
  // orphans = 便捷列表：未挂树的 task 级任务（前端"待整理池"，可拖进任意树）
  const orphans = roots.filter(r => r.level === "task" && r.status !== "cancelled");

  return NextResponse.json({ trees: roots, orphans });
}
