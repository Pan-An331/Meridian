// Daily AI pipeline 统一触发入口（带 in-flight 锁 + lastUpdated 检查）
// 修复：原实现"先写 lastUpdated 标记再跑"——pipeline 失败后当天不再重跑（假成功）。
// 现在：由 pipeline 成功路径（recomputeUserModel）自然更新 lastUpdated；失败不标记，下次重试。

import { prisma } from "@/lib/prisma";

const inFlight = new Map<string, Promise<void>>();

/**
 * 触发一次每日 AI 维护（若今天已跑过则跳过）。
 * 并发安全：同一用户同时触发时只跑一次。
 * @returns true = 本次实际触发了 pipeline；false = 今天已跑过或无需跑
 */
export async function runDailyPipelineOnce(userId: string): Promise<boolean> {
  // 1. 今天是否已跑（成功路径由 recomputeUserModel 更新 lastUpdated）
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const um = await prisma.userModel.findUnique({ where: { userId }, select: { lastUpdated: true } });
  if (um && new Date(um.lastUpdated) >= todayStart) return false;

  // 2. in-flight 锁：同一用户并发触发只跑一次
  const existing = inFlight.get(userId);
  if (existing) {
    await existing;
    return true;
  }

  const task = (async () => {
    const { runDailyAIPipeline } = await import("@/lib/ai/advanced");
    await runDailyAIPipeline(userId);
  })();
  inFlight.set(userId, task);
  try {
    await task;
  } finally {
    inFlight.delete(userId);
  }
  return true;
}
