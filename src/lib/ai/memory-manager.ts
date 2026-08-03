// Phase 3: Memory Manager
// Importance scoring, lifecycle decay, conflict resolution, blocked status.

import { prisma } from "@/lib/prisma";

// ── Importance Scoring ──

/**
 * Compute importanceScore = confidence × usageFrequency × recency × impact
 * Higher → more likely to be selected for decision consumption.
 */
export async function computeImportanceScore(memoryId: string): Promise<number> {
  const mem = await prisma.agentMemory.findUnique({ where: { id: memoryId } });
  if (!mem) return 0;

  const confidence = mem.confidence || 0.5;
  const evidenceCount = mem.evidenceCount || 1;

  // usageFrequency: times used / days since creation
  const daysSinceCreation = Math.max(1, Math.round((Date.now() - mem.createdAt.getTime()) / 86400000));
  const usageFrequency = Math.min(1, (mem.lastUsedAt ? 1 : 0.1) / Math.max(1, Math.log(daysSinceCreation + 1)));

  // recency: 1.0 if used within 7 days, decays linearly
  let recency = 0.3;
  if (mem.lastUsedAt) {
    const daysSinceUsed = Math.max(0, Math.round((Date.now() - mem.lastUsedAt.getTime()) / 86400000));
    recency = Math.max(0.1, 1 - daysSinceUsed / 30);
  }

  // impact: evidenceCount contributes to impact
  const impact = Math.min(1, evidenceCount / 10);

  const score = confidence * 0.4 + usageFrequency * 0.25 + recency * 0.2 + impact * 0.15;
  const rounded = Math.round(score * 100) / 100;

  await prisma.agentMemory.update({
    where: { id: memoryId },
    data: { importanceScore: rounded },
  });

  return rounded;
}

/** Get top N active memories for decision consumption */
export async function getTopMemories(userId: string, n: number = 5) {
  return prisma.agentMemory.findMany({
    where: { userId, status: "active" },
    orderBy: { importanceScore: "desc" },
    take: n,
  });
}

// ── Lifecycle Management ──

/**
 * Run daily — applies confidence decay and status transitions.
 */
export async function runMemoryLifecycle(userId: string) {
  const all = await prisma.agentMemory.findMany({
    where: { userId, status: { not: "retired" } },
  });

  const now = new Date();
  for (const mem of all) {
    // Hard constraints never decay
    if (mem.memoryType === "hard_constraint") continue;

    // Blocked memories: don't touch
    if (mem.status === "blocked") continue;

    const daysSinceUse = mem.lastUsedAt
      ? Math.round((now.getTime() - mem.lastUsedAt.getTime()) / 86400000)
      : Math.round((now.getTime() - mem.createdAt.getTime()) / 86400000);

    let newStatus = mem.status;
    let newConfidence = mem.confidence;

    if (daysSinceUse >= 90) {
      newStatus = "retired";
    } else if (daysSinceUse >= 60) {
      newStatus = "dormant";
    } else if (daysSinceUse >= 30 && mem.status === "active") {
      newConfidence = Math.round(mem.confidence * 0.8 * 100) / 100;
    }

    if (newStatus !== mem.status || newConfidence !== mem.confidence) {
      await prisma.agentMemory.update({
        where: { id: mem.id },
        data: {
          status: newStatus,
          confidence: newConfidence,
        },
      });
    }
  }
}

// ── Conflict Resolution ──

/** Priority chain. Higher = more authoritative. */
const SOURCE_PRIORITY: Record<string, number> = {
  hard_constraint: 100,
  user_declaration: 90,
  user: 85, // 修复 P1-17：Review「应用建议」等用户主动写入的记忆优先级高于 AI 分析
  user_correction: 80,
  feedback: 50,
  pattern_mining: 60,
  ai_analysis: 40,
  ai: 40,
  system_baseline: 10,
};

/**
 * Resolve conflicts among a set of memories.
 * Returns the winning memory per conflict group.
 */
export function resolveMemoryConflicts(memories: Array<{ id: string; source: string; confidence: number; content: string }>): typeof memories {
  // Group by contradictory content (simple keyword overlap)
  const resolved: typeof memories = [];
  const used = new Set<string>();

  for (const m of memories) {
    if (used.has(m.id)) continue;

    // Find all conflicting memories (same category words but opposite meaning)
    const conflicts = memories.filter(other => other.id !== m.id && !used.has(other.id) && hasConflict(m.content, other.content));

    if (conflicts.length === 0) {
      resolved.push(m);
      used.add(m.id);
    } else {
      // Apply priority chain
      const all = [m, ...conflicts];
      all.sort((a, b) => {
        const pa = SOURCE_PRIORITY[a.source] || 0;
        const pb = SOURCE_PRIORITY[b.source] || 0;
        if (pa !== pb) return pb - pa; // higher priority wins
        return b.confidence - a.confidence; // same priority: higher confidence wins
      });
      resolved.push(all[0]);
      all.forEach(c => used.add(c.id));
    }
  }

  return resolved;
}

/** Simple heuristic: detect if two memories conflict */
function hasConflict(a: string, b: string): boolean {
  const keywords = ["上午", "下午", "晚上", "早起", "晚睡", "多", "少", "高", "低"];
  let overlap = 0;
  for (const kw of keywords) {
    if (a.includes(kw) && b.includes(kw)) overlap++;
  }
  // Only consider conflict if they share keywords but one is negative
  const opposing = (a.includes("不要") || a.includes("不适合")) !== (b.includes("不要") || b.includes("不适合"));
  return overlap >= 2 && opposing;
}

// ── Blocked Status ──

/** User blocks a memory — soft delete, data preserved */
export async function blockMemory(memoryId: string) {
  return prisma.agentMemory.update({
    where: { id: memoryId },
    data: { status: "blocked" },
  });
}

/** Check if any blocked memory has new supporting evidence — return list to show user */
export async function checkBlockedMemoryRevival(userId: string): Promise<Array<{ id: string; content: string }>> {
  const blocked = await prisma.agentMemory.findMany({
    where: { userId, status: "blocked" },
  });

  const candidates: Array<{ id: string; content: string }> = [];
  for (const mem of blocked) {
    // Check if recent patterns support this memory
    const recentPattern = await prisma.userPattern.findFirst({
      where: {
        userId,
        lastUpdated: { gte: mem.updatedAt },
        confidence: { gt: 0.7 },
      },
    });
    if (recentPattern) {
      candidates.push({ id: mem.id, content: mem.content });
    }
  }
  return candidates;
}
