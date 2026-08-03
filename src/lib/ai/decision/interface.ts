// Decision AI unified interface

export interface Suggestion {
  title: string;
  description: string;
}

export interface DecisionAction {
  id: string;
  // 修复 P1-18：统一 today-decide（DecideAction）与 decision 引擎的 action 类型
  type: "reschedule" | "modify_task" | "keep" | "postpone" | "reduce_time" | "skip" | "swap" | "reduce_all" | "keep_mustdo_only" | "switch_to_simple";
  title: string;
  description: string;
  payload: Record<string, any>;
}

export interface DecisionAnalysis {
  decision: string;
  risk: "low" | "medium" | "high";
  impact: string[];
  suggestions: Suggestion[];
  actions: DecisionAction[];
  needConfirmation: boolean;
}

export interface DecisionResult {
  type: "risk" | "schedule" | "suggestion" | "analysis";
  message: string;
  actions?: { type: string; payload: any }[];
  confidence: number;
}

/** Placeholder */
export function suggestSchedule(): { status: string } { return { status: "not_ready" }; }
export function analyzeBehavior(): { status: string } { return { status: "not_ready" }; }
