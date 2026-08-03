// Step18 — Today AI 规则决策引擎（上下文增强版）
import { prisma } from "@/lib/prisma";

export interface TodayDecideInput {
  message: string;
  userId: string;
  currentTask: { id: string; title: string; plannedMinutes: number; importance: number; deadline: string | null; elapsedMinutes?: number } | null;
  todayTasks: { taskId: string; title: string; estimatedMinutes: number | null; importance: number; deadline: string | null }[];
  userState: { energy: string | null; focus: string | null; stress: string | null } | null;
  context?: { totalTodayTasks: number; completedToday: number; totalPausesToday: number; stateChanged: boolean; previousEnergy: string | null };
}

export interface DecideOption {
  id: string; title: string; description: string; impact: "low" | "medium" | "high"; recommended: boolean; action: DecideAction;
}
export type DecideAction =
  | { type: "reduce_time"; taskId: string; factor: number }
  | { type: "postpone"; taskId: string; days: number }
  | { type: "skip"; taskId: string }
  | { type: "swap"; taskId: string; withTaskId: string }
  | { type: "reduce_all"; factor: number }
  | { type: "keep_mustdo_only" }
  | { type: "switch_to_simple"; taskId: string };

export interface TodayDecideResult { analysis: string; matchedTask: { taskId: string; title: string } | null; options: DecideOption[]; }

// ── Helpers ──
interface NormTask { taskId: string; title: string; estimatedMinutes: number; importance: number; deadline: string | null; }
function toNorm(t: { taskId: string; title: string; estimatedMinutes?: number | null; importance?: number; deadline?: string | null }): NormTask {
  return { taskId: t.taskId, title: t.title, estimatedMinutes: t.estimatedMinutes || 0, importance: t.importance || 3, deadline: t.deadline || null };
}

function buildContextSummary(input: TodayDecideInput): string {
  const parts: string[] = [];
  if (input.currentTask) {
    parts.push(`当前正在执行「${input.currentTask.title}」`);
    if (input.currentTask.elapsedMinutes) parts.push(`已投入 ${input.currentTask.elapsedMinutes} 分钟`);
  }
  if (input.context) {
    parts.push(`今日共 ${input.context.totalTodayTasks} 个任务`);
    if (input.context.totalPausesToday > 0) parts.push(`今日已暂停 ${input.context.totalPausesToday} 次`);
    if (input.context.stateChanged && input.context.previousEnergy) {
      const now = input.userState?.energy;
      if (now && now !== input.context.previousEnergy) {
        parts.push(`状态有变化（${input.context.previousEnergy} → ${now}）`);
      }
    }
  }
  return parts.join(" · ");
}

// ── Intent ──
type Intent = "skip" | "postpone" | "too_hard" | "state_bad" | "swap" | "unknown";
function detectIntent(m: string): { intent: Intent; keyword: string } {
  const l = m.toLowerCase();
  if (l.includes("不做")||l.includes("不想")||l.includes("跳过")||l.includes("取消")) return { intent: "skip", keyword: extractKw(m) };
  // 修复："明天"单独出现可能是截止提醒（"明天要交作业"），必须带延期语义词才判定为延期
  if (l.includes("延期")||l.includes("推迟")||l.includes("改天")||/明天(再|说|做|处理|搞|弄|来)/.test(l)) return { intent: "postpone", keyword: extractKw(m) };
  if (l.includes("太难")||l.includes("不会")||l.includes("搞不定")||l.includes("复杂")) return { intent: "too_hard", keyword: extractKw(m) };
  if (l.includes("状态不好")||l.includes("累了")||l.includes("精力")||l.includes("不想动")) return { intent: "state_bad", keyword: "" };
  if (l.includes("换")||l.includes("交换")||l.includes("换成")||l.includes("先做")) return { intent: "swap", keyword: extractKw(m) };
  return { intent: "unknown", keyword: extractKw(m) };
}
function extractKw(m: string): string { return m.replace(/不做|不想|跳过|取消|延期|推迟|明天|改天|太难|不会|搞不定|复杂|交换|换成|先做|状态不好|累了|精力|不想动/g,"").trim()||m; }
function findTask(kw: string, tasks: { taskId: string; title: string }[]): { taskId: string; title: string } | null {
  if (!kw||!tasks.length) return tasks[0]||null;
  for (const t of tasks) if (t.title.includes(kw)) return t;
  return tasks[0]||null;
}

