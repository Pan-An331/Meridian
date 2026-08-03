// Phase 3: Pattern Mining Engine
// 8 local rules, zero LLM cost, runs daily.
// Reads UserObservation → computes → writes UserPattern.

import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";
import { normalizeCategory } from "@/lib/plan/colors";

interface MinedPattern {
  pattern: string;
  condition: string;
  metric: string;
  confidence: number;
  evidenceCount: number;
}

/** Main entry — call once daily (e.g. from Today API or cron) */
export async function runPatternMining(userId: string): Promise<MinedPattern[]> {
  const now = new Date();
  const start30d = new Date(now); start30d.setDate(start30d.getDate() - 30);
  const start14d = new Date(now); start14d.setDate(start14d.getDate() - 14);

  const results: MinedPattern[] = [];

  // Rule 1: Time preference — user repeatedly reschedules to a different hour block
  const r1 = await mineTimePreference(userId, start30d);
  if (r1) results.push(r1);

  // Rule 2: Time under-estimation — actual > estimated × 1.5
  const r2 = await mineTimeDeviation(userId, start30d);
  if (r2) results.push(r2);

  // Rule 3: Over-planned — delay rate > 30%
  const r3 = await mineOverPlanned(userId, start30d);
  if (r3) results.push(r3);

  // Rule 4: Category blocking — same category, 3+ pauses = "too_hard"
  const r4 = await mineCategoryBlocking(userId, start30d);
  if (r4) results.push(r4);

  // Rule 5: Daily ceiling — 5 consecutive days ≤ 4h completed
  const r5 = await mineDailyCeiling(userId, start14d);
  if (r5) results.push(r5);

  // Rule 6: Category avoidance — same category skipped 3+ times
  const r6 = await mineCategoryAvoidance(userId, start30d);
  if (r6) results.push(r6);

  // Rule 7: Peak hour — certain hour block has significantly higher completion rate
  const r7 = await minePeakHour(userId, start30d);
  if (r7) results.push(r7);

  // Rule 8: Weekly fatigue — Friday completion rate significantly lower than Monday
  const r8 = await mineWeeklyFatigue(userId, start30d);
  if (r8) results.push(r8);

  // Rule 9: Pause pattern — same pause reason 3+ times (修复：pause 观察原为只写不读死数据)
  const r9 = await minePausePattern(userId, start30d);
  if (r9) results.push(r9);

  // Rule 10: Theme time preference — V3：某主题的排期常被移到特定时段（主题时段偏好，可选增强）
  const r10 = await mineThemeTimePreference(userId, start30d);
  if (r10) results.push(r10);

  // Persist patterns
  for (const r of results) {
    const existing = await prisma.userPattern.findFirst({
      where: { userId, pattern: r.pattern },
    });
    if (existing) {
      await prisma.userPattern.update({
        where: { id: existing.id },
        data: {
          metric: r.metric,
          confidence: r.confidence,
          evidenceCount: r.evidenceCount,
          lastUpdated: new Date(),
        },
      });
    } else {
      await prisma.userPattern.create({
        data: {
          userId,
          pattern: r.pattern,
          condition: r.condition,
          metric: r.metric,
          confidence: r.confidence,
          evidenceCount: r.evidenceCount,
        },
      });
    }
  }

  return results;
}

