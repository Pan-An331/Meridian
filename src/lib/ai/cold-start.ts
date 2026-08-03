// Phase 3: Cold Start — Baseline Memory Injection
// Injects system-default memories when user first registers,
// plus user-supplied onboarding answers.

import { prisma } from "@/lib/prisma";

/** System baseline memories — low confidence, easily overridden */
const BASELINE_MEMORIES = [
  {
    memoryType: "warning",
    content: "午后 14:00-15:00 是常见注意力低谷，不建议排高认知任务",
    source: "system_baseline",
    confidence: 0.2,
    dimension: "ability",
    contextTags: "afternoon,low_energy",
  },
  {
    memoryType: "warning",
    content: "连续工作超过 90 分钟效率会显著下降，建议每 90 分钟安排休息",
    source: "system_baseline",
    confidence: 0.2,
    dimension: "ability",
    contextTags: "long_session",
  },
  {
    memoryType: "warning",
    content: "大型任务直接开始容易卡住，建议先拆为 30-45 分钟的小块",
    source: "system_baseline",
    confidence: 0.2,
    dimension: "ability",
    contextTags: "big_task,chunking",
  },
  {
    memoryType: "preference",
    content: "周一通常是一周中精力最好的日子，适合安排重要任务",
    source: "system_baseline",
    confidence: 0.2,
    dimension: "ability",
    contextTags: "monday,peak",
  },
  {
    memoryType: "warning",
    content: "睡前 1 小时排屏幕任务会影响睡眠质量",
    source: "system_baseline",
    confidence: 0.2,
    dimension: "preference",
    contextTags: "night,screen",
  },
  {
    memoryType: "preference",
    content: "早上先完成最难的任务，一天会更有成就感",
    source: "system_baseline",
    confidence: 0.2,
    dimension: "preference",
    contextTags: "morning,hard_task",
  },
];

/** Call when user first registers */
export async function injectBaselineMemories(userId: string): Promise<number> {
  let count = 0;
  for (const m of BASELINE_MEMORIES) {
    const exists = await prisma.agentMemory.findFirst({
      where: { userId, content: m.content, source: "system_baseline" },
    });
    if (!exists) {
      await prisma.agentMemory.create({
        data: {
          userId,
          memoryType: m.memoryType,
          content: m.content,
          source: m.source,
          confidence: m.confidence,
          status: "active",
          dimension: m.dimension,
          contextTags: m.contextTags,
        },
      });
      count++;
    }
  }
  return count;
}

/** Call when user provides onboarding answers */
export async function createOnboardingMemories(
  userId: string,
  answers: { identity?: string; peakEnergy?: string; busyWith?: string }
): Promise<number> {
  let count = 0;

  if (answers.identity) {
    await prisma.agentMemory.create({
      data: {
        userId,
        memoryType: "preference",
        content: `用户身份：${answers.identity}`,
        source: "user_declaration",
        confidence: 0.5,
        status: "active",
        dimension: "preference",
      },
    });
    count++;
  }

  if (answers.peakEnergy) {
    await prisma.agentMemory.create({
      data: {
        userId,
        memoryType: "ability",
        content: `用户精力最好时段：${answers.peakEnergy}`,
        source: "user_declaration",
        confidence: 0.5,
        status: "active",
        dimension: "ability",
        contextTags: answers.peakEnergy === "morning" ? "morning,peak" : answers.peakEnergy === "afternoon" ? "afternoon,peak" : "evening,peak",
      },
    });
    count++;
  }

  if (answers.busyWith) {
    await prisma.agentMemory.create({
      data: {
        userId,
        memoryType: "preference",
        content: `用户近期在忙：${answers.busyWith}`,
        source: "user_declaration",
        confidence: 0.5,
        status: "active",
        dimension: "preference",
      },
    });
    count++;
  }

  return count;
}

/** User explicitly tells AI something — confidence = 1.0 */
export async function createUserDeclaration(
  userId: string,
  content: string,
  memoryType: string = "preference"
) {
  return prisma.agentMemory.create({
    data: {
      userId,
      memoryType,
      content,
      source: "user_declaration",
      confidence: 1.0,
      status: "active",
      dimension: memoryType === "hard_constraint" ? "preference" : "preference",
    },
  });
}
