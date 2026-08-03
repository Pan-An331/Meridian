import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

/* ═══════════════════════════════════════════
   V3 C1：全局搜索（任务信息架构规范 V3 §4.4）
   · 标题 / 标签 contains + 归属链（祖先标题匹配 → 返回其子孙任务）
   · 空 q → 400；结果含 parentTitle 归属链 + 最近一条排期 scheduledStart
   ═══════════════════════════════════════════ */

// 归属链：递归向上收集（上限 5 级），如 "考研 / 数学"
interface TitleNode { title: string; parentId: string | null }

function buildParentTitleSync(taskId: string, titleMap: Map<string, TitleNode>): string {
  const parts: string[] = [];
  let cur: string | null = taskId;
  let guard = 0;
  while (cur && guard < 5) {
    const node = titleMap.get(cur);
    if (!node) break;
    parts.unshift(node.title);
    cur = node.parentId;
    guard++;
  }
  return parts.join(" / ");
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return badRequest("请输入搜索关键词");

  // 全量拉标题/归属链索引（SQLite contains LIKE 扫描；用户任务量级小，可接受）
  const all = await prisma.task.findMany({
    where: { userId: session.user.id },
    select: { id: true, title: true, tags: true, category: true, theme: true, status: true, taskType: true, deadline: true, parentId: true },
  });
  const titleMap = new Map(all.map(t => [t.id, { title: t.title, parentId: t.parentId }]));

  // 直接命中：标题/标签 contains
  const lower = q.toLowerCase();
  const directHits = all.filter(t =>
    t.title.toLowerCase().includes(lower) ||
    (t.tags || "").toLowerCase().includes(lower)
  );
  const directIds = new Set(directHits.map(t => t.id));

  // 归属链命中：祖先标题 contains → 返回其子孙任务（含直接子级与孙级，避免深层任务搜不到）
  // 注意：祖先自身命中也应作为锚点（不排除 directIds——它既是直接命中也是归属锚点）
  const ancestorIds = new Set(
    all.filter(t => t.title.toLowerCase().includes(lower)).map(t => t.id)
  );
  const chainHits: typeof all = [];
  if (ancestorIds.size > 0) {
    // 子孙 = 直接子级 + 孙级（两级足够覆盖「项目›阶段›任务」典型归属）
    const directChildren = all.filter(t => t.parentId && ancestorIds.has(t.parentId));
    const childIds = new Set(directChildren.map(t => t.id));
    const grandChildren = all.filter(t => t.parentId && childIds.has(t.parentId));
    for (const t of [...directChildren, ...grandChildren]) {
      if (!directIds.has(t.id)) chainHits.push(t);
    }
  }

  const merged = [...directHits, ...chainHits];
  const seen = new Set<string>();
  const uniqueTasks = [];
  for (const t of merged) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    uniqueTasks.push(t);
    if (uniqueTasks.length >= 20) break;
  }

  // 一次性取所有命中任务的最近排期（避免 N+1）
  const schedRows = await prisma.schedule.findMany({
    where: { userId: session.user.id, taskId: { in: uniqueTasks.map(t => t.id) } },
    select: { taskId: true, scheduledStart: true },
    orderBy: { scheduledStart: "desc" },
  });
  const schedMap = new Map<string, string>();
  for (const s of schedRows) {
    if (!schedMap.has(s.taskId)) schedMap.set(s.taskId, s.scheduledStart.toISOString());
  }

  const results = uniqueTasks.map(t => ({
    id: t.id,
    title: t.title,
    category: t.category,
    theme: t.theme,
    status: t.status,
    taskType: t.taskType,
    deadline: t.deadline?.toISOString() ?? null,
    tags: t.tags ?? null,
    parentTitle: t.parentId ? buildParentTitleSync(t.parentId, titleMap) : null,
    scheduledStart: schedMap.get(t.id) ?? null,
  }));

  return NextResponse.json({ results });
}
