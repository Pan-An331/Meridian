import { prisma } from "@/lib/prisma";
import { AGENT_TOOLS, type ToolPermission } from "./tools";
import { createDecisionLog } from "./decision-log";
import { resolveTask } from "@/lib/task/resolver";
import { createSchedule, moveSchedule, replaceSchedule } from "@/lib/schedule/service";

export interface ToolCall { tool: string; args: Record<string, any>; }
export interface ToolResult { tool: string; success: boolean; data?: any; error?: string; requiresConfirmation?: boolean; }

export interface OperationResult {
  success: boolean;
  operation: "create_task" | "schedule_move" | "task_update" | "task_delete";
  affected: { taskId?: string; scheduleId?: string; title?: string };
  before: { scheduleStart?: string | null };
  after: { scheduleStart?: string | null };
  error?: string;
  needChoose?: boolean;
  candidates?: { id: string; title: string; createdAt: string }[];
  confidence?: number;
}

function getToolPermission(toolName: string): ToolPermission | null {
  const tool = AGENT_TOOLS.find(t => t.name === toolName);
  return tool ? tool.permission : null;
}

export async function executeTools(userId: string, calls: ToolCall[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of calls) {
    const permission = getToolPermission(call.tool);
    if (!permission) { results.push({ tool: call.tool, success: false, error: "未知工具: " + call.tool }); continue; }
    if (permission === "confirm") { results.push({ tool: call.tool, success: false, requiresConfirmation: true, data: { args: call.args, message: "此操作需要用户确认" } }); continue; }
    try { const data = await executeTool(userId, call.tool, call.args); results.push({ tool: call.tool, success: true, data }); }
    catch (e) { results.push({ tool: call.tool, success: false, error: (e as Error).message }); }
  }
  return results;
}

