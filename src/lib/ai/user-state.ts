import { prisma } from "@/lib/prisma";

export interface UserStateView {
  energy: string | null;
  mood: string | null;
  stress: string | null;
  focusLevel: string | null;
  availableMinutes: number | null;
  stateDescription: string;
}

/**
 * 获取用户当前状态（每种类型取最新一条）
 */
export async function getCurrentState(userId: string): Promise<UserStateView> {
  const now = new Date();
  const allStates = await prisma.userState.findMany({
    where: {
      userId,
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    orderBy: { createdAt: "desc" },
  });

  const get = (type: string) => {
    const s = allStates.find(st => st.stateType === type);
    return s?.value || null;
  };

  const energy = get("energy");
  const mood = get("mood");
  const stress = get("stress");
  const focusLevel = get("focus");
  const availableStr = get("available");
  const availableMinutes = availableStr ? parseInt(availableStr, 10) ?? null : null;

  const parts: string[] = [];
  const energyMap: Record<string, string> = { low: "精力较低", medium: "精力正常", high: "精力充沛" };
  const moodMap: Record<string, string> = { negative: "情绪低落", neutral: "情绪平稳", positive: "情绪积极" };
  const stressMap: Record<string, string> = { low: "压力较低", medium: "压力适中", high: "压力较高" };

  if (energy) parts.push(energyMap[energy] || energy);
  if (mood) parts.push(moodMap[mood] || mood);
  if (stress) parts.push(stressMap[stress] || stress);
  if (availableMinutes) parts.push(`今日剩余约${availableMinutes}分钟`);

  return {
    energy,
    mood,
    stress,
    focusLevel,
    availableMinutes,
    stateDescription: parts.length > 0 ? parts.join("，") : "状态未知",
  };
}

/**
 * Planner 专用：生成状态约束说明
 */
export function buildStateConstraints(state: UserStateView): string {
  if (!state.energy && !state.stress && !state.availableMinutes) return "";

  const rules: string[] = [];

  if (state.energy === "low") {
    rules.push("- 精力不足，避免连续安排2个以上高认知负荷任务");
    rules.push("- 高强度任务之间需要更长的休息间隔（30分钟以上）");
  }
  if (state.energy === "high") {
    rules.push("- 精力充沛，可以安排高认知负荷任务集中处理");
  }

  if (state.stress === "high") {
    rules.push("- 压力较高，优先安排 deadline 最近的必须完成任务");
    rules.push("- 减少今日非必要任务的安排数量");
  }

  if (state.mood === "negative") {
    rules.push("- 情绪不佳，避免安排需要大量协作或创意的任务");
  }

  if (state.availableMinutes && state.availableMinutes < 120) {
    rules.push(`- 今日剩余时间不足2小时(${state.availableMinutes}分钟)，只安排最高优先级任务`);
  }

  return rules.length > 0 ? "用户状态提示：\n" + rules.join("\n") : "";
}

/** 基于工作模式的约束规则 */
export function buildWorkModeConstraints(state: UserStateView): { allow: string[]; avoid: string[] } {
  if (state.energy === "high" && state.focusLevel === "high") return { allow: ["高认知任务", "复杂学习", "深度设计"], avoid: ["低价值碎片任务", "频繁切换"] };
  if (state.energy === "low" && state.stress === "high") return { allow: ["整理", "阅读", "简单复习"], avoid: ["复杂设计任务", "高强度学习", "需要创造力的工作"] };
  if (state.energy === "low") return { allow: ["简单任务", "看课程", "整理资料"], avoid: ["高强度学习", "复杂问题"] };
  if (state.stress === "high") return { allow: ["临近deadline任务", "集中突破"], avoid: ["多任务并行", "新项目启动"] };
  return { allow: ["普通学习", "阅读", "整理"], avoid: [] };
}