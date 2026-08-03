// V2.0 Task Types

export const TaskType = {
  INBOX: "inbox",
  PLANNED: "planned",
  SCHEDULED: "scheduled",
} as const;

export type TaskTypeValue = (typeof TaskType)[keyof typeof TaskType];

export const TaskStatus = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  DELAYED: "delayed",
  SNOOZED: "snoozed",
  CANCELLED: "cancelled",
} as const;

export type TaskStatusValue = (typeof TaskStatus)[keyof typeof TaskStatus];

export const ImportanceLevel = { VERY_LOW: 1, LOW: 2, MEDIUM: 3, HIGH: 4, CRITICAL: 5 } as const;
export type ImportanceValue = 1 | 2 | 3 | 4 | 5;

export const Temperature = { EXPLODING: "exploding", HOT: "hot", NORMAL: "normal", LONGTERM: "longterm" } as const;
export type TemperatureValue = (typeof Temperature)[keyof typeof Temperature];

export const TaskTypeLabels: Record<TaskTypeValue, string> = { inbox: "收集箱", planned: "截止日", scheduled: "时间块" };
export const TaskTypeDescriptions: Record<TaskTypeValue, string> = { inbox: "想法暂存，无时间约束", planned: "有截止日期，未确定具体时间", scheduled: "已确定具体时间段" };
export const TaskStatusLabels: Record<TaskStatusValue, string> = { not_started: "not started", in_progress: "in progress", completed: "done", delayed: "delayed", snoozed: "snoozed", cancelled: "cancelled" };
export const ImportanceLabels: Record<ImportanceValue, string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5" };
export const ImportanceColors: Record<ImportanceValue, string> = { 1: "text-[var(--sem-priority-p1)]", 2: "text-[var(--sem-priority-p2)]", 3: "text-[var(--sem-priority-p3)]", 4: "text-[var(--sem-priority-p4)]", 5: "text-[var(--sem-priority-p5)]" };
export const TemperatureLabels: Record<TemperatureValue, string> = { exploding: "critical", hot: "hot", normal: "normal", longterm: "long" };
export const TemperatureColors: Record<TemperatureValue, string> = { exploding: "text-[var(--sem-temp-exploding)] bg-[var(--sem-temp-exploding-bg)] border-[var(--sem-temp-exploding-border)]", hot: "text-[var(--sem-temp-hot)] bg-[var(--sem-temp-hot-bg)] border-[var(--sem-temp-hot-border)]", normal: "text-[var(--sem-temp-normal)] bg-[var(--sem-temp-normal-bg)] border-[var(--sem-temp-normal-border)]", longterm: "text-[var(--sem-temp-longterm)] bg-[var(--sem-temp-longterm-bg)] border-[var(--sem-temp-longterm-border)]" };

export function importanceToTemperature(importance: ImportanceValue): TemperatureValue {
  if (importance >= 5) return "exploding";
  if (importance >= 4) return "hot";
  if (importance >= 2) return "normal";
  return "longterm";
}

export const ComplexityLevel = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type ComplexityValue = (typeof ComplexityLevel)[keyof typeof ComplexityLevel];
export const ComplexityLabels: Record<ComplexityValue, string> = { low: "simple", medium: "medium", high: "complex" };

export const RiskLevel = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type RiskValue = (typeof RiskLevel)[keyof typeof RiskLevel];
export const RiskLabels: Record<RiskValue, string> = { low: "low", medium: "medium", high: "high" };

export const CognitiveLoad = { LOW: "low", MEDIUM: "medium", HIGH: "high" } as const;
export type CognitiveLoadValue = (typeof CognitiveLoad)[keyof typeof CognitiveLoad];
export const CognitiveLoadLabels: Record<CognitiveLoadValue, string> = { low: "low", medium: "medium", high: "high" };

// V5 层级重构：任务层级语义（project 项目根 / phase 阶段 / task 任务锚点）
export const TaskLevel = { PROJECT: "project", PHASE: "phase", TASK: "task" } as const;
export type TaskLevelValue = (typeof TaskLevel)[keyof typeof TaskLevel];
export const TaskLevelLabels: Record<TaskLevelValue, string> = { project: "项目", phase: "阶段", task: "任务" };
export const VALID_LEVELS: string[] = Object.values(TaskLevel);

export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags.split(",").map((t) => t.trim()).filter(Boolean);
}

export function joinTags(tags: string[]): string { return tags.join(","); }

// TaskCategory Enum
export const TaskCategoryEnum = {
  COURSE:        { key: "COURSE",        icon: "course",      label: "course",       border: "#475569", bg: "#E2E8F0" },
  LEARNING:      { key: "LEARNING",      icon: "learning",    label: "learning",     border: "#2563EB", bg: "#EFF6FF" },
  PRACTICE:      { key: "PRACTICE",      icon: "practice",    label: "practice",     border: "#7C3AED", bg: "#F5F3FF" },
  COMPETITION:   { key: "COMPETITION",   icon: "competition", label: "competition",  border: "#DB2777", bg: "#FDF2F8" },
  HEALTH:        { key: "HEALTH",        icon: "health",      label: "health",       border: "#16A34A", bg: "#F0FDF4" },
  PERSONAL:      { key: "PERSONAL",      icon: "personal",    label: "personal",     border: "#CA8A04", bg: "#FEFCE8" },
  EXTERNAL:      { key: "EXTERNAL",      icon: "external",    label: "社团/学校任务", border: "#F97316", bg: "#FFF7ED" },
  UNCATEGORIZED: { key: "UNCATEGORIZED", icon: "uncategorized", label: "uncategorized", border: "#CBD5E1", bg: "#F8FAFC" },
} as const;

export type TaskCategoryKey = keyof typeof TaskCategoryEnum;
export type TaskCategoryValue = (typeof TaskCategoryEnum)[TaskCategoryKey];
