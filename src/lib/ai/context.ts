import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";

export interface AgentContext {
  profile: string;
  states: string;
  memories: string;
  behaviorStats: string;
  todayData: string;
  recentTasks: string;
  userModel: string; // 修复：机器学习画像注入 LLM 上下文
  themeDistribution: string; // V3 D1：主题分布（"用户当前主题：考研×N"）
}

export async function buildAgentContext(userId: string): Promise<AgentContext> {
  const [profile, states, memories, behaviorStats, todayData, recentTasks, userModel, themeDistribution] = await Promise.all([
    buildProfileContext(userId),
    buildStateContext(userId),
    buildMemoryContext(userId),
    buildBehaviorStats(userId),
    buildTodayContext(userId),
    buildRecentTasksContext(userId),
    buildUserModelContext(userId),
    buildThemeDistribution(userId),
  ]);
  return { profile, states, memories, behaviorStats, todayData, recentTasks, userModel, themeDistribution };
}

/** V3 D1：主题分布（按活跃任务数聚合，注入 LLM 上下文） */
async function buildThemeDistribution(userId: string): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { notIn: ["completed", "cancelled", "snoozed"] }, theme: { not: null } },
    select: { theme: true },
  });
  const agg = new Map<string, number>();
  for (const t of tasks) {
    if (!t.theme) continue;
    agg.set(t.theme, (agg.get(t.theme) || 0) + 1);
  }
  if (agg.size === 0) return "";
  const parts = [...agg.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([theme, count]) => `${theme}×${count}`);
  return "用户当前主题：" + parts.join("，");
}

async function buildRecentTasksContext(userId: string): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { notIn: ["completed", "cancelled", "snoozed"] } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, title: true, status: true, taskType: true, deadline: true, createdAt: true },
  });

  if (tasks.length === 0) return "";

  const lines: string[] = ["## 近期任务", ""];
  for (const t of tasks) {
    const parts: string[] = [];

    parts.push(t.title);
    parts.push(`type=${t.taskType}`);
    parts.push(`status=${t.status}`);
    if (t.deadline) parts.push(`deadline=${localDateStr(t.deadline)}`);
    else parts.push("no_deadline");
    lines.push(parts.join(" "));
  }
  return lines.join("\n");
}

async function buildProfileContext(userId: string): Promise<string> {
  const p = await prisma.userProfile.findUnique({ where: { userId } });
  if (!p) return "";
  const parts: string[] = [];
  if (p.identity) parts.push("身份：" + p.identity);
  if (p.wakeTime || p.sleepTime) parts.push("作息：" + (p.wakeTime || "?") + "起床，" + (p.sleepTime || "?") + "睡觉");
  if (p.availableSlots) { try { const slots = JSON.parse(p.availableSlots); parts.push("可用时间：" + slots.map((s: any) => s.start + "-" + s.end).join(", ")); } catch {} }
  if (p.fixedBlocks) {
    try { const blocks = JSON.parse(p.fixedBlocks); parts.push("固定不可用: " + blocks.map((b: any) => (b.label || "固定") + " " + b.start + "-" + b.end).join("; ")); } catch {}
  }
  if (p.peakEnergy) parts.push("精力最好：" + (p.peakEnergy === "morning" ? "上午" : p.peakEnergy === "afternoon" ? "下午" : "晚上"));
  if (p.lowEnergy) parts.push("精力最差：" + (p.lowEnergy === "morning" ? "上午" : p.lowEnergy === "afternoon" ? "下午" : "晚上"));
  if (p.preferences) parts.push("工作偏好：" + p.preferences);
  if (p.longTermGoals) parts.push("长期目标：" + p.longTermGoals);
  if (p.notes) parts.push("备注：" + p.notes);
  return parts.length > 0 ? parts.join("\n") : "";
}

async function buildStateContext(userId: string): Promise<string> {
  const now = new Date();
  const states = await prisma.userState.findMany({ where: { userId, OR: [{ validUntil: null }, { validUntil: { gte: now } }] }, orderBy: { createdAt: "desc" }, take: 10 });
  if (states.length === 0) return "";
  return states.map(s => { const weight = s.confidence * s.decisionWeight; return "[" + s.stateType + "] " + s.value + " (" + s.source + "来源, 可信度" + s.confidence + ", 决策权重" + s.decisionWeight + ", 综合" + weight.toFixed(2) + ")" + (s.impactHint ? " -> " + s.impactHint : ""); }).join("\n");
}

