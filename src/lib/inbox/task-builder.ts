import type { InboxDraftItem } from "@/types/inbox";

export interface TaskCreateParams {
  title: string;
  description?: string | null;
  taskType: string;
  importance: number;
  deadline?: Date | null;
  estimatedMinutes?: number | null;
  category?: string | null;
  // V3：主题（独立字段）
  theme?: string | null;
  // Focus Card V2：动机文案（≤50 字）
  purpose?: string | null;
  tags?: string | null;
  parentId?: string | null;
  complexity?: string | null;
  // V5 层级重构
  level?: string | null;        // project | phase | task
  accumulate?: boolean;         // 积累型（Prisma Boolean 非空）
}

export interface BuildResult {
  params: TaskCreateParams[];
  relations: { parentIndex: number; childIndices: number[] } | null;
  /** V5: params[i] 的父 param 索引（-1 = 根）。多级树的关系来源 */
  parents: number[];
}

export function buildTasksFromDraft(draft: InboxDraftItem): BuildResult {
  const hasBreakdown = draft.breakdown?.shouldBreakdown && draft.breakdown.phases.length > 0;

  if (hasBreakdown) {
    return buildProjectWithBreakdown(draft);
  }
  if (draft.accumulate) {
    return buildAccumulateTask(draft);
  }
  return buildSimpleTask(draft);
}

function buildSimpleTask(draft: InboxDraftItem): BuildResult {
  const imp = draft.importance || 3;
  return {
    params: [{
      title: draft.title,
      description: draft.description || null,
      taskType: draft.taskType,
      importance: imp,
      deadline: draft.deadline ? new Date(draft.deadline + "T23:59:59") : null,
      estimatedMinutes: draft.estimatedMinutes || null,
      category: draft.category || null,
      // V3：主题透传
      theme: draft.theme || null,
      // Focus Card V2：动机透传
      purpose: draft.purpose || null,
      complexity: draft.complexity || null,
      level: draft.level || "task",
      accumulate: false,
    }],
    relations: null,
    parents: [-1],
  };
}

/** V5：积累型任务（背单词/健身）——单任务，标记 accumulate + repeatMinutes 语义 */
function buildAccumulateTask(draft: InboxDraftItem): BuildResult {
  const imp = draft.importance || 3;
  const base = buildSimpleTask(draft);
  base.params[0].accumulate = true;
  base.params[0].level = "task";
  base.params[0].taskType = "planned"; // 积累型无截止，按周期排期
  base.params[0].deadline = null;
  // 重复时长：repeatMinutes > estimatedMinutes 时用前者（LLM 给单次时长）
  const repeatMin = draft.repeatMinutes || draft.estimatedMinutes;
  if (repeatMin && repeatMin > 0) {
    base.params[0].estimatedMinutes = repeatMin;
  }
  return base;
}

/**
 * V5：递归四层建树（≤4 层：项目根 → phase → task → 执行项）
 * parents 数组表达多级关系，confirm-service 按 parents 建父子
 */
function buildProjectWithBreakdown(draft: InboxDraftItem): BuildResult {
  const imp = draft.importance || 4;
  const params: TaskCreateParams[] = [];
  const parents: number[] = [];
  const childIndices: number[] = [];

  // 根（项目）—— level 默认 project（有 breakdown 说明是多层项目）
  params.push({
    title: draft.title,
    description: draft.description || null,
    taskType: "planned",
    importance: imp,
    deadline: draft.deadline ? new Date(draft.deadline + "T23:59:59") : null,
    category: draft.category || null,
    // V3：主题透传（根节点继承，子节点同主题）
    theme: draft.theme || null,
    // Focus Card V2：动机透传（根节点持有；子节点由 confirm-service 父级继承）
    purpose: draft.purpose || null,
    complexity: "high",
    level: draft.level === "task" ? "task" : "project",
    accumulate: false,
  });
  parents.push(-1);

  for (const phase of (draft.breakdown?.phases || [])) {
    const phaseIdx = params.length;
    params.push({
      title: phase.title,
      taskType: "planned",
      importance: imp,
      category: draft.category || null,
      theme: draft.theme || null,
      purpose: draft.purpose || null,
      complexity: "medium",
      level: "phase",
      accumulate: false,
    });
    parents.push(0); // 挂在根下

    for (const task of (phase.tasks || [])) {
      const taskIdx = params.length;
      params.push({
        title: task.title,
        taskType: "planned",
        importance: imp,
        estimatedMinutes: task.estimatedMinutes || null,
        category: draft.category || null,
        theme: draft.theme || null,
        purpose: draft.purpose || null,
        level: "task",
        accumulate: false,
      });
      parents.push(phaseIdx);
      childIndices.push(taskIdx);

      // L4 执行项（比任务更小的阶段 → Today 执行清单）
      for (const child of (task.children || [])) {
        params.push({
          title: child.title,
          taskType: "planned",
          importance: imp,
          estimatedMinutes: child.estimatedMinutes || null,
          category: draft.category || null,
          theme: draft.theme || null,
          purpose: draft.purpose || null,
          level: "phase", // 执行项 = 非锚点层（Today 按 parentId 取下一级）
          accumulate: false,
        });
        parents.push(taskIdx);
      }
    }
  }

  return {
    params,
    relations: { parentIndex: 0, childIndices: childIndices.length > 0 ? childIndices : [] },
    parents,
  };
}