// ── Option generators ──
function genSkip(task: NormTask): DecideOption[] {
  const dl = task.deadline ? new Date(task.deadline) : null; const urgent = dl && dl.getTime() < Date.now() + 2*86400000;
  return [
    { id:"skip-reduce", title:`减少「${task.title}」时间`,description:"保留任务但降低预期时长，减轻压力",impact:"low",recommended:true,action:{type:"reduce_time",taskId:task.taskId,factor:0.5}},
    { id:"skip-postpone", title:`延期到明天`,description:"今天先不做，明天继续",impact:urgent?"high":"medium",recommended:false,action:{type:"postpone",taskId:task.taskId,days:1}},
    { id:"skip-swap", title:"换成其他任务",description:"从今日重点中选择替代任务",impact:task.importance>=4?"high":"low",recommended:false,action:{type:"skip",taskId:task.taskId}},
  ];
}
function genPostpone(task: NormTask): DecideOption[] { return [
  { id:"p1", title:"延期到明天",description:"明天继续执行",impact:"low",recommended:true,action:{type:"postpone",taskId:task.taskId,days:1}},
  { id:"p3", title:"延期3天",description:"本周稍后处理",impact:task.importance>=4?"high":"medium",recommended:false,action:{type:"postpone",taskId:task.taskId,days:3}},
];}
function genTooHard(task: NormTask): DecideOption[] { return [
  { id:"h-reduce", title:"降低任务量",description:"只完成核心部分，预计时间减半",impact:"low",recommended:true,action:{type:"reduce_time",taskId:task.taskId,factor:0.5}},
  { id:"h-postpone", title:"延期到明天",description:"休息一下，明天再处理",impact:"medium",recommended:false,action:{type:"postpone",taskId:task.taskId,days:1}},
  { id:"h-simple", title:"切换到简单任务",description:"先做容易完成的事情热身",impact:"low",recommended:false,action:{type:"switch_to_simple",taskId:task.taskId}},
];}
function genStateBad(ct: { taskId: string; title: string } | null): DecideOption[] { const o: DecideOption[] = [
  { id:"s-reduce", title:"减少所有任务量",description:"今天的任务预计时间减半",impact:"low",recommended:true,action:{type:"reduce_all",factor:0.5}},
]; if(ct) o.push({ id:"s-postpone", title:`延期「${ct.title}」`,description:"先休息，当前任务移到明天",impact:"medium",recommended:false,action:{type:"postpone",taskId:ct.taskId,days:1}});
  o.push({ id:"s-mustdo", title:"只保留今日必须完成",description:"只做最重要的任务",impact:"medium",recommended:false,action:{type:"keep_mustdo_only"}}); return o; }

