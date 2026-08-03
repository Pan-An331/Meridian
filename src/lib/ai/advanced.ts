// Phase 3: Advanced AI Capabilities
// LLM three-tier analysis, Memory resurrection, UserModel V2 groundwork.

import { prisma } from "@/lib/prisma";
import { callAI } from "./client";
import { runPatternMining } from "./pattern-mining";

// ── LLM Three-Tier Analysis ──

/** Level 1: Daily — already handled by pattern-mining.ts (zero LLM) */

/** Level 2: Anomaly-triggered — called when a significant metric shift is detected */
export async function triggerAnomalyAnalysis(userId: string): Promise<boolean> {
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // Check completion rate drop > 40%
  const [recentCompleted, prevCompleted] = await Promise.all([
    prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
  ]);

  const [recentTotal, prevTotal] = await Promise.all([
    prisma.task.count({ where: { userId, status: { in: ["not_started", "in_progress", "completed"] }, createdAt: { gte: weekAgo } } }),
    prisma.task.count({ where: { userId, status: { in: ["not_started", "in_progress", "completed"] }, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
  ]);

  const recentRate = recentTotal > 0 ? recentCompleted / recentTotal : 0;
  const prevRate = prevTotal > 0 ? prevCompleted / prevTotal : 0;
  const droppedSignificantly = prevRate > 0.3 && recentRate < prevRate * 0.6;

  // Check skip rate spike
  const recentSkips = await prisma.userObservation.count({
    where: { userId, type: "skip", timestamp: { gte: weekAgo } },
  });

  if (droppedSignificantly || recentSkips >= 5) {
    try {
      await runLLMAnalysis(userId, droppedSignificantly ? "completion_drop" : "skip_spike");
      return true;
    } catch { return false; }
  }
  return false;
}

/** Level 3: Monthly deep analysis */
export async function runMonthlyDeepAnalysis(userId: string) {
  try {
    await runLLMAnalysis(userId, "monthly_review");
    return true;
  } catch { return false; }
}

/** Shared LLM analysis — outputs testable hypotheses, verified before writing Memory */
async function runLLMAnalysis(userId: string, trigger: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Build structured context
  const [timeLogs, feedbacks, states, completedTasks] = await Promise.all([
    prisma.timeLog.findMany({
      where: { userId, startedAt: { gte: thirtyDaysAgo } },
      select: { type: true, startedAt: true, durationSeconds: true },
      orderBy: { startedAt: "desc" }, // 修复：take 配 orderBy
      take: 200,
    }),
    prisma.taskExecutionFeedback.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { task: { select: { title: true, category: true } } },
    }),
    prisma.userState.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { stateType: true, value: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.task.findMany({
      where: { userId, status: "completed", completedAt: { gte: thirtyDaysAgo } },
      select: { title: true, category: true, estimatedMinutes: true, actualMinutes: true },
      orderBy: { completedAt: "desc" },
      take: 50,
    }),
  ]);

  const context = `
触发类型: ${trigger}
时间范围: 最近 30 天

执行数据: ${timeLogs.length} 条 TimeLog
暂停反馈: ${feedbacks.length} 条 (原因分布: ${feedbacks.map(f => f.reason).join(", ")})
状态变化: ${states.length} 条
完成任务: ${completedTasks.length} 个

请输出 JSON — 3-5 条可测试假设:
{
  "hypotheses": [{
    "hypothesis": "用户的发现",
    "test_condition": "如何验证",
    "expected_result": "预期的验证结果",
    "confidence": 0.4
  }]
}`;

  const prompt = `你是 Task OS 的行为分析引擎。分析用户数据，输出可测试假设。只说观察到的模式，不要编造。`;

  try {
    const raw = await callAI(userId, prompt, context);
    const js = raw.trim().replace(/```json\s*|\s*```/g, "");
    const result = JSON.parse(js);

    const hypotheses = result.hypotheses || [];
    if (!Array.isArray(hypotheses)) return;

    for (const h of hypotheses) {
      if (!h.hypothesis || h.confidence < 0.3) continue;

      // Verify with local data
      const verified = await verifyHypothesis(userId, h);
      if (verified) {
        // Write as Memory (not directly — through verification)
        const existing = await prisma.agentMemory.findFirst({
          where: { userId, content: { contains: h.hypothesis.slice(0, 30) } },
        });
        if (existing) {
          await prisma.agentMemory.update({
            where: { id: existing.id },
            data: { confidence: Math.min(1, existing.confidence + 0.05), evidenceCount: (existing.evidenceCount || 0) + 1 },
          });
        } else {
          await prisma.agentMemory.create({
            data: {
              userId,
              memoryType: "ability",
              content: h.hypothesis,
              source: "ai_analysis",
              confidence: h.confidence * 0.7,
              status: "active",
              dimension: "ability",
            },
          });
        }
      }
    }
  } catch (e) {
    console.error("[advanced] LLM analysis failed:", e);
  }
}

/** 真实验证：假设必须包含语义关键词，且最近 pattern 覆盖同一主题，否则不写记忆 */
async function verifyHypothesis(userId: string, h: any): Promise<boolean> {
  const hypothesis = String(h?.hypothesis || "");
  if (hypothesis.length < 4) return false;

  // 语义关键词：假设必须落在这些可验证主题上
  const SEM_KEYWORDS = ["上午", "下午", "晚上", "凌晨", "周一", "周五", "周末", "精力", "疲劳", "拖延", "跳过", "太难", "复杂", "碎片", "连续", "分心"];
  const matchedKw = SEM_KEYWORDS.filter((kw) => hypothesis.includes(kw));
  if (matchedKw.length === 0) return false;

  const recentPatterns = await prisma.userPattern.findMany({
    where: { userId, lastUpdated: { gte: new Date(Date.now() - 7 * 86400000) } },
  });
  if (recentPatterns.length === 0) return false;

  // pattern 必须覆盖假设的主题（condition/metric/pattern 任一命中关键词）
  const patternText = recentPatterns.map((p) => `${p.condition} ${p.metric} ${p.pattern}`).join(" ");
  return matchedKw.some((kw) => patternText.includes(kw));
}

// ── Memory Resurrection ──

/** Check if retired memories should be revived based on new matching task/pattern */
export async function checkMemoryResurrection(userId: string): Promise<number> {
  const retired = await prisma.agentMemory.findMany({
    where: { userId, status: "retired" },
  });
  let revived = 0;

  // 语义关键词：记忆与 pattern 必须落在同一主题上才算匹配
  const SEM_KEYWORDS = ["上午", "下午", "晚上", "凌晨", "周一", "周五", "周末", "精力", "疲劳", "拖延", "跳过", "太难", "复杂", "碎片", "连续", "分心", "健身", "学习", "项目"];

  for (const mem of retired) {
    const memoryKw = SEM_KEYWORDS.filter((kw) => mem.content.includes(kw));
    if (memoryKw.length === 0) continue; // 记忆不落在任何可验证主题上，不复活

    // 最近 30 天内是否有 pattern 覆盖同一主题（修复：原来用内容截断匹配固定 pattern 名，几乎不可能命中）
    const recentPatterns = await prisma.userPattern.findMany({
      where: { userId, lastUpdated: { gte: new Date(Date.now() - 30 * 86400000) } },
    });
    const patternText = recentPatterns.map((p) => `${p.condition} ${p.metric} ${p.pattern}`).join(" ");
    if (!memoryKw.some((kw) => patternText.includes(kw))) continue;

    await prisma.agentMemory.update({
      where: { id: mem.id },
      data: {
        status: "active",
        confidence: 0.5,
        importanceScore: 0.3,
      },
    });
    revived++;
  }
  return revived;
}

// ── Daily Pipeline (call from Today API or cron) ──

/** Runs all daily AI maintenance — Pattern Mining + Lifecycle + Resurrection + Anomaly Check */
export async function runDailyAIPipeline(userId: string) {
  // 每步独立容错：单步失败不中断整个管线（修复：原实现 pattern mining 失败则后续全部跳过）
  try { await runPatternMining(userId); } catch (e) { console.error("[daily-pipeline] pattern-mining failed:", e); }

  try {
    const { runMemoryLifecycle, computeImportanceScore } = await import("./memory-manager");
    await runMemoryLifecycle(userId);
    // 修复 P1-9：importanceScore 之前无任何调用者，top-N 记忆排序退化为插入序
    const activeMemories = await prisma.agentMemory.findMany({ where: { userId, status: "active" }, select: { id: true } });
    await Promise.allSettled(activeMemories.map(m => computeImportanceScore(m.id)));
  } catch (e) { console.error("[daily-pipeline] memory-lifecycle failed:", e); }

  try { await checkMemoryResurrection(userId); } catch (e) { console.error("[daily-pipeline] resurrection failed:", e); }

  try {
    const { recomputeUserModel } = await import("./decision-engine");
    await recomputeUserModel(userId);
  } catch (e) { console.error("[daily-pipeline] user-model failed:", e); }

  // Level 2: Anomaly check (LLM triggered only if needed)
  await triggerAnomalyAnalysis(userId).catch((e) => console.error("[daily-pipeline] anomaly-analysis failed:", e));
}
