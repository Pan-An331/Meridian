// Agent Tool definitions with permission levels

export type ToolPermission = "read" | "write" | "confirm";

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermission;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

// Phase 1 allowed tools
export const AGENT_TOOLS: ToolDefinition[] = [
  // Query tools (read-only)
  {
    name: "get_today_tasks",
    description: "获取今日任务概览",
    permission: "read",
    parameters: {},
  },
  {
    name: "get_schedule",
    description: "获取日程安排",
    permission: "read",
    parameters: {
      from: { type: "string", description: "开始日期 YYYY-MM-DD", required: false },
      to: { type: "string", description: "结束日期 YYYY-MM-DD", required: false },
    },
  },
  {
    name: "get_tasks",
    description: "查询任务列表",
    permission: "read",
    parameters: {
      status: { type: "string", description: "状态筛选", required: false },
      type: { type: "string", description: "类型筛选 inbox/planned/scheduled", required: false },
      limit: { type: "number", description: "返回数量", required: false },
    },
  },
  {
    name: "get_user_state",
    description: "获取用户当前状态",
    permission: "read",
    parameters: {},
  },
  {
    name: "get_memories",
    description: "查询用户记忆",
    permission: "read",
    parameters: {
      type: { type: "string", description: "记忆类型筛选", required: false },
    },
  },

  // Write tools
  {
    name: "create_task",
    description: "创建新任务",
    permission: "confirm",
    parameters: {
      title: { type: "string", description: "任务标题", required: true },
      type: { type: "string", description: "inbox/planned/scheduled", required: true },
      importance: { type: "number", description: "重要度1-5", required: false },
      deadline: { type: "string", description: "截止日期 YYYY-MM-DD", required: false },
      estimatedMinutes: { type: "number", description: "预估耗时分钟", required: false },
      description: { type: "string", description: "描述", required: false },
      startTime: { type: "string", description: "开始时间 ISO格式", required: false },
      endTime: { type: "string", description: "结束时间 ISO格式", required: false },
    },
  },
  {
    name: "update_task",
    description: "修改任务",
    permission: "write",
    parameters: {
      taskId: { type: "string", description: "任务ID", required: true },
      importance: { type: "number", description: "重要度1-5", required: false },
      deadline: { type: "string", description: "截止日期", required: false },
      estimatedMinutes: { type: "number", description: "预估耗时", required: false },
      // 修复 P2-9：时间修改不在此工具（走 schedule_task），避免参数被静默丢弃
    },
  },
  {
    name: "schedule_task",
    description: "安排任务执行时间（会覆盖已有排期，需要用户确认）",
    permission: "confirm",
    parameters: {
      taskId: { type: "string", description: "任务ID", required: true },
      start: { type: "string", description: "开始时间 ISO格式", required: true },
      end: { type: "string", description: "结束时间 ISO格式", required: false },
    },
  },
  {
    name: "update_state",
    description: "更新用户状态",
    permission: "write",
    parameters: {
      stateType: { type: "string", description: "状态类型 mood/energy/stress/focus", required: true },
      value: { type: "string", description: "状态描述", required: true },
      impactLevel: { type: "string", description: "影响等级 low/medium/high", required: false },
      impactHint: { type: "string", description: "影响建议", required: false },
    },
  },
  {
    name: "save_memory",
    description: "写入长期记忆",
    permission: "write",
    parameters: {
      memoryType: { type: "string", description: "记忆类型", required: true },
      content: { type: "string", description: "记忆内容", required: true },
      scope: { type: "string", description: "适用范围", required: false },
      importance: { type: "number", description: "重要度1-5", required: false },
    },
  },

  // Confirm tools
  {
    name: "batch_reschedule",
    description: "批量重排任务时间",
    permission: "confirm",
    parameters: {
      reason: { type: "string", description: "重排原因", required: true },
      changes: { type: "string", description: "JSON数组: [{taskId, newStart, newEnd}]", required: true },
    },
  },
  {
    name: "delete_task",
    description: "删除任务",
    permission: "confirm",
    parameters: {
      taskId: { type: "string", description: "任务ID", required: true },
      reason: { type: "string", description: "删除原因", required: false },
    },
  },
  {
    name: "update_profile",
    description: "更新用户画像",
    permission: "confirm",
    parameters: {
      field: { type: "string", description: "字段名", required: true },
      value: { type: "string", description: "新值", required: true },
      reason: { type: "string", description: "更新原因", required: true },
    },
  },
];

// Build tool descriptions for AI system prompt
export function getToolsDescription(): string {
  const lines: string[] = ["你可以调用以下工具：", ""];

  lines.push("【查询工具】");
  AGENT_TOOLS.filter(t => t.permission === "read").forEach(t => {
    lines.push("- " + t.name + ": " + t.description);
  });

  lines.push("");
  lines.push("【执行工具】");
  AGENT_TOOLS.filter(t => t.permission === "write").forEach(t => {
    const params = Object.entries(t.parameters)
      .filter(([, v]) => v.required)
      .map(([k]) => k)
      .join(", ");
    lines.push("- " + t.name + "(" + params + "): " + t.description);
  });

  lines.push("");
  lines.push("【需确认工具】");
  AGENT_TOOLS.filter(t => t.permission === "confirm").forEach(t => {
    lines.push("- " + t.name + ": " + t.description);
  });

  return lines.join("\n");
}