// ── Main engine ──
export async function analyzeToday(input: TodayDecideInput): Promise<TodayDecideResult> {
  const { message, currentTask, todayTasks, userState } = input;
  const { intent, keyword } = detectIntent(message);
  const ctxSummary = buildContextSummary(input);

  const allTasks: NormTask[] = [
    ...(currentTask ? [toNorm({ taskId: currentTask.id, title: currentTask.title, estimatedMinutes: currentTask.plannedMinutes, importance: currentTask.importance, deadline: currentTask.deadline })] : []),
    ...todayTasks.map(toNorm),
  ];
  const matched = findTask(keyword, allTasks.map(t => ({ taskId: t.taskId, title: t.title })));

  let analysis = "";
  let options: DecideOption[] = [];

  switch (intent) {
    case "skip": {
      const target = allTasks.find(t => t.taskId === matched?.taskId) || allTasks[0];
      if (!target) { analysis = "没有找到匹配的任务"; options = []; }
      else {
        const dlInfo = target.deadline ? `截止 ${new Date(target.deadline).toLocaleDateString("zh-CN")}` : "无截止日期";
        analysis = `📊 ${ctxSummary}\n\n检测到你想跳过「${target.title}」。该任务重要性 ${target.importance}/5，${dlInfo}。`;
        if (currentTask?.elapsedMinutes && currentTask.id === target.taskId) {
          analysis += `\n已投入 ${currentTask.elapsedMinutes} 分钟，进度 ${currentTask.plannedMinutes > 0 ? Math.round(currentTask.elapsedMinutes / currentTask.plannedMinutes * 100) : 0}%。`;
        }
        options = genSkip(target);
      }
      break;
    }
    case "postpone": {
      const target = allTasks.find(t => t.taskId === matched?.taskId) || allTasks[0];
      if (!target) { analysis = "没有找到匹配的任务"; options = []; }
      else { analysis = `📊 ${ctxSummary}\n\n检测到你想延期「${target.title}」。`; options = genPostpone(target); }
      break;
    }
    case "too_hard": {
      const target = allTasks.find(t => t.taskId === matched?.taskId) || allTasks[0];
      if (!target) { analysis = "没有找到匹配的任务"; options = []; }
      else { analysis = `📊 ${ctxSummary}\n\n检测到你觉得「${target.title}」有困难。`; options = genTooHard(target); }
      break;
    }
    case "state_bad": {
      const stateDesc = userState ? [userState.energy==="low"?"精力偏低":"",userState.stress==="high"?"压力偏高":""].filter(Boolean).join("，") : "";
      analysis = `📊 ${ctxSummary}\n\n检测到状态不太好${stateDesc?`（${stateDesc}）`:""}。`;
      if (input.context?.totalPausesToday && input.context.totalPausesToday >= 2) {
        analysis += `\n今日已暂停 ${input.context.totalPausesToday} 次，建议适当减少任务量。`;
      }
      options = genStateBad(currentTask ? { taskId: currentTask.id, title: currentTask.title } : null);
      break;
    }
    case "swap": {
      if (todayTasks.length < 2) { analysis = `📊 ${ctxSummary}\n\n今天任务不多，不需要交换`; options = []; }
      else {
        const target = matched || { taskId: todayTasks[0].taskId, title: todayTasks[0].title };
        const other = todayTasks.find(t => t.taskId !== target.taskId);
        if (other) { analysis = `📊 ${ctxSummary}\n\n可以将「${target.title}」与「${other.title}」对换。`; options = [{ id:"swap-do", title:`与「${other.title}」交换`,description:`先做${other.title}，稍后做${target.title}`,impact:"low",recommended:true,action:{type:"swap",taskId:target.taskId,withTaskId:other.taskId}}]; }
        else { analysis = "未找到可交换的任务"; options = []; }
      }
      break;
    }
    default: {
      analysis = `📊 ${ctxSummary}\n\n`;
      if (matched) { const target = allTasks.find(t => t.taskId === matched.taskId); analysis += `你想调整「${matched.title}」。以下是常见调整方式：`; if (target) options = genSkip(target); }
      else if (currentTask) { analysis += `当前任务「${currentTask.title}」的调整建议：`; options = genSkip(toNorm({ taskId: currentTask.id, title: currentTask.title, estimatedMinutes: currentTask.plannedMinutes, importance: currentTask.importance, deadline: currentTask.deadline })); }
      else { analysis += "请更具体地描述，例如：「不想做数学」「延期实验报告」「状态不好」"; options = []; }
    }
  }

  // ── Memory 增强：读取用户偏好和行为模式，追加到分析中 ──
  try {
    const memories = await prisma.agentMemory.findMany({
      where: {
        userId: input.userId,
        status: "active",
        memoryType: { in: ["preference", "behavior_pattern"] },
      },
      orderBy: { importance: "desc" },
      take: 8,
    });

    if (memories.length > 0) {
      // 提取当前上下文关键词：任务标题 + 意图 + 状态
      const taskTitle = input.currentTask?.title || matched?.title || "";
      const contextTerms = taskTitle
        .split(/[\s，,。.\n；;！!？?]+/)
        .filter(t => t.length > 1);

      // 匹配相关记忆：内容包含当前任务关键词，或与当前意图相关
      const intentWords: Record<string, string[]> = {
        skip: ["跳过", "不做", "放弃"],
        postpone: ["延期", "推迟", "明天"],
        too_hard: ["困难", "复杂", "太难"],
        state_bad: ["精力", "状态", "休息", "疲惫"],
        swap: ["换", "交换", "替代"],
      };
      const intentKw = [intent, ...(intentWords[intent] || [])];

      const relevant = memories.filter(m => {
        const lower = m.content.toLowerCase();
        // 内容匹配任务关键词
        if (contextTerms.some(t => lower.includes(t.toLowerCase()))) return true;
        // 内容匹配意图关键词
        if (intentKw.some(kw => lower.includes(kw))) return true;
        // preference 类型始终相关（用户偏好全局适用）
        if (m.memoryType === "preference") return true;
        return false;
      });

      if (relevant.length > 0) {
        const typeLabel: Record<string, string> = {
          preference: "偏好",
          behavior_pattern: "行为模式",
        };
        analysis += "\n\n💡 记忆建议：";
        for (const m of relevant.slice(0, 4)) {
          const label = typeLabel[m.memoryType] || m.memoryType;
          analysis += `\n- [${label}] ${m.content}`;
        }
      }
    }
  } catch {
    // 记忆查询失败时静默忽略，不破坏决策引擎
  }

  // ── Phase 3: Decision Engine 增强 — 读取 UserModel 提供行为建议 ──
  try {
    const { getTopMemories } = await import("@/lib/ai/memory-manager");
    const { makeDecision } = await import("@/lib/ai/decision-engine");

    const um = await prisma.userModel.findUnique({ where: { userId: input.userId } });
    if (um && input.currentTask) {
      const top = await getTopMemories(input.userId, 5);
      const decision = await makeDecision({
        taskId: input.currentTask.id,
        taskTitle: input.currentTask.title,
        taskImportance: input.currentTask.importance || 3,
        taskCategory: null,
        deadline: input.currentTask.deadline ? new Date(input.currentTask.deadline) : null,
        userModel: {
          peakHours: um.peakHours ? JSON.parse(um.peakHours) : [],
          dailyCapacity: um.dailyCapacity || 4,
          taskChunk: um.taskChunk,
          commonFailures: um.commonFailures ? JSON.parse(um.commonFailures) : [],
          trustScore: um.trustScore || 0.5,
        },
        currentState: {
          energy: input.userState?.energy || null,
          focus: input.userState?.focus || null,
          mood: null,
          stress: input.userState?.stress || null,
        },
        relevantMemories: top.map(m => ({
          id: m.id, content: m.content, source: m.source,
          confidence: m.confidence, dimension: m.dimension, memoryType: m.memoryType,
        })),
      });

      if (decision.reasoning.length > 0) {
        analysis += `\n\n🎯 AI 分析：${decision.reason}`;
        for (const r of decision.reasoning.slice(0, 3)) {
          if (r) analysis += `\n- ${r}`;
        }
      }
    }
  } catch {
    // Decision Engine query fails silently
  }

  return { analysis, matchedTask: matched, options };
}
