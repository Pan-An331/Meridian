import { callAI } from "./client";
import { prisma } from "@/lib/prisma";
import { getCurrentState, buildStateConstraints } from "./user-state";
import { createDecisionLog } from "./decision-log";
import { replaceSchedule } from "@/lib/schedule/service";

const PLANNER_SYSTEM_PROMPT = `你是 Task OS 的时间规划引擎。
根据用户已有时间安排和个人偏好，为任务生成合理执行时间。
需要考虑：固定日程不可修改、deadline优先、importance优先、避免冲突、保留休息、按认知负荷安排、考虑用户状态。
任务数据中的额外字段请一并参考：
- complexity（low/medium/high）：高复杂度任务预留更充足的时间块
- dependencies（依赖描述）：有依赖的任务排在被依赖任务之后
- scheduleAdvice（AI 解析时给出的排程建议）：优先采纳其中合理的部分
输出 JSON：{"hasConflict":true,"suggestions":[{"taskId":"","date":"","startTime":"","endTime":"","reason":""}],"warnings":[]}
禁止输出解释文字。`;

export interface ScheduleSuggestion { taskId: string; date: string; startTime: string; endTime: string; reason: string; }
export interface PlannerResult { hasConflict: boolean; suggestions: ScheduleSuggestion[]; warnings: string[]; }

export async function generateSchedule(userId: string, taskIds: string[]): Promise<PlannerResult> {
  if (!taskIds || taskIds.length === 0) return { hasConflict: false, suggestions: [], warnings: ["需要指定任务ID"] };
  const now = new Date(); const weekLater = new Date(now); weekLater.setDate(weekLater.getDate() + 7);
  const requestedTasks = await prisma.task.findMany({ where: { userId, id: { in: taskIds }, status: { in: ["not_started", "delayed"] } }, include: { children: { where: { status: { in: ["not_started", "delayed"] } } } } });
  if (requestedTasks.length === 0) return { hasConflict: false, suggestions: [], warnings: [] };
  const parentIds: string[] = []; const parentInfo = new Map<string, { title: string; deadline: Date | null }>();
  for (const task of requestedTasks) { if (task.children && task.children.length > 0) { parentIds.push(task.id); parentInfo.set(task.id, { title: task.title, deadline: task.deadline }); } }
  const allTaskIds = new Set(taskIds);
  if (parentIds.length > 0) { const extraSubs = await prisma.task.findMany({ where: { userId, parentId: { in: parentIds }, status: { in: ["not_started", "delayed"] } }, select: { id: true } }); for (const sub of extraSubs) allTaskIds.add(sub.id); for (const pid of parentIds) allTaskIds.delete(pid); }
  const finalIds = Array.from(allTaskIds);
  const tasksToSchedule = await prisma.task.findMany({ where: { userId, id: { in: finalIds }, status: { in: ["not_started", "delayed"] } } });
  if (tasksToSchedule.length === 0) return { hasConflict: false, suggestions: [], warnings: [] };
  const subInfo = new Map<string, { parentTitle: string; parentDeadline: Date | null }>();
  for (const [pid, info] of parentInfo) { const children = requestedTasks.find(t => t.id === pid)?.children; if (children) for (const child of children) subInfo.set(child.id, { parentTitle: info.title, parentDeadline: info.deadline }); }
  const existingSchedule = await prisma.schedule.findMany({ where: { userId, scheduledStart: { gte: now, lte: weekLater } }, include: { task: { select: { title: true } } }, orderBy: { scheduledStart: "asc" } });
  const userSchedules = existingSchedule.filter(s => s.source === "user" || s.source === "manual");
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const userState = await getCurrentState(userId);
  const stateConstraints = buildStateConstraints(userState);
  const fixedSchedule = userSchedules.map(s => ({ title: s.task.title, start: s.scheduledStart.toISOString(), end: s.scheduledEnd?.toISOString(), type: "fixed" }));
  const existingArrangements = existingSchedule.map(s => ({ taskId: s.taskId, title: s.task.title, start: s.scheduledStart.toISOString(), end: s.scheduledEnd?.toISOString(), source: s.source }));
  const tasksToArrange = tasksToSchedule.map(t => { const sk = subInfo.get(t.id); return { id: t.id, title: sk ? `[子任务: ${sk.parentTitle}] ${t.title}` : t.title, importance: t.importance, estimatedMinutes: t.estimatedMinutes, deadline: t.deadline?.toISOString() || sk?.parentDeadline?.toISOString(), phaseOrder: t.phaseOrder, riskLevel: t.riskLevel, isSubTask: !!sk, complexity: t.complexity || null, theme: t.theme || null, dependencies: t.dependencies || null, scheduleAdvice: t.scheduleAdvice || null }; });
  let userPrefs = "无特殊偏好";
  if (profile) { const prefs: string[] = []; if (profile.wakeTime) prefs.push(`起床: ${profile.wakeTime}`); if (profile.sleepTime) prefs.push(`睡觉: ${profile.sleepTime}`); const em: Record<string,string> = { morning:"上午",afternoon:"下午",evening:"晚上" }; if (profile.peakEnergy) prefs.push(`精力最好: ${em[profile.peakEnergy]||profile.peakEnergy}`); if (profile.lowEnergy) prefs.push(`精力最差: ${em[profile.lowEnergy]||profile.lowEnergy}`); if (profile.preferences) prefs.push(`偏好: ${profile.preferences}`); if (prefs.length > 0) userPrefs = prefs.join("\n"); }
  // V3 D1 增强：主题分布注入（"用户当前主题：考研×2，竞赛×1"）
  let themeDist = "";
  try {
    const themed = tasksToSchedule.filter(t => t.theme);
    if (themed.length > 0) {
      const agg = new Map<string, number>();
      for (const t of themed) { const th = t.theme!; agg.set(th, (agg.get(th) || 0) + 1); }
      themeDist = "\n\n用户当前主题：" + [...agg.entries()].map(([th, n]) => `${th}×${n}`).join("，") + "（同主题任务建议分散安排，避免单日过载）";
    }
  } catch {}
  const userMessage = `当前时间：${now.toISOString()}\n\n用户当前状态：${userState.stateDescription}\n${stateConstraints}\n\n用户固定日程（不可修改）：\n${JSON.stringify(fixedSchedule, null, 2)}\n\n已有时间安排：\n${JSON.stringify(existingArrangements, null, 2)}\n\n需要安排的任务：\n${JSON.stringify(tasksToArrange, null, 2)}\n\n用户偏好：\n${userPrefs}${themeDist}`;
  try {
    const raw = await callAI(userId, PLANNER_SYSTEM_PROMPT, userMessage);
    let js = raw.trim(); const m = js.match(/```(?:json)?\s*([\s\S]*?)```/); if (m) js = m[1].trim();
    const result = JSON.parse(js) as PlannerResult;
    if (!result.suggestions) result.suggestions = []; if (!result.warnings) result.warnings = [];
    return result;
  } catch (e) { console.error("Planner error:", e); return { hasConflict: false, suggestions: [], warnings: ["规划生成失败"] }; }
}

