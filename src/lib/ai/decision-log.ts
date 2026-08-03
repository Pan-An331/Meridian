import { prisma } from "@/lib/prisma";

export interface DecisionLogInput {
  userId: string;
  action: string;
  actionDetail?: string;
  targetId?: string;
  reasoning?: string;
  contextUsed?: string;
  userAccepted?: boolean; // 修复：用户是否接受该决策（trustScore 数据源）
}

/**
 * 创建决策日志
 * 记录AI的关键决策及其原因
 */
export async function createDecisionLog(input: DecisionLogInput) {
  try {
    return await prisma.decisionLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        actionDetail: input.actionDetail || "{}",
        targetId: input.targetId || null,
        reasoning: input.reasoning || null,
        reason: input.reasoning || null,
        contextUsed: input.contextUsed || null,
        userAccepted: input.userAccepted ?? null,
      },
    });
  } catch (_) {
    // 日志记录失败不影响主流程
    return null;
  }
}

/**
 * 获取任务相关的决策日志（用于Today页面展示AI推理原因）
 */
export async function getTaskDecisionReasons(userId: string, taskId: string): Promise<string[]> {
  try {
    const logs = await prisma.decisionLog.findMany({
      where: { userId, targetId: taskId },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    if (logs.length === 0) return [];

    const reasons: string[] = [];
    for (const log of logs) {
      if (log.reasoning) {
        // reasoning 可能是 JSON 数组的字符串
        try {
          const parsed = JSON.parse(log.reasoning);
          if (Array.isArray(parsed)) {
            reasons.push(...parsed);
          } else if (typeof parsed === "string") {
            reasons.push(parsed);
          } else if (parsed.reasons && Array.isArray(parsed.reasons)) {
            reasons.push(...parsed.reasons);
          }
        } catch {
          reasons.push(log.reasoning);
        }
      }
    }
    return [...new Set(reasons)].slice(0, 5);
  } catch {
    return [];
  }
}
