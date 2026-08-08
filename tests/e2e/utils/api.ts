/**
 * API 数据工厂：直接调用业务 API 准备测试数据（加速用例），
 * 使用 Playwright request fixture（自动携带 storageState 登录态）。
 *
 * 所有调用遵守产品红线：
 * - 改时间一律走 /api/plan/apply-decision（Schedule 服务），不直写 Task
 * - 状态变更走 /api/tasks/[id]/action 白名单
 */
import { type APIRequestContext } from "@playwright/test";
import { toLocalISO } from "./helpers";

export interface CreateTaskOpts {
  title: string;
  taskType?: "scheduled" | "planned" | "accumulate" | "learning";
  category?: "course" | "learning" | "practice" | "health" | "life" | "external" | "other";
  importance?: number;
  estimatedMinutes?: number;
  deadline?: string; // YYYY-MM-DD
  parentId?: string;
  theme?: string;
  themeColor?: string;
  purpose?: string;
  level?: "project" | "phase" | "task" | "subtask";
  accumulate?: boolean;
  tags?: string;
  description?: string;
  star?: boolean;
}

/** 创建任务（默认 planned 类型，无排期；scheduled 需另走排期接口） */
export async function createTask(req: APIRequestContext, opts: CreateTaskOpts): Promise<{ id: string; title: string }> {
  const res = await req.post("/api/tasks", {
    data: {
      title: opts.title,
      taskType: opts.taskType ?? "planned",
      importance: opts.importance ?? 3,
      estimatedMinutes: opts.estimatedMinutes ?? 60,
      estimatedUnit: "分钟",
      category: opts.category ?? "learning",
      ...(opts.deadline ? { deadline: toLocalISO(opts.deadline, "23:59") } : {}),
      ...(opts.parentId ? { parentId: opts.parentId } : {}),
      ...(opts.theme ? { theme: opts.theme } : {}),
      ...(opts.themeColor ? { themeColor: opts.themeColor } : {}),
      ...(opts.purpose ? { purpose: opts.purpose } : {}),
      ...(opts.level ? { level: opts.level } : {}),
      ...(opts.accumulate ? { accumulate: true } : {}),
      ...(opts.tags ? { tags: opts.tags } : {}),
      ...(opts.description ? { description: opts.description } : {}),
    },
  });
  if (!res.ok()) {
    throw new Error(`createTask 失败 ${res.status()}: ${await res.text()}`);
  }
  const body = (await res.json()) as { task?: { id: string; title: string }; id?: string; title?: string };
  const id = body.task?.id ?? body.id;
  if (!id) throw new Error(`createTask 未返回 id: ${JSON.stringify(body)}`);
  // POST /api/tasks 白名单不接收 star（执行清单标记需用户主动设置）→ 补 PUT 落库
  if (opts.star) {
    const put = await req.put(`/api/tasks/${id}`, { data: { star: true } });
    if (!put.ok()) throw new Error(`createTask 设 ★ 失败 ${put.status()}: ${await put.text()}`);
  }
  return { id, title: body.task?.title ?? body.title ?? opts.title };
}

/** 排期：通过 apply-decision 添加时间块（唯一合法改时间入口） */
export async function scheduleTask(
  req: APIRequestContext,
  taskId: string,
  opts: { date: string; start: string; end: string },
): Promise<void> {
  const res = await req.post("/api/plan/apply-decision", {
    data: {
      changes: [
        {
          taskId,
          newStart: toLocalISO(opts.date, opts.start),
          newEnd: toLocalISO(opts.date, opts.end),
        },
      ],
    },
  });
  if (!res.ok()) {
    throw new Error(`scheduleTask 失败 ${res.status()}: ${await res.text()}`);
  }
}

/**
 * 排期到【相对当前时间】的时段。
 * 关键：Focus Card 的 currentTask 只取"当前正在进行"的任务 → 排期必须已开始
 * （默认 -30min 开始，持续 60min，保证任何时刻运行都能命中当前任务，BUG-20260807-014）。
 */
