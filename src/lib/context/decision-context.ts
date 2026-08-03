// Decision AI context — extends shared with analysis-specific data

import { buildSharedContext, type SharedContext } from "./shared-context";
import { localDateStr } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export interface DecisionContext extends SharedContext {
  behaviorStats: string;
  executionFeedback: string;
  decisionHistory: string;
}

export async function buildDecisionContext(userId: string): Promise<DecisionContext> {
  const shared = await buildSharedContext(userId);
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [completed, delayed, feedbacks, decisionLogs] = await Promise.all([
    prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: sevenDaysAgo } } }),
    prisma.task.count({ where: { userId, status: "delayed" } }),
    prisma.taskExecutionFeedback.findMany({ where: { userId, createdAt: { gte: sevenDaysAgo } }, take: 10, orderBy: { createdAt: "desc" } }),
    prisma.decisionLog.findMany({ where: { userId, createdAt: { gte: sevenDaysAgo } }, take: 10, orderBy: { createdAt: "desc" } }),
  ]);

  return {
    ...shared,
    behaviorStats: `Week: completed=${completed}, delayed=${delayed}`,
    executionFeedback: feedbacks.map(f => `[${localDateStr(f.createdAt)}] ${f.reason}`).join("; ") || "none",
    decisionHistory: decisionLogs.map(d => `[${d.action}] ${d.reasoning?.slice(0, 50) || ""}`).join("; ") || "none",
  };
}
