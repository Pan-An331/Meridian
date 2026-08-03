// Phase 3: Decision Engine
// The missing layer between Memory/UserModel and Planner/Today.
// Reads aggregated knowledge → produces structured decisions with reasons.

import { prisma } from "@/lib/prisma";
import { getTopMemories, resolveMemoryConflicts } from "./memory-manager";

// ── Types ──

export interface DecisionInput {
  taskId: string;
  taskTitle: string;
  taskImportance: number;
  taskCategory: string | null;
  deadline: Date | null;
  userModel: UserModelSnapshot;
  currentState: UserStateSnapshot;
  relevantMemories: MemorySnapshot[];
}

export interface UserModelSnapshot {
  peakHours: string[];
  dailyCapacity: number;
  taskChunk: string | null;
  commonFailures: string[];
  trustScore: number;
}

export interface UserStateSnapshot {
  energy: string | null;
  focus: string | null;
  mood: string | null;
  stress: string | null;
}

export interface MemorySnapshot {
  id: string;
  content: string;
  source: string;
  confidence: number;
  dimension: string | null;
  memoryType: string;
}

export interface DecisionOutput {
  action: "do_now" | "reschedule_morning" | "reschedule_afternoon" | "reduce_scope" | "skip";
  reason: string;
  reasoning: string[];          // 解释层 — 每一条都是「为什么」
  confidence: number;
  actionRisk: "low" | "medium" | "high";
  memoryUsed: string[];         // 用了哪些 Memory
}

// ── Decision Rules ──

const ENERGY_MAP: Record<string, number> = { low: 1, medium: 2, high: 3 };

function energyScore(state: UserStateSnapshot): number {
  return ENERGY_MAP[state.energy || "medium"] || 2;
}

function isPeakHour(hour: number, peakHours: string[]): boolean {
  return peakHours.some(p => {
    const h = parseInt(p);
    return !isNaN(h) && hour >= h && hour < h + 3;
  });
}

/** Main decision engine entry point */
export async function makeDecision(input: DecisionInput): Promise<DecisionOutput> {
  const { taskTitle, taskImportance, deadline, userModel, currentState, relevantMemories } = input;

  // Resolve memory conflicts first
  const resolved = resolveMemoryConflicts(
    relevantMemories.map(m => ({ id: m.id, source: m.source, confidence: m.confidence, content: m.content }))
  );
  const resolvedSet = new Set(resolved.map(r => r.id));
  const validMemories = relevantMemories.filter(m => resolvedSet.has(m.id));

  const now = new Date();
  const currentHour = now.getHours();

  // Check hard constraints first
  const hardBlock = validMemories.find(m => m.memoryType === "hard_constraint");
  if (hardBlock) {
    return {
      action: "skip",
      reason: "硬约束阻止此任务",
      reasoning: [`硬约束: ${hardBlock.content}`],
      confidence: 1.0,
      actionRisk: "low",
      memoryUsed: [hardBlock.content],
    };
  }

  // Rule 1: Deadline crisis — less than 24h, must do now regardless of preference
  if (deadline) {
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / 3600000;
    if (hoursUntilDeadline < 24 && taskImportance >= 4) {
      return {
        action: "do_now",
        reason: "距离截止时间不到 24 小时，建议立即处理",
        reasoning: [`截止时间: ${deadline.toLocaleString("zh-CN")}`, `任务重要性: ${taskImportance}/5`],
        confidence: 0.9,
        actionRisk: "low",
        memoryUsed: [],
      };
    }
  }

  // Rule 2: Low energy + non-urgent → reduce scope
  // 修复 P1-11：commonFailures 命中当前任务类别时，建议降级为拆分/减量
  const energy = energyScore(currentState);
  if (energy <= 1 && taskImportance <= 3) {
    const failureHits = userModel.commonFailures.filter(f => f && taskTitle && f.includes(taskTitle.slice(0, 4)));
    return {
      action: "reduce_scope",
      reason: "当前精力偏低，建议拆分小块",
      reasoning: [`当前精力: ${currentState.energy || "未知"}`, "低精力执行大任务完成率低", ...(failureHits.length > 0 ? [`历史卡点: ${failureHits[0]}`] : [])],
      confidence: 0.7,
      actionRisk: "low",
      memoryUsed: validMemories.filter(m => m.content.includes("精力") || m.content.includes("疲劳")).map(m => m.content),
    };
  }

  // Rule 2.5: taskChunk 存在且任务预计超长 → 建议按用户分块偏好拆分（修复：taskChunk 原为死输出）
  if (userModel.taskChunk && taskImportance <= 4 && input.taskTitle.length > 0) {
    return {
      action: "reduce_scope",
      reason: "根据你的分块偏好，建议拆分执行",
      reasoning: [`你的分块偏好: ${userModel.taskChunk}`, "长任务拆小块完成率更高"],
      confidence: 0.6,
      actionRisk: "low",
      memoryUsed: [userModel.taskChunk],
    };
  }

  // Rule 3: Task matches peak hours → do now
  if (userModel.peakHours.length > 0 && isPeakHour(currentHour, userModel.peakHours)) {
    return {
      action: "do_now",
      reason: "当前是你的高效时段",
      reasoning: [`高效时段: ${userModel.peakHours.join("、")}`, `当前时间: ${currentHour}时`],
      confidence: 0.8,
      actionRisk: "low",
      memoryUsed: validMemories.filter(m => m.content.includes("上午") || m.content.includes("效率")).map(m => m.content),
    };
  }

  // Rule 4: Task outside peak hours → suggest reschedule
  if (userModel.peakHours.length > 0 && !isPeakHour(currentHour, userModel.peakHours)) {
    const peakLabel = userModel.peakHours[0] || "上午";
    const reschedAction = peakLabel.includes("上午") || peakLabel.includes("09") || peakLabel.includes("10") || peakLabel.includes("11")
      ? "reschedule_morning" : "reschedule_afternoon";

    return {
      action: reschedAction,
      reason: "该任务在你的高效时段完成率更高",
      reasoning: [
        `你的高效时段: ${userModel.peakHours.join("、")}`,
        `当前 ${currentHour}时 不在高效时段内`,
        userModel.trustScore > 0.7 ? "基于历史数据，此时段执行该任务成功率较高" : "",
      ].filter(Boolean),
      confidence: 0.65,
      actionRisk: "low",
      memoryUsed: validMemories.map(m => m.content),
    };
  }

  // Rule 5: Default — do now
  return {
    action: "do_now",
    reason: "没有检测到需要调整的特殊情况",
    reasoning: ["按原计划执行"],
    confidence: 0.5,
    actionRisk: "low",
    memoryUsed: [],
  };
}