// ── Rule 1: Time Preference ──
// 修复：原实现只统计"跨上午/下午边界"的迁移（真实数据几乎不满足，规律永远挖不出），
// 放宽为：任意小时段迁移都计数，时段（上午<12/下午12-18/晚上>=18）按迁移目标归类
async function mineTimePreference(userId: string, since: Date): Promise<MinedPattern | null> {
  const obs = await prisma.userObservation.findMany({
    where: { userId, type: "time_modification", timestamp: { gte: since } },
    select: { detail: true },
  });
  if (obs.length < 3) return null;

  let toMorning = 0, toAfternoon = 0, toEvening = 0;
  let migrated = 0;
  for (const o of obs) {
    try {
      const d = JSON.parse(o.detail);
      const fromH = parseInt(d.fromHour); const toH = parseInt(d.toHour);
      if (isNaN(fromH) || isNaN(toH)) continue;
      if (fromH === toH) continue; // 同小时段迁移不算
      migrated++;
      const to = toH < 12 ? "am" : toH < 18 ? "pm" : "ev";
      if (to === "am") toMorning++;
      else if (to === "pm") toAfternoon++;
      else toEvening++;
    } catch {}
  }

  if (migrated < 3) return null;

  if (toMorning >= 3) return { pattern: "time_preference_morning", condition: "用户多次将任务调整到上午", metric: `上午偏好 ${toMorning}/${migrated} 次迁移`, confidence: 0.65, evidenceCount: toMorning };
  if (toAfternoon >= 3) return { pattern: "time_preference_afternoon", condition: "用户多次将任务调整到下午", metric: `下午偏好 ${toAfternoon}/${migrated} 次迁移`, confidence: 0.6, evidenceCount: toAfternoon };
  if (toEvening >= 3) return { pattern: "time_preference_evening", condition: "用户多次将任务调整到晚上", metric: `晚上偏好 ${toEvening}/${migrated} 次迁移`, confidence: 0.6, evidenceCount: toEvening };
  return null;
}

// ── Rule 2: Time Under-estimation ──
async function mineTimeDeviation(userId: string, since: Date): Promise<MinedPattern | null> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: "completed", completedAt: { gte: since }, estimatedMinutes: { not: null, gt: 0 }, actualMinutes: { gt: 0 } },
    select: { estimatedMinutes: true, actualMinutes: true },
    orderBy: { completedAt: "desc" }, // 修复：take 配 orderBy，取最近样本
    take: 30,
  });
  const overEstimates = tasks.filter(t => t.estimatedMinutes && t.actualMinutes > t.estimatedMinutes * 1.5);
  if (overEstimates.length < 5) return null;

  const avgRatio = overEstimates.reduce((s, t) => s + (t.actualMinutes! / t.estimatedMinutes!), 0) / overEstimates.length;
  return { pattern: "time_underestimation", condition: "实际耗时 > 预估 × 1.5", metric: `平均实际/预估 = ${avgRatio.toFixed(1)}，样本 ${overEstimates.length}`, confidence: 0.55, evidenceCount: overEstimates.length };
}

// ── Rule 3: Over-planned ──
async function mineOverPlanned(userId: string, since: Date): Promise<MinedPattern | null> {
  const [delayed, total] = await Promise.all([
    prisma.task.count({ where: { userId, status: "delayed", createdAt: { gte: since } } }),
    prisma.task.count({ where: { userId, status: { in: ["not_started", "in_progress", "completed", "delayed"] }, createdAt: { gte: since } } }),
  ]);
  if (total === 0 || delayed / total < 0.3) return null;
  return { pattern: "over_planned", condition: "延迟率 > 30%", metric: `延迟 ${delayed}/${total} (${Math.round(delayed/total*100)}%)`, confidence: 0.5, evidenceCount: total };
}

