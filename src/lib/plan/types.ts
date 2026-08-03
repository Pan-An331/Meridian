export interface PlanSchedule { id: string; start: string; end: string | null; source: string; }
export interface PlanItem { taskId: string; title: string; schedule: PlanSchedule | null; status: string; importance: number; taskType: string; }
export interface DailyPlan { date: string; items: PlanItem[]; }
export interface WeeklyPlan { weekStart: string; weekEnd: string; items: PlanItem[]; }

export interface ScheduleCardData {
  taskId: string; title: string; start: string; end: string | null;
  scheduleSource: "HARD" | "AI_PROPOSED" | "AI_CONFIRMED"; importance: number; status: string; date: string;
}

export interface PlanInteractionItem {
  taskId: string; title: string; scheduleId: string; start: Date; end: Date | null;
  durationMinutes: number; importance: number; source: "USER" | "AI" | "SYSTEM"; status: "pending" | "completed";
  conflict?: { type: "overlap"; withTaskId: string; withTitle: string; };
}

export interface PlanAnalysisIssue {
  type: "overload" | "overlap" | "long_session" | "gap"; message: string; taskId?: string; severity: "warning" | "info";
}
export interface PlanAnalysisSuggestion {
  action: "move"; taskId: string; taskTitle: string; targetDate: string; targetStart: string; reason: string;
}
export interface PlanAnalysisResult {
  issues: PlanAnalysisIssue[]; suggestions: PlanAnalysisSuggestion[]; healthScore: number;
}
export interface RhythmGroup {
  label: string; startHour: number; endHour: number; cards: ScheduleCardData[]; collapsed: boolean;
}

export interface ProposalChange { taskId: string; taskTitle: string; oldTime: string; newTime: string; newStart: string; newEnd: string; }
export interface ProposalImpact { pressureChange: string; summary: string; conflictsResolved: number; hourChange: string; }
export interface PlanProposal {
  id: string; title: string; type: "optimize" | "keep" | "split" | "reschedule"; description: string;
  source: "rule" | "ai"; changes: ProposalChange[]; reason: string; impact: ProposalImpact | null; confidence: number;
}
export interface ProposalResult {
  healthScore: number; issues: { type: string; description: string; severity: "warning" | "info" }[];
  proposals: PlanProposal[]; source: "rule" | "ai";
}

// ═══════════════════════════════════════════════════════════════
// Step27-28: Deadline types
// ═══════════════════════════════════════════════════════════════

export interface DeadlineItem {
  taskId: string;
  title: string;
  deadline: string;
  estimatedMinutes: number | null;
  scheduledMinutes: number;
  remainingDays: number;
  hasSchedule: boolean;
  domain: import("./colors").DomainKey;
  /** All Schedule blocks for this task (real data) */
  schedules?: {
    date: string;
    start: string;
    end: string;
    durationMinutes: number;
  }[];
}
