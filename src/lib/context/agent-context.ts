// Agent (Inbox AI) context — extends shared with conversation-specific data

import { buildSharedContext, type SharedContext } from "./shared-context";
import { prisma } from "@/lib/prisma";

export interface AgentContext extends SharedContext {
  recentTasks: string;
}

export async function buildAgentContext(userId: string): Promise<AgentContext> {
  const shared = await buildSharedContext(userId);

  const recentTasks = await prisma.task.findMany({
    where: { userId, status: { notIn: ["completed", "cancelled", "snoozed"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, title: true, status: true, taskType: true, deadline: true },
  });

  return {
    ...shared,
    recentTasks: recentTasks.map(t => `[${t.id.slice(0, 8)}] ${t.title} (${t.taskType}, ${t.status})`).join("\n"),
  };
}