// ── Rule 4: Category Blocking ──
async function mineCategoryBlocking(userId: string, since: Date): Promise<MinedPattern | null> {
  const feedbacks = await prisma.taskExecutionFeedback.findMany({
    where: { userId, createdAt: { gte: since }, reason: { in: ["too_hard", "太难", "太复杂"] } },
    take: 50,
    include: { task: { select: { category: true } } },
  });
  const catCount: Record<string, number> = {};
  for (const f of feedbacks) {
    const cat = normalizeCategory(f.task?.category);
    catCount[cat] = (catCount[cat] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(catCount)) {
    if (count >= 3) {
      return { pattern: `category_blocking_${cat}`, condition: `${cat} 类别 3+ 次暂停=太难`, metric: `${cat} 暂停 ${count} 次`, confidence: 0.55, evidenceCount: count };
    }
  }
  return null;
}

// ── Rule 5: Daily Ceiling ──
async function mineDailyCeiling(userId: string, since: Date): Promise<MinedPattern | null> {
  const summaries = await prisma.dailySummary.findMany({
    where: { userId, date: { gte: localDateStr(since) } },
    orderBy: { date: "desc" },
    take: 14,
    select: { date: true, totalMinutes: true },
  });
  const recentDays = summaries.slice(0, 5).filter(s => s.totalMinutes > 0 && s.totalMinutes <= 240);
  if (recentDays.length < 5) return null;

  const avgMin = Math.round(recentDays.reduce((s, r) => s + r.totalMinutes, 0) / recentDays.length);
  const avgH = (avgMin / 60).toFixed(1);
  return { pattern: "daily_ceiling", condition: "连续 5 天完成 ≤ 4h", metric: `日均有效工作 ${avgH}h`, confidence: 0.65, evidenceCount: recentDays.length };
}

// ── Rule 6: Category Avoidance ──
async function mineCategoryAvoidance(userId: string, since: Date): Promise<MinedPattern | null> {
  const skipped = await prisma.userObservation.findMany({
    where: { userId, type: "skip", timestamp: { gte: since } },
    select: { category: true },
    take: 50,
  });
  const catSkip: Record<string, number> = {};
  for (const s of skipped) {
    const cat = normalizeCategory(s.category);
    catSkip[cat] = (catSkip[cat] || 0) + 1;
  }
  for (const [cat, count] of Object.entries(catSkip)) {
    if (count >= 3) {
      return { pattern: `category_avoidance_${cat}`, condition: `${cat} 类别连续跳过 3+ 次`, metric: `${cat} 跳过 ${count} 次`, confidence: 0.45, evidenceCount: count };
    }
  }
  return null;
}

// ── Rule 7: Peak Hour ──
async function minePeakHour(userId: string, since: Date): Promise<MinedPattern | null> {
  const logs = await prisma.timeLog.findMany({
    where: { userId, startedAt: { gte: since }, type: "start" },
    select: { startedAt: true },
  });
  const hourCount: Record<number, number> = {};
  for (const l of logs) {
    const h = l.startedAt.getHours();
    hourCount[h] = (hourCount[h] || 0) + 1;
  }
  const sorted = Object.entries(hourCount)
    .map(([h, c]) => ({ hour: parseInt(h), count: c }))
    .sort((a, b) => b.count - a.count);
  if (sorted.length === 0 || sorted[0].count < 5) return null;

  const top = sorted.slice(0, 2);
  const label = top.map(t => `${t.hour}时(${t.count}次)`).join("、");
  return { pattern: "peak_hour", condition: "某时段任务开始次数显著高", metric: `高峰：${label}`, confidence: 0.5, evidenceCount: top[0].count };
}

// ── Rule 8: Weekly Fatigue ──
async function mineWeeklyFatigue(userId: string, since: Date): Promise<MinedPattern | null> {
  const start = localDateStr(since);
  const summaries = await prisma.dailySummary.findMany({
    where: { userId, date: { gte: start } },
    orderBy: { date: "asc" },
    select: { date: true, completedCount: true },
  });
  if (summaries.length < 10) return null;

  // Group by day of week
  const dowCounts: Record<number, number[]> = {};
  for (const s of summaries) {
    const d = new Date(s.date + "T00:00:00");
    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri
    if (dow >= 1 && dow <= 5) {
      if (!dowCounts[dow]) dowCounts[dow] = [];
      dowCounts[dow].push(s.completedCount);
    }
  }

  const monday = avg(dowCounts[1] || []);
  const friday = avg(dowCounts[5] || []);
  if (monday > 0 && friday > 0 && friday < monday * 0.6) {
    return { pattern: "weekly_fatigue", condition: "周五完成率显著低于周一", metric: `周一均值 ${monday.toFixed(1)} → 周五均值 ${friday.toFixed(1)}`, confidence: 0.45, evidenceCount: (dowCounts[1]?.length || 0) + (dowCounts[5]?.length || 0) };
  }
  return null;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ── Rule 9: Pause Pattern ──
async function minePausePattern(userId: string, since: Date): Promise<MinedPattern | null> {
  const obs = await prisma.userObservation.findMany({
    where: { userId, type: "pause", timestamp: { gte: since } },
    select: { category: true, detail: true },
    take: 50,
  });
  if (obs.length < 3) return null;

  // 按 category × reason 分组统计
  const catReason = new Map<string, { reason: string; count: number }>();
  for (const o of obs) {
    const cat = o.category || "other";
    let reason = "unknown";
    try { const d = JSON.parse(o.detail || "{}"); if (d.reason) reason = String(d.reason); } catch {}
    const cur = catReason.get(cat);
    if (!cur) catReason.set(cat, { reason, count: 1 });
    else if (cur.reason === reason) catReason.set(cat, { reason, count: cur.count + 1 });
  }

  let best: { cat: string; reason: string; count: number } | null = null;
  for (const [cat, r] of catReason) {
    if (!best || r.count > best.count) best = { cat, reason: r.reason, count: r.count };
  }
  if (!best || best.count < 3) return null;

  return {
    pattern: "pause_pattern_" + best.cat,
    condition: best.cat + " 类别暂停 " + best.count + " 次（原因：" + best.reason + "）",
    metric: "暂停 " + best.count + " 次 · 原因 " + best.reason,
    confidence: 0.5,
    evidenceCount: best.count,
  };
}

// ── Rule 10: Theme Time Preference（V3 §4.5 可选增强，不阻塞）──
// 某主题的任务排期经常被用户移到某个时段（上午/下午/晚上）→ 该主题时段偏好
// 数据源：time_modification 观察（detail 含 fromHour/toHour）+ 任务 theme
async function mineThemeTimePreference(userId: string, since: Date): Promise<MinedPattern | null> {
  const obs = await prisma.userObservation.findMany({
    where: { userId, type: "time_modification", timestamp: { gte: since } },
    select: { taskId: true, detail: true },
    take: 200,
  });
  if (obs.length < 3) return null;

  const taskIds = [...new Set(obs.map(o => o.taskId).filter(Boolean))] as string[];
  const tasks = taskIds.length > 0
    ? await prisma.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, theme: true } })
    : [];
  const themeById = new Map(tasks.map(t => [t.id, t.theme]));

  // theme → { toMorning, toAfternoon, toEvening }
  const agg = new Map<string, { toMorning: number; toAfternoon: number; toEvening: number; total: number }>();
  for (const o of obs) {
    const theme = o.taskId ? themeById.get(o.taskId) : null;
    if (!theme) continue;
    try {
      const d = JSON.parse(o.detail);
      const toH = parseInt(d.toHour);
      if (isNaN(toH)) continue;
      const cur = agg.get(theme) || { toMorning: 0, toAfternoon: 0, toEvening: 0, total: 0 };
      if (toH < 12) cur.toMorning++;
      else if (toH < 18) cur.toAfternoon++;
      else cur.toEvening++;
      cur.total++;
      agg.set(theme, cur);
    } catch {}
  }

  // 找迁移 ≥3 次且某时段占比 ≥60% 的主题
  for (const [theme, a] of agg) {
    if (a.total < 3) continue;
    const slot = a.toMorning >= a.toAfternoon && a.toMorning >= a.toEvening
      ? (a.toMorning / a.total >= 0.6 ? { name: "上午", n: a.toMorning } : null)
      : (a.toAfternoon >= a.toEvening
        ? (a.toAfternoon / a.total >= 0.6 ? { name: "下午", n: a.toAfternoon } : null)
        : (a.toEvening / a.total >= 0.6 ? { name: "晚上", n: a.toEvening } : null));
    if (!slot) continue;
    return {
      pattern: "theme_time_" + theme,
      condition: "主题「" + theme + "」的排期 " + a.total + " 次被移到" + slot.name + "（" + slot.n + " 次）",
      metric: slot.name + "时段 · " + Math.round((slot.n / a.total) * 100) + "%",
      confidence: 0.55,
      evidenceCount: a.total,
    };
  }
  return null;
}