async function executeTool(userId: string, tool: string, args: Record<string, any>): Promise<any> {
  switch (tool) {
    case "get_today_tasks": {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const tasks = await prisma.task.findMany({ where: { userId, status: { in: ["not_started", "in_progress"] } }, orderBy: [{ importance: "desc" }, { deadline: "asc" }], take: 15 });
      const current = tasks.find(t => t.status === "in_progress");
      const completed = await prisma.task.count({ where: { userId, status: "completed", completedAt: { gte: today, lt: tomorrow } } });
      return { currentTask: current, activeTasks: tasks.slice(0, 10), completedToday: completed };
    }
    case "get_schedule": {
      const from = args.from ? new Date(args.from) : new Date(); if (!args.from) from.setHours(0, 0, 0, 0);
      const to = args.to ? new Date(args.to) : new Date(from.getTime() + 7 * 86400000);
      return (await prisma.schedule.findMany({ where: { userId, scheduledStart: { gte: from, lte: to } }, include: { task: { select: { title: true, importance: true } } }, orderBy: { scheduledStart: "asc" } }))
        .map(s => ({ id: s.id, taskId: s.taskId, title: s.task.title, start: s.scheduledStart.toISOString(), end: s.scheduledEnd?.toISOString(), importance: s.task.importance }));
    }
    case "get_tasks": {
      const where: any = { userId }; if (args.status) where.status = args.status; if (args.type) where.taskType = args.type;
      return (await prisma.task.findMany({ where, orderBy: [{ importance: "desc" }, { deadline: "asc" }], take: args.limit || 20 }))
        .map(t => ({ id: t.id, title: t.title, type: t.taskType, status: t.status, importance: t.importance, deadline: t.deadline?.toISOString(), estimatedMinutes: t.estimatedMinutes }));
    }
    case "get_user_state": {
      const now = new Date();
      return await prisma.userState.findMany({ where: { userId, OR: [{ validUntil: null }, { validUntil: { gte: now } }] }, orderBy: { createdAt: "desc" }, take: 10 });
    }
    case "get_memories": {
      const now = new Date(); const where: any = { userId, status: "active", OR: [{ validUntil: null }, { validUntil: { gte: now } }] };
      if (args.type) where.memoryType = args.type;
      return await prisma.agentMemory.findMany({ where, orderBy: [{ importance: "desc" }], take: 10 });
    }

    // ═══ create_task — uses Schedule Service ═══
    case "create_task": {
      if (!args.title || !String(args.title).trim()) throw new Error("任务标题不能为空");
      const imp = Math.min(5, Math.max(1, args.importance || 3));
      const startParsed = args.startTime ? new Date(args.startTime) : null;
      const endParsed = args.endTime ? new Date(args.endTime) : null;
      const hasStartTime = startParsed && !isNaN(startParsed.getTime());
      const hasEndTime = endParsed && !isNaN(endParsed.getTime());
      const effectiveEndTime = hasEndTime ? endParsed! : (hasStartTime ? new Date(startParsed!.getTime() + (args.estimatedMinutes || 60) * 60000) : null);
      let taskType = ["inbox", "planned", "scheduled"].includes(args.type) ? args.type : "inbox";
      if (hasStartTime) taskType = "scheduled";
      // V3：theme 透传（≤20 字，空则 null）
      const theme = typeof args.theme === "string" && args.theme.trim() ? args.theme.trim().slice(0, 20) : null;
      // Focus Card V2：purpose 透传（≤50 字，空则 null）
      const purpose = typeof args.purpose === "string" && args.purpose.trim() ? args.purpose.trim().slice(0, 50) : null;
      const task = await prisma.task.create({ data: { userId, title: args.title, description: args.description || null, taskType, importance: imp, theme, purpose, deadline: args.deadline ? new Date(args.deadline) : null, estimatedMinutes: args.estimatedMinutes || null, source: "ai", complexity: args.complexity || null, riskLevel: args.riskLevel || null } });
      let scheduleId: string | null = null;
      if (hasStartTime) {
        const s = await createSchedule(userId, task.id, startParsed!, effectiveEndTime!);
        scheduleId = s.id;
      }
      return {
        success: true, operation: "create_task",
        affected: { taskId: task.id, title: task.title, scheduleId },
        before: { scheduleStart: null },
        after: { scheduleStart: hasStartTime ? startParsed!.toISOString() : null },
        confidence: 1,
      };
    }

    // ═══ update_task — uses keyword resolver ═══
    case "update_task": {
      const keyword = args.keyword || args.taskId;
      if (!keyword) throw new Error("需要提供 keyword 参数");
      const resolved = await resolveTask(userId, keyword);
      if (!resolved.success || !resolved.task) {
        if (resolved.needChoose) return { success: false, needChoose: true, candidates: resolved.candidates, operation: "task_update", affected: {}, before: {}, after: {} };
        throw new Error(resolved.message || "任务未找到");
      }
      const data: any = {};
      if (args.importance) data.importance = Math.min(5, Math.max(1, args.importance));
      if (args.deadline) data.deadline = new Date(args.deadline);
      if (args.estimatedMinutes) data.estimatedMinutes = args.estimatedMinutes;
      if (typeof args.theme === "string") data.theme = args.theme.trim().slice(0, 20) || null;
      if (Object.keys(data).length === 0) throw new Error("无有效修改字段");
      const task = await prisma.task.update({ where: { id: resolved.task.id }, data });
      return {
        success: true, operation: "task_update",
        affected: { taskId: task.id, title: task.title },
        before: {}, after: {}, confidence: 1,
      };
    }

    // ═══ schedule_task — keyword + Schedule Service V2 ═══
    case "schedule_task": {
      const keyword = args.keyword || args.taskId;
      if (!keyword) throw new Error("需要提供 keyword 参数");
      if (!args.start) throw new Error("需要提供 start 参数");

      const startParsed = new Date(args.start);
      if (isNaN(startParsed.getTime())) throw new Error("invalid_schedule_time: 时间格式错误，收到: " + String(args.start));
      if (startParsed.getFullYear() < 2025) throw new Error("invalid_schedule_time: 年份异常(" + startParsed.getFullYear() + ")");
      if (String(args.start).match(/^\d+$/)) throw new Error("invalid_schedule_time: 纯数字(" + String(args.start) + ")");

      let endParsed = args.end ? new Date(args.end) : null;
      if (endParsed && isNaN(endParsed.getTime())) endParsed = null;
      if (!endParsed) endParsed = new Date(startParsed.getTime() + 60 * 60 * 1000);

      const resolved = await resolveTask(userId, keyword);
      if (!resolved.success || !resolved.task) {
        if (resolved.needChoose) return { success: false, needChoose: true, candidates: resolved.candidates, operation: "schedule_move", affected: {}, before: {}, after: {} };
        throw new Error(resolved.message || "任务未找到");
      }

      const result = await moveSchedule(userId, resolved.task.id, startParsed, endParsed);
      return {
        success: true, operation: "schedule_move",
        affected: { taskId: resolved.task.id, scheduleId: result.id, title: resolved.task.title },
        before: { scheduleStart: result.oldStart },
        after: { scheduleStart: startParsed.toISOString() },
        confidence: 1,
      };
    }

    case "update_state": {
      // 修复 P1-12：状态必须有过期时间（当日结束），否则旧状态永远影响今日决策
      const validUntil = new Date(); validUntil.setHours(23, 59, 59, 999);
      const state = await prisma.userState.create({ data: { userId, stateType: args.stateType, value: args.value, impactLevel: args.impactLevel || "medium", impactHint: args.impactHint || null, source: "ai", confidence: 0.4, decisionWeight: 0.5, validUntil } });
      return { id: state.id, type: state.stateType, value: state.value };
    }
    case "save_memory": {
      // 修复：保留原始记忆类型语义（原来 fact/event/goal 等被错误映射为 temporary_context）
      const VALID_MEMORY_TYPES = ["behavior_pattern", "preference", "correction", "capability", "temporary_context", "fact", "event", "lifecycle", "project", "goal", "hard_constraint", "user_declaration", "user_correction", "ability"];
      const mappedType = VALID_MEMORY_TYPES.includes(args.memoryType) ? args.memoryType : "temporary_context";
      if (!mappedType) throw new Error("无效的记忆类型: " + args.memoryType);
      if (!args.content || args.content.length < 5) throw new Error("记忆内容太短，不予保存");
      const memory = await prisma.agentMemory.create({ data: { userId, memoryType: mappedType, content: args.content, scope: args.scope || null, importance: args.importance || 3, source: "ai", confidence: 0.4 } });
      return { id: memory.id, type: memory.memoryType, content: memory.content };
    }
    default: throw new Error("未实现的工具: " + tool);
  }
}