async function buildMemoryContext(userId: string): Promise<string> {
  const now = new Date();
  const memories = await prisma.agentMemory.findMany({ where: { userId, status: "active", OR: [{ validUntil: null }, { validUntil: { gte: now } }] }, orderBy: [{ importance: "desc" }, { createdAt: "desc" }], take: 10 });
  if (memories.length === 0) return "";
  return memories.map(m => "[" + m.memoryType + "] " + m.content + " (" + m.source + ", confidence " + m.confidence + ", scope: " + (m.scope || "global") + ")").join("\n");
}

async function buildBehaviorStats(userId: string): Promise<string> {
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [completed, delayed, totalTasks] = await Promise.all([
    prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: sevenDaysAgo } } }),
    prisma.task.count({ where: { userId, status: "delayed" } }),
    prisma.task.count({ where: { userId, status: { notIn: ["completed", "cancelled"] } } }),
  ]);
  const tasksWithTime = await prisma.task.findMany({ where: { userId, actualMinutes: { gt: 0 }, estimatedMinutes: { not: null } }, select: { actualMinutes: true, estimatedMinutes: true }, take: 50 });
  let ratio = 1.0;
  if (tasksWithTime.length > 0) { ratio = tasksWithTime.reduce((sum, t) => sum + (t.actualMinutes / (t.estimatedMinutes || 1)), 0) / tasksWithTime.length; }
  const totalMins = await prisma.task.aggregate({ where: { userId, status: "completed", completedAt: { gte: sevenDaysAgo } }, _sum: { actualMinutes: true } });
  const dailyAvg = Math.round((totalMins._sum.actualMinutes || 0) / 7);
  return "周完成" + completed + "个，延期" + delayed + "个，未完成" + totalTasks + "个。实际约预估" + ratio.toFixed(1) + "倍。日均" + dailyAvg + "分钟。";
}

async function buildTodayContext(userId: string): Promise<string> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const [schedule, inProgress] = await Promise.all([
    prisma.schedule.findMany({ where: { userId, scheduledStart: { gte: today, lt: tomorrow } }, include: { task: { select: { title: true, importance: true, purpose: true } } }, orderBy: { scheduledStart: "asc" } }),
    prisma.task.findFirst({ where: { userId, status: "in_progress" } }),
  ]);
  const parts: string[] = [];
  // FCV2 D1：注入动机（purpose）——AI 建议更贴合"为什么做"
  if (inProgress) parts.push("正在进行：" + inProgress.title + (inProgress.purpose ? "（动机：" + inProgress.purpose + "）" : ""));
  if (schedule.length > 0) {
    parts.push("今日日程(" + schedule.length + "项)：");
    schedule.forEach(s => {
      const start = s.scheduledStart.toTimeString().slice(0, 5);
      const end = s.scheduledEnd ? s.scheduledEnd.toTimeString().slice(0, 5) : "?";
      parts.push("  " + start + "-" + end + " " + s.task.title + " (重要度" + s.task.importance + (s.task.purpose ? ", 动机：" + s.task.purpose + ")" : ")"));
    });
  }
  return parts.join("\n");
}

/** 机器学习画像（UserModel）→ LLM 上下文（修复：原实现画像不进 prompt） */
async function buildUserModelContext(userId: string): Promise<string> {
  const um = await prisma.userModel.findUnique({ where: { userId } });
  if (!um) return "";
  const parts: string[] = ["## 机器学习画像（行为数据总结）"];
  if (um.peakHours && um.peakHours !== "[]") {
    try { const ph = JSON.parse(um.peakHours); if (Array.isArray(ph) && ph.length > 0) parts.push("高效时段：" + ph.map(String).join("时、") + "时"); } catch {}
  }
  if (um.dailyCapacity > 0) parts.push("日均完成容量：约 " + um.dailyCapacity + " 小时");
  if (um.taskChunk) parts.push("任务分块偏好：" + um.taskChunk);
  if (um.commonFailures && um.commonFailures !== "[]") {
    try { const cf = JSON.parse(um.commonFailures); if (Array.isArray(cf) && cf.length > 0) parts.push("常见卡点：" + cf.join("；")); } catch {}
  }
  parts.push("AI 建议信任分：" + Math.round(um.trustScore * 100) + "/100");
  return parts.length > 1 ? parts.join("\n") : "";
}
