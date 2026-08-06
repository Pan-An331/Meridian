// Inbox types for Task OS V2.0

export interface InboxResponse {
  draftId: string;
  understanding: string;
  items: InboxDraftItem[];
}

export interface InboxDraftItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  taskType: "planned" | "inbox" | "scheduled";
  importance?: number;
  deadline?: string;
  startTime?: string;
  endTime?: string;
  estimatedMinutes?: number;
  complexity?: "low" | "medium" | "high";
  aiReason: string;
  confidence: number;
  breakdown?: BreakdownDraft;
  // V5 层级重构：层级语义（project/phase/task）+ 积累型标记 + 每日重复时长
  level?: "project" | "phase" | "task";
  accumulate?: boolean;
  repeatMinutes?: number;
  // V3：主题（目标，独立字段；AI 拿不准留空，不强猜）
  theme?: string | null;
  // B7：自定义主题落库色（JSON {"color","deep","bg"}；预设主题为 null）
  themeColor?: string | null;
  // Focus Card V2：动机文案（AI 推断/父级继承/可改，≤50 字；拿不准留空）
  purpose?: string | null;
}

export interface BreakdownDraft {
  shouldBreakdown: boolean;
  reason: string;
  phases: BreakdownPhase[];
}

export interface BreakdownPhase {
  title: string;
  phaseOrder: number;
  tasks: BreakdownTask[];
}

// V5：任务节点可带 children（L4 执行项），构成最多 4 层：项目根 → phase → task → step
export interface BreakdownTask {
  title: string;
  estimatedMinutes: number;
  cognitiveLoad?: string;
  children?: { title: string; estimatedMinutes?: number }[];
}

export interface InboxConfirmRequest {
  draftId: string;
  confirmed: InboxDraftItem[];
  discarded: string[];
}
