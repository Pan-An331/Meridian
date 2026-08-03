// Plan Conflict Detection — pure rule engine
// Detects: overlap, overload, long sessions, gaps

import type { PlanInteractionItem, PlanAnalysisIssue } from "./types";
import { localDateStr } from "@/lib/date";

/**
 * Detect time overlaps between tasks within the same day.
 */
export function detectOverlaps(items: PlanInteractionItem[]): PlanInteractionItem[] {
  const withConflicts = items.map(item => ({ ...item }));

  for (let i = 0; i < withConflicts.length; i++) {
    const a = withConflicts[i];
    if (!a.end) continue;

    for (let j = i + 1; j < withConflicts.length; j++) {
      const b = withConflicts[j];
      if (!b.end) continue;

      // Same date?
      const aDate = localDateStr(a.start);
      const bDate = localDateStr(b.start);
      if (aDate !== bDate) continue;

      // Overlap check: a.start < b.end && b.start < a.end
      if (a.start < b.end && b.start < a.end) {
        withConflicts[i] = {
          ...withConflicts[i],
          conflict: { type: "overlap", withTaskId: b.taskId, withTitle: b.title },
        };
        withConflicts[j] = {
          ...withConflicts[j],
          conflict: { type: "overlap", withTaskId: a.taskId, withTitle: a.title },
        };
      }
    }
  }

  return withConflicts;
}

/**
 * Analyze full week of interactions and return issues + suggestions.
 * Pure rule engine — no LLM.
 */
export function analyzePlan(items: PlanInteractionItem[]): {
  issues: PlanAnalysisIssue[];
  healthScore: number;
} {
  const issues: PlanAnalysisIssue[] = [];

  if (items.length === 0) {
    return { issues: [], healthScore: 100 };
  }

  // 1. Overlap detection
  const conficted = detectOverlaps(items);
  const overlaps = conficted.filter(i => i.conflict);
  if (overlaps.length > 0) {
    issues.push({
      type: "overlap",
      message: overlaps.length + " 个任务存在时间冲突",
      severity: "warning",
    });
  }

  // 2. Daily overload (> 360 min = 6h scheduled/day)
  const dayLoad = new Map<string, number>();
  for (const item of items) {
    const dk = localDateStr(item.start);
    dayLoad.set(dk, (dayLoad.get(dk) || 0) + item.durationMinutes);
  }
  for (const [date, minutes] of dayLoad) {
    if (minutes >= 360) {
      const h = Math.round(minutes / 60);
      issues.push({
        type: "overload",
        message: date + " 安排了 " + h + " 小时，密度较高",
        severity: "warning",
      });
    }
  }

  // 3. Long sessions (single task > 3h)
  for (const item of items) {
    if (item.durationMinutes >= 180) {
      issues.push({
        type: "long_session",
        message: item.title + " 连续 " + Math.round(item.durationMinutes / 60) + " 小时，建议拆分或安排休息",
        taskId: item.taskId,
        severity: "info",
      });
    }
  }

  // 4. Large gaps (>4h empty in waking hours)
  // Already handled at UI level via free space display

  // Health score: deduct for each issue
  let score = 100;
  score -= overlaps.length * 15;
  for (const [, minutes] of dayLoad) {
    if (minutes >= 360) score -= 10;
    if (minutes >= 480) score -= 10;
  }
  const longSessions = issues.filter(i => i.type === "long_session").length;
  score -= longSessions * 5;
  score = Math.max(0, Math.min(100, score));

  return { issues, healthScore: score };
}
