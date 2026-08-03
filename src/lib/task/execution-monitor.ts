import { prisma } from "@/lib/prisma";

export interface ExecutionAlert {
  type: "overtime" | "consecutive_delay";
  taskId: string; title: string; message: string;
}

export async function checkOvertime(taskId: string): Promise<ExecutionAlert | null> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, title: true, estimatedMinutes: true, actualMinutes: true } });
  if (!task || !task.estimatedMinutes || !task.actualMinutes) return null;
  if (task.actualMinutes >= task.estimatedMinutes * 1.5) {
    return { type: "overtime", taskId: task.id, title: task.title, message: "这个任务已经达到预计上限，比预期耗时更久" };
  }
  return null;
}

export async function checkConsecutiveDelay(userId: string, taskId: string): Promise<ExecutionAlert | null> {
  const recent = await prisma.taskExecutionFeedback.findMany({ where: { userId, taskId }, orderBy: { createdAt: "desc" }, take: 3 });
  if (recent.length >= 3 && recent.every(f => f.reason === "delayed" || f.reason === "user_reschedule")) {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } }); // 调用方均已校验归属
    return { type: "consecutive_delay", taskId, title: task?.title || taskId, message: "这个任务已经连续3次延期，可能需要重新拆分或调整计划" };
  }
  return null;
}
