import { prisma } from "@/lib/prisma";

export interface FeedbackInput {
  userId: string;
  taskId?: string;
  agentAction: string;
  userResponse: "accepted" | "modified" | "rejected" | "ignored";
  modifiedField?: string;
  originalValue?: string;
  userValue?: string;
  context?: string;
  agentSuggestion?: string;
  userModification?: string;
}

/**
 * 统一创建 AgentFeedback 记录
 * 只有 AI 建议 → 用户行为 才记录
 * 纯手动操作不记录
 */
export async function createFeedback(input: FeedbackInput) {
  try {
    await prisma.agentFeedback.create({
      data: {
        userId: input.userId,
        taskId: input.taskId || null,
        agentAction: input.agentAction,
        userResponse: input.userResponse,
        agentSuggestion: input.agentSuggestion || "{}",
        userModification: input.userModification || null,
        modifiedField: input.modifiedField || null,
        originalValue: input.originalValue || null,
        userValue: input.userValue || null,
        context: input.context || null,
      },
    });
  } catch (_) {
    // 反馈记录失败不应影响主流程
  }
}

/**
 * 分析用户反馈规律，生成 Memory
 * 规则：连续3次以上相同模式 → 生成 Memory
 */
export async function analyzeFeedback(userId: string) {
  // 获取最近的反馈记录（按时间排序）
  const recent = await prisma.agentFeedback.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (recent.length < 3) return;

  // ─── 规则1：时间偏好（晚间→上午） ───
  const eveningToMorning = recent.filter(f =>
    f.modifiedField === "time" &&
    f.userResponse === "modified" &&
    f.originalValue && f.userValue
  );

  if (eveningToMorning.length >= 3) {
    // 检查是否连续3次：原时间在晚间(>=17:00)，修改后在上午(<12:00)
    const pattern = eveningToMorning.slice(0, 3).every(f => {
      const orig = parseInt(f.originalValue!.split(":")[0] || "0");
      const user = parseInt(f.userValue!.split(":")[0] || "0");
      return orig >= 17 && user < 12;
    });

    if (pattern) {
      const existing = await prisma.agentMemory.findFirst({
        where: { userId, memoryType: "preference", content: "用户偏好高认知任务安排在上午" },
      });
      if (!existing) {
        await prisma.agentMemory.create({
          data: {
            userId,
            memoryType: "preference",
            content: "用户偏好高认知任务安排在上午",
            confidence: 0.8,
            source: "feedback",
            importance: 3,
          },
        });
      }
    }
  }

  // ─── 规则2：时长偏差（同一类型任务连续修改预估时间） ───
  const durationChanges = recent.filter(f =>
    (f.modifiedField === "time" || f.modifiedField === "duration") &&
    f.userResponse === "modified" &&
    f.originalValue && f.userValue
  );

  if (durationChanges.length >= 3) {
    // 检查是否连续3次：用户修改后时间 > 原始时间
    const pattern = durationChanges.slice(0, 3).every(f => {
      const orig = parseInt(f.originalValue!) || 0;
      const user = parseInt(f.userValue!) || 0;
      return user > orig;
    });

    if (pattern) {
      const existing = await prisma.agentMemory.findFirst({
        where: { userId, memoryType: "behavior_pattern", content: "用户完成该类型任务通常需要更长时间" },
      });
      if (!existing) {
        await prisma.agentMemory.create({
          data: {
            userId,
            memoryType: "behavior_pattern",
            content: "用户完成该类型任务通常需要更长时间",
            confidence: 0.7,
            source: "feedback",
            importance: 3,
          },
        });
      }
    }
  }
}

/**
 * 记录用户接受AI安排的反馈
 * 在用户点击"开始执行"时调用
 */
export async function recordAcceptFeedback(userId: string, taskId: string, scheduleStart: string, scheduleEnd: string) {
  await createFeedback({
    userId,
    taskId,
    agentAction: "schedule_task",
    userResponse: "accepted",
    context: "today_plan",
    agentSuggestion: JSON.stringify({ start: scheduleStart, end: scheduleEnd }),
  });
  // 异步分析（不阻塞主流程）
  analyzeFeedback(userId).catch(() => {});
}

/**
 * 记录用户修改AI安排的反馈
 * 在用户拖动Schedule时间后调用
 */
export async function recordModifyFeedback(
  userId: string,
  taskId: string,
  originalStart: string,
  originalEnd: string | null,
  newStart: string,
  newEnd: string | null,
  context: string = "manual_adjust"
) {
  const origStr = `${originalStart.slice(11, 16)}-${originalEnd?.slice(11, 16) || "?"}`;
  const newStr = `${newStart.slice(11, 16)}-${newEnd?.slice(11, 16) || "?"}`;

  await createFeedback({
    userId,
    taskId,
    agentAction: "adjust_time",
    userResponse: "modified",
    modifiedField: "time",
    originalValue: origStr,
    userValue: newStr,
    context,
    userModification: JSON.stringify({ start: newStart, end: newEnd }),
    agentSuggestion: JSON.stringify({ start: originalStart, end: originalEnd }),
  });
  // 异步分析
  analyzeFeedback(userId).catch(() => {});
}

/**
 * 记录用户拒绝AI建议的反馈
 */
export async function recordRejectFeedback(userId: string, taskId: string, reason?: string) {
  await createFeedback({
    userId,
    taskId,
    agentAction: "schedule_task",
    userResponse: "rejected",
    context: reason ? "today_plan" : undefined,
    agentSuggestion: reason ? JSON.stringify({ reason }) : "{}",
  });
}
