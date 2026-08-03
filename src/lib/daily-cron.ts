// Daily AI maintenance cron — 定时任务（闹钟模式）
// 每天 05:00 自动跑 runDailyAIPipeline（pattern-mining + 记忆衰减 + 画像更新）
// 修复：原来依赖"打开 Today 页面"触发（门铃模式），用户不开页面 AI 永远不学习

import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";
import { runDailyPipelineOnce } from "@/lib/ai/pipeline-runner";

const CRON_HOUR = 5; // 每天 05:00
const CHECK_INTERVAL = 5 * 60 * 1000; // 每 5 分钟检查一次是否到点

let timer: NodeJS.Timeout | null = null;
let lastRunDay: string | null = null; // 当天已处理过的内存标志（防止 5 分钟一轮的无谓遍历）

/** 启动每日 AI 维护任务（由 instrumentation.ts 在服务器启动时调用一次） */
export function startDailyCron() {
  if (timer) return;
  console.log("[daily-cron] started — daily AI pipeline scheduled at 05:00");
  timer = setInterval(runIfDue, CHECK_INTERVAL);
  // 启动时立即检查：若今天已过 05:00 且还没跑过，马上补跑
  runIfDue();
}

async function runIfDue() {
  try {
    const now = new Date();
    const todayKey = localDateStr(now);
    if (lastRunDay === todayKey) return; // 今天已处理过
    if (now.getHours() < CRON_HOUR) return; // 还没到点

    // 遍历所有用户：补基线记忆 + 跑 pipeline + 清理过期决策日志 + 解冻过期暂缓任务
    const users = await prisma.user.findMany({ select: { id: true } });
    let ran = 0;
    for (const u of users) {
      await ensureBaselineMemories(u.id);
      await unfreezeSnoozedTasks(u.id); // 修复 P1-11：过期暂缓任务自动解冻
      const triggered = await runDailyPipelineOnce(u.id);
      if (triggered) ran++;
    }
    await cleanupDecisionLogs();
    if (ran > 0) console.log(`[daily-cron] triggered pipeline for ${ran} user(s)`);
    lastRunDay = todayKey;
  } catch (e) {
    console.error("[daily-cron] check failed:", e);
  }
}

/** 修复 P1-11：snoozeUntil 已过期的暂缓任务自动解冻为 not_started（否则永远"消失"） */
async function unfreezeSnoozedTasks(userId: string): Promise<void> {
  try {
    const now = new Date();
    const result = await prisma.task.updateMany({
      where: { userId, status: "snoozed", snoozeUntil: { lt: now } },
      data: { status: "not_started", snoozeUntil: null },
    });
    if (result.count > 0) console.log(`[daily-cron] unfroze ${result.count} snoozed task(s) for user ${userId.slice(0, 8)}`);
  } catch (e) {
    console.error("[daily-cron] unfreeze failed:", e);
  }
}

/** 修复：存量用户（注册早于冷启动代码）从未获得基线记忆 → 幂等补注入 */
async function ensureBaselineMemories(userId: string): Promise<void> {
  try {
    const count = await prisma.agentMemory.count({ where: { userId } });
    if (count > 0) return; // 已有记忆，跳过
    const { injectBaselineMemories } = await import("@/lib/ai/cold-start");
    await injectBaselineMemories(userId);
    console.log(`[daily-cron] injected baseline memories for user ${userId.slice(0, 8)}`);
  } catch (e) {
    console.error("[daily-cron] baseline injection failed:", e);
  }
}

/** 决策日志滚动清理：保留 90 天（SQLite 单库无限增长隐患） */
async function cleanupDecisionLogs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const result = await prisma.decisionLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
    if (result.count > 0) console.log(`[daily-cron] cleaned ${result.count} old decision logs`);
  } catch (e) {
    console.error("[daily-cron] decision log cleanup failed:", e);
  }
}
