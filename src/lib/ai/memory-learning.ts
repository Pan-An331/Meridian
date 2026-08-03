import { prisma } from "@/lib/prisma";

export async function analyzeDailyBehavior(userId: string) {
  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const feedbacks = await prisma.agentFeedback.findMany({ where: { userId, createdAt: { gte: fourteenDaysAgo } }, orderBy: { createdAt: "desc" } });
  if (feedbacks.length < 5) return;

  // Rule 1: time preference
  const timeMods = feedbacks.filter(f => f.modifiedField === "time" && f.userResponse === "modified" && f.originalValue && f.userValue);
  if (timeMods.length >= 5) {
    const toEvening = timeMods.slice(0, 5).every(f => { const o = parseInt(f.originalValue!.split(":")[0] || "0"); const u = parseInt(f.userValue!.split(":")[0] || "0"); return o < 12 && u >= 17; });
    const toMorning = timeMods.slice(0, 5).every(f => { const o = parseInt(f.originalValue!.split(":")[0] || "0"); const u = parseInt(f.userValue!.split(":")[0] || "0"); return o >= 17 && u < 12; });
    if (toEvening) await upsertMemory(userId, "preference", "User prefers evening tasks", 0.7);
    if (toMorning) await upsertMemory(userId, "preference", "User prefers morning tasks", 0.8);
  }

  // Rule 2: completion habit
  const tasksWithBoth = await prisma.task.findMany({ where: { userId, actualMinutes: { gt: 0 }, estimatedMinutes: { not: null }, completedAt: { gte: fourteenDaysAgo } }, orderBy: { completedAt: "desc" }, take: 20 });
  if (tasksWithBoth.length >= 5) {
    const over = tasksWithBoth.filter(t => t.estimatedMinutes && t.actualMinutes > t.estimatedMinutes * 1.5);
    if (over.length >= 5) await upsertMemory(userId, "behavior_pattern", "User tasks take 2x estimated time", 0.65);
  }

  // Rule 3: delay rate
  const delayed = await prisma.task.count({ where: { userId, status: "delayed", createdAt: { gte: fourteenDaysAgo } } });
  const completed = await prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: fourteenDaysAgo } } });
  if (delayed >= 3 && completed > 0 && delayed / completed > 0.3) {
    await upsertMemory(userId, "behavior_pattern", "High delay rate, reduce daily plans", 0.5);
  }

  // Rule 4: Execution time deviation (actual > planned * 1.5, 5+ times)
  const completedTasks = await prisma.task.findMany({
    where: { userId, status: "completed", completedAt: { gte: fourteenDaysAgo }, actualMinutes: { gt: 0 } },
    select: { actualMinutes: true, estimatedMinutes: true },
    take: 30,
  });
  if (completedTasks.length >= 5) {
    const overEstimates = completedTasks.filter(t => t.estimatedMinutes && t.actualMinutes > t.estimatedMinutes * 1.5);
    if (overEstimates.length >= 5) {
      await upsertMemory(userId, "behavior_pattern", "User often needs 2x estimated time for report-type tasks", 0.7);
    }
    const underEstimates = completedTasks.filter(t => t.estimatedMinutes && t.actualMinutes < t.estimatedMinutes * 0.5);
    if (underEstimates.length >= 5) {
      await upsertMemory(userId, "behavior_pattern", "User often completes tasks faster than estimated", 0.6);
    }
  }

  // Rule 5: Execution time preference (early/late)
  const timeLogs = await prisma.timeLog.findMany({ where: { userId, startedAt: { gte: fourteenDaysAgo }, type: "start" }, orderBy: { startedAt: "asc" }, take: 20 });
  if (timeLogs.length >= 5) {
    const morningStarts = timeLogs.filter(l => l.startedAt.getHours() < 12).length;
    const eveningStarts = timeLogs.filter(l => l.startedAt.getHours() >= 17).length;
    if (morningStarts >= 5 && morningStarts > eveningStarts * 2) {
      await upsertMemory(userId, "preference", "User prefers starting tasks in the morning", 0.55);
    }
    if (eveningStarts >= 5 && eveningStarts > morningStarts * 2) {
      await upsertMemory(userId, "preference", "User prefers starting tasks in the evening", 0.55);
    }
  }
}

async function upsertMemory(userId: string, memoryType: string, content: string, confidence: number) {
  const existing = await prisma.agentMemory.findFirst({ where: { userId, memoryType, content } });
  if (!existing) {
    await prisma.agentMemory.create({ data: { userId, memoryType, content, confidence, source: "feedback", importance: 3 } });
  } else if (existing.confidence < confidence) {
    await prisma.agentMemory.update({ where: { id: existing.id }, data: { confidence } });
  }
}