export async function executeConfirmedTool(userId: string, tool: string, args: Record<string, any>): Promise<ToolResult> {
  try {
    switch (tool) {
      // ═══ schedule_task — 用户确认后调整排期（权限已从 write 升为 confirm）═══
      case "schedule_task": {
        const keyword = args.keyword || args.taskId;
        if (!keyword) throw new Error("需要提供 keyword 参数");
        if (!args.start) throw new Error("需要提供 start 参数");

        const startParsed = new Date(args.start);
        if (isNaN(startParsed.getTime())) throw new Error("invalid_schedule_time: 时间格式错误，收到: " + String(args.start));
        if (startParsed.getFullYear() < 2025) throw new Error("invalid_schedule_time: 年份异常(" + startParsed.getFullYear() + ")");
        if (String(args.start).match(/^\d+$/)) throw new Error("invalid_schedule_time: 纯数字(" + String(args.start) + ")");

        let endParsed = args.end ? new Date(args.end) : null;
        if (endParsed && isNaN(endParsed.getTime())) endParsed = null;
        if (!endParsed) endParsed = new Date(startParsed.getTime() + 60 * 60 * 1000);
        if (endParsed <= startParsed) endParsed = new Date(startParsed.getTime() + 60 * 60 * 1000);

        const resolved = await resolveTask(userId, keyword);
        if (!resolved.success || !resolved.task) {
          if (resolved.needChoose) return { tool, success: false, data: { needChoose: true, candidates: resolved.candidates, operation: "schedule_move", affected: {}, before: {}, after: {} } };
          throw new Error(resolved.message || "任务未找到");
        }

        const result = await moveSchedule(userId, resolved.task.id, startParsed, endParsed);
        createDecisionLog({ userId, action: "schedule_task", targetId: resolved.task.id, reasoning: "用户确认AI调整时间", actionDetail: JSON.stringify({ start: args.start, end: args.end }) }).catch(() => {});
        return {
          tool, success: true,
          data: {
            operation: "schedule_move",
            affected: { taskId: resolved.task.id, scheduleId: result.id, title: resolved.task.title },
            before: { scheduleStart: result.oldStart },
            after: { scheduleStart: startParsed.toISOString() },
            confidence: 1,
          },
        };
      }

      // ═══ create_task (moved from write to confirm) ═══
      case "create_task": {
        const imp = Math.min(5, Math.max(1, args.importance || 3));
        const startParsed = args.startTime ? new Date(args.startTime) : null;
        const endParsed = args.endTime ? new Date(args.endTime) : null;
        const hasStartTime = startParsed && !isNaN(startParsed.getTime());
        const hasEndTime = endParsed && !isNaN(endParsed.getTime());
        const effectiveEndTime = hasEndTime ? endParsed! : (hasStartTime ? new Date(startParsed!.getTime() + (args.estimatedMinutes || 60) * 60000) : null);
        let taskType = ["inbox", "planned", "scheduled"].includes(args.type) ? args.type : "inbox";
        if (hasStartTime) taskType = "scheduled";
        // V3：theme 透传
        const theme = typeof args.theme === "string" && args.theme.trim() ? args.theme.trim().slice(0, 20) : null;
        // Focus Card V2：purpose 透传（≤50 字，空则 null）
        const purpose = typeof args.purpose === "string" && args.purpose.trim() ? args.purpose.trim().slice(0, 50) : null;
        const task = await prisma.task.create({ data: { userId, title: args.title, description: args.description || null, taskType, importance: imp, theme, purpose, deadline: args.deadline ? new Date(args.deadline) : null, estimatedMinutes: args.estimatedMinutes || null, source: "ai", complexity: args.complexity || null, riskLevel: args.riskLevel || null } });
        let scheduleId: string | null = null;
        if (hasStartTime) {
          const s = await createSchedule(userId, task.id, startParsed!, effectiveEndTime!);
          scheduleId = s.id;
        }
        createDecisionLog({ userId, action: "create_task", targetId: task.id, reasoning: "用户确认AI创建", actionDetail: JSON.stringify(args) }).catch(() => {});
        return { tool, success: true, data: { operation: "create_task", affected: { taskId: task.id, title: task.title, scheduleId }, confidence: 1 } };
      }

      // ═══ delete_task — uses saved taskId, no re-resolve ═══
      case "delete_task": {
        const taskId = args.taskId;
        if (!taskId) return { tool, success: false, error: "缺少 taskId 参数" };
        const task = await prisma.task.findFirst({ where: { id: taskId, userId } });
        if (!task) return { tool, success: false, error: "任务不存在或已被删除" };
        if (task.status === "completed") return { tool, success: false, error: "已完成任务不可删除" };
        const title = task.title;
        // 事务化删除（子任务无级联需手动删；timeLog/schedule/feedback 由数据库级联清理）
        await prisma.$transaction(async (tx) => {
          await tx.task.deleteMany({ where: { parentId: taskId, userId } }); // 修复：子任务也按归属过滤
          await tx.task.delete({ where: { id: taskId } });
        });
        createDecisionLog({ userId, action: "delete_task", targetId: taskId, reasoning: "用户确认删除", actionDetail: JSON.stringify({ title }) }).catch(() => {});
        return { tool, success: true, data: { deleted: taskId, title } };
      }
      case "batch_reschedule": {
        let changes: { taskId: string; newStart: string; newEnd?: string }[];
        try { changes = JSON.parse(args.changes); } catch { return { tool, success: false, error: "changes格式错误" }; }
        // 修复：整体事务，中途失败全部回滚
        const count = await prisma.$transaction(async (tx) => {
          let n = 0;
          for (const ch of changes) {
            await tx.schedule.deleteMany({ where: { taskId: ch.taskId, userId, OR: [{ scheduledEnd: { gt: new Date() } }, { scheduledEnd: null }] } });
            await tx.schedule.create({
              data: { userId, taskId: ch.taskId, scheduledStart: new Date(ch.newStart), scheduledEnd: ch.newEnd ? new Date(ch.newEnd) : new Date(new Date(ch.newStart).getTime() + 3600000), source: "ai" },
            });
            n++;
          }
          return n;
        });
        return { tool, success: true, data: { rescheduled: count, reason: args.reason } };
      }
      case "update_profile": {
        await prisma.userState.create({ data: { userId, stateType: "profile_suggestion", value: "建议更新 " + args.field + ": " + args.value, source: "ai", confidence: 0.5, decisionWeight: 0.3, impactHint: args.reason } });
        return { tool, success: true, data: { suggestion: "已记录画像更新建议" } };
      }
      default: return { tool, success: false, error: "未实现的确认工具: " + tool };
    }
  } catch (e) { return { tool, success: false, error: (e as Error).message }; }
}