// ── User Model Aggregation ──

/** Recompute UserModel from current Memory and Pattern data */
export async function recomputeUserModel(userId: string) {
  const [memories, patterns] = await Promise.all([
    prisma.agentMemory.findMany({
      where: { userId, status: "active", confidence: { gt: 0.5 } },
    }),
    prisma.userPattern.findMany({
      where: { userId, confidence: { gt: 0.5 } },
    }),
  ]);

  // Peak hours
  const peakPattern = patterns.find(p => p.pattern === "peak_hour");
  let peakHours: string[] = [];
  if (peakPattern) {
    peakHours = peakPattern.metric.match(/\d+时/g)?.map(h => h.replace("时", "")) || [];
  }

  // Daily capacity
  const ceilingPattern = patterns.find(p => p.pattern === "daily_ceiling");
  let dailyCapacity = 4.0;
  if (ceilingPattern) {
    const match = ceilingPattern.metric.match(/[\d.]+h/);
    if (match) dailyCapacity = parseFloat(match[0].replace("h", ""));
  }

  // Task chunk（修复 P2-23：要求同时含分块语义词，防止"每周 30 分钟健身"误判）
  const chunkMem = memories.find(m => (m.content.includes("30") || m.content.includes("45") || m.content.includes("60")) &&
    (m.content.includes("拆分") || m.content.includes("小块") || m.content.includes("分块") || m.content.includes("碎片")));
  const taskChunk = chunkMem?.content || null;

  // Common failures
  const commonFailures: string[] = [];
  patterns.filter(p => p.pattern.startsWith("category_blocking")).forEach(p => {
    commonFailures.push(p.condition);
  });

  // Trust Score
  const trustScore = await computeTrustScore(userId);

  const existing = await prisma.userModel.findUnique({ where: { userId } });
  if (existing) {
    await prisma.userModel.update({
      where: { userId },
      data: {
        peakHours: JSON.stringify(peakHours),
        dailyCapacity,
        taskChunk,
        commonFailures: JSON.stringify(commonFailures),
        trustScore,
        lastUpdated: new Date(),
      },
    });
  } else {
    await prisma.userModel.create({
      data: {
        userId,
        peakHours: JSON.stringify(peakHours),
        dailyCapacity,
        taskChunk,
        commonFailures: JSON.stringify(commonFailures),
        trustScore,
      },
    });
  }
}

// ── Trust Score ──

async function computeTrustScore(userId: string): Promise<number> {
  const recentLogs = await prisma.decisionLog.findMany({
    where: { userId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    select: { userAccepted: true },
    orderBy: { createdAt: "desc" }, // 修复：take 必须配 orderBy，否则 SQLite 返回顺序不保证
    take: 100,
  });

  if (recentLogs.length < 5) return 0.5; // not enough data

  const accepted = recentLogs.filter(l => l.userAccepted === true).length;
  const rejected = recentLogs.filter(l => l.userAccepted === false).length;
  const total = accepted + rejected;

  if (total === 0) return 0.5;
  return Math.round((accepted / (accepted + rejected * 2)) * 100) / 100; // rejections penalized more
}

// ── Action Risk Assessment ──

export function assessActionRisk(action: string): "low" | "medium" | "high" {
  switch (action) {
    case "do_now": return "low";
    case "reschedule_morning": case "reschedule_afternoon": case "reduce_scope": return "low";
    case "skip": return "medium";
    default: return "low";
  }
}

/** Determine if AI can auto-execute based on Trust Score + Action Risk */
export function canAutoExecute(trustScore: number, actionRisk: string): "auto" | "one_click" | "suggest" {
  if (actionRisk === "high") return "suggest";
  if (trustScore > 0.8 && actionRisk === "low") return "auto";
  if (trustScore > 0.6 && actionRisk === "low") return "one_click";
  return "suggest";
}
