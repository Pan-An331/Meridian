import { prisma } from "@/lib/prisma";
import { getOrCreateTodayDecision } from "./today-decision";
import { getCurrentState } from "./user-state";
import { getTaskDecisionReasons } from "./decision-log";

export interface DailyBriefResult {
  greeting: string;
  topTasks: { taskId: string; title: string; reason: string }[];
  stateDescription: string;
  suggestion: string;
}

/** 纯代码模板拼接，不调用AI */
export async function getMorningBrief(userId: string): Promise<DailyBriefResult> {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  const [decision, userState] = await Promise.all([
    getOrCreateTodayDecision(userId),
    getCurrentState(userId),
  ]);

  // topTasks: mustDo 前3个 + 从DecisionLog读原因
  const topTasks: { taskId: string; title: string; reason: string }[] = [];
  for (const t of decision.mustDo.slice(0, 3)) {
    const reasons = await getTaskDecisionReasons(userId, t.taskId);
    topTasks.push({
      taskId: t.taskId,
      title: t.title,
      reason: reasons.length > 0 ? reasons[0] : "优先级较高",
    });
  }

  // stateDescription
  const stateMap: Record<string, string> = {
    low: "较低", medium: "中等", high: "较高",
  };
  const energyStr = userState.energy ? (stateMap[userState.energy] || userState.energy) : "未知";
  const stressStr = userState.stress ? (stateMap[userState.stress] || userState.stress) : "未知";
  const stateDescription = userState.energy || userState.stress
    ? `精力：${energyStr}，压力：${stressStr}`
    : "暂无状态记录";

  // suggestion
  let suggestion = "优先完成今天前三项任务";
  if (userState.energy === "low") {
    suggestion = "今天精力较低，建议先完成重要且简单的任务";
  } else if (userState.stress === "high") {
    suggestion = "当前压力较高，优先处理临近截止任务";
  } else if (userState.energy === "high") {
    suggestion = "今天状态良好，可以集中处理高认知任务";
  }

  return { greeting, topTasks, stateDescription, suggestion };
}