export async function saveSchedule(userId: string, suggestions: ScheduleSuggestion[], source: string = "ai"): Promise<number> {
  let saved = 0;
  if (suggestions.length === 0) return 0;

  // 修复 P1-8：预取用户全部排期到内存判断（消除每条 2 次 findFirst 的 N+1）
  const [userSchedules, userSchedulesByTask] = await Promise.all([
    prisma.schedule.findMany({ where: { userId }, select: { taskId: true, source: true, scheduledStart: true, scheduledEnd: true } }),
    prisma.schedule.findMany({ where: { userId, taskId: { in: suggestions.map(s => s.taskId).filter(Boolean) }, source: { in: ["user", "manual"] } }, select: { taskId: true } }),
  ]);
  const userScheduledTaskIds = new Set(userSchedulesByTask.map(s => s.taskId));

  for (const item of suggestions) {
    if (!item.taskId || !item.startTime) continue;
    // 用户已有手动排期 → 尊重用户，跳过（内存判断）
    if (userScheduledTaskIds.has(item.taskId)) continue;
    const start = new Date(item.startTime);
    const end = item.endTime ? new Date(item.endTime) : new Date(start.getTime() + 3600000);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    // 冲突检测：与用户已有排期重叠（含全天事件）
    const conflict = userSchedules.some(s =>
      s.taskId !== item.taskId &&
      s.scheduledStart < end &&
      (s.scheduledEnd === null || s.scheduledEnd > start)
    );
    if (conflict) continue;

    await replaceSchedule(userId, item.taskId, start, end, source);
    saved++;
    createDecisionLog({ userId, action: "schedule_task", targetId: item.taskId,
      actionDetail: JSON.stringify({ start: item.startTime, end: item.endTime, source }),
      reasoning: item.reason || "AI规划", contextUsed: JSON.stringify({ source }),
    }).catch(() => {});
  }
  return saved;
}