export async function scheduleNow(
  req: APIRequestContext,
  taskId: string,
  offsetMin = -30,
  durMin = 60,
): Promise<void> {
  const start = new Date(Date.now() + offsetMin * 60_000);
  const end = new Date(start.getTime() + durMin * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  await scheduleTask(req, taskId, {
    date,
    start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  });
}

/** 任务状态白名单操作 */
export async function actionTask(req: APIRequestContext, taskId: string, action: string): Promise<boolean> {
  const res = await req.post(`/api/tasks/${taskId}/action`, { data: { action } });
  if (!res.ok()) throw new Error(`action(${action}) 失败 ${res.status()}: ${await res.text()}`);
  return true;
}

/** 积累型任务打卡 */
export async function checkinTask(
  req: APIRequestContext,
  taskId: string,
  opts: { minutes?: number; detail?: string; date?: string } = {},
): Promise<void> {
  const res = await req.post(`/api/tasks/${taskId}/checkin`, { data: opts });
  if (!res.ok()) throw new Error(`checkin 失败 ${res.status()}: ${await res.text()}`);
}

/** 获取任务详情（档案面板聚合） */
export async function getTask(req: APIRequestContext, taskId: string): Promise<Record<string, unknown>> {
  const res = await req.get(`/api/tasks/${taskId}`);
  if (!res.ok()) throw new Error(`getTask 失败 ${res.status()}`);
  return (await res.json()) as Record<string, unknown>;
}

/** 查询任务列表（按标题过滤辅助；默认返回活动任务） */
export async function findTaskByTitle(req: APIRequestContext, title: string): Promise<{ id: string; status: string } | null> {
  const res = await req.get("/api/tasks");
  if (!res.ok()) throw new Error(`list tasks 失败 ${res.status()}`);
  // GET /api/tasks 返回裸数组；兼容 {tasks:[]} 两种结构
  const body = (await res.json()) as
    | Array<{ id: string; title: string; status: string }>
    | { tasks?: Array<{ id: string; title: string; status: string }> };
  const list = Array.isArray(body) ? body : body.tasks ?? [];
  const hit = list.find((t) => t.title.includes(title));
  return hit ? { id: hit.id, status: hit.status } : null;
}

/**
 * 最近创建且标题含 prefix 的任务（按 createdAt 倒序取第一个）。
 * 用途：LLM 解析可能改写任务标题，按原标题匹配会失败；前缀+最新可兜底命中。
 */
export async function findLatestTaskByPrefix(req: APIRequestContext, prefix: string): Promise<{ id: string; title: string; status: string } | null> {
  const res = await req.get("/api/tasks");
  if (!res.ok()) throw new Error(`list tasks 失败 ${res.status()}`);
  const body = (await res.json()) as
    | Array<{ id: string; title: string; status: string }>
    | { tasks?: Array<{ id: string; title: string; status: string }> };
  const list = Array.isArray(body) ? body : body.tasks ?? [];
  const hit = list.find((t) => t.title.includes(prefix));
  return hit ?? null;
}

/** AI 是否已配置（决定 AI 相关用例是否可跑） */
export async function isAiConfigured(req: APIRequestContext): Promise<boolean> {
  const res = await req.get("/api/ai-config");
  if (!res.ok()) return false;
  const body = (await res.json()) as { configured?: boolean };
  return body.configured === true;
}

/** 清空当前用户的所有未完成任务（模块内隔离：currentTask 只认"进行中第一个"，共享数据会抢占） */
export async function clearUserTasks(req: APIRequestContext): Promise<void> {
  const res = await req.get("/api/tasks");
  if (!res.ok()) return;
  const body = (await res.json()) as
    | Array<{ id: string; status: string }>
    | { tasks?: Array<{ id: string; status: string }> };
  const list = Array.isArray(body) ? body : body.tasks ?? [];
  for (const t of list) {
    if (t.status === "completed" || t.status === "cancelled" || t.status === "snoozed") continue;
    await req.delete(`/api/tasks/${t.id}`).catch(() => {});
  }
}

/** 今日视图数据（断言联动用） */
export async function fetchTodayView(req: APIRequestContext): Promise<Record<string, unknown>> {
  const res = await req.get("/api/views/today");
  if (!res.ok()) throw new Error(`today view 失败 ${res.status()}`);
  return (await res.json()) as Record<string, unknown>;
}

/** 项目树（断言 Projects 页数据用） */
export async function fetchProjectTree(req: APIRequestContext): Promise<Record<string, unknown>> {
  const res = await req.get("/api/projects/tree");
  if (!res.ok()) throw new Error(`projects tree 失败 ${res.status()}`);
  return (await res.json()) as Record<string, unknown>;
}

/** 周统计（Review 页数据源；Neon 下聚合较慢，放宽超时到 90s） */
export async function fetchStats(req: APIRequestContext, range = "week"): Promise<Record<string, unknown>> {
  const res = await req.get("/api/views/stats", { params: { range }, timeout: 90_000 });
  if (!res.ok()) throw new Error(`stats 失败 ${res.status()}`);
  return (await res.json()) as Record<string, unknown>;
}
