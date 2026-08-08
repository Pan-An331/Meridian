# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests\e2e\modules\04-today.spec.ts >> 04 Today 执行页 >> T10 清单型任务：子任务勾选与新增（严格校验，防学习型误判）
- Location: tests\e2e\modules\04-today.spec.ts:213:7

# Error details

```
TypeError: apiRequestContext.get: Invalid URL
```

# Test source

```ts
  71  |   const res = await req.post("/api/plan/apply-decision", {
  72  |     data: {
  73  |       changes: [
  74  |         {
  75  |           taskId,
  76  |           newStart: toLocalISO(opts.date, opts.start),
  77  |           newEnd: toLocalISO(opts.date, opts.end),
  78  |         },
  79  |       ],
  80  |     },
  81  |   });
  82  |   if (!res.ok()) {
  83  |     throw new Error(`scheduleTask 失败 ${res.status()}: ${await res.text()}`);
  84  |   }
  85  | }
  86  | 
  87  | /**
  88  |  * 排期到【相对当前时间】的时段。
  89  |  * 关键：Focus Card 的 currentTask 只取"当前正在进行"的任务 → 排期必须已开始
  90  |  * （默认 -30min 开始，持续 60min，保证任何时刻运行都能命中当前任务，BUG-20260807-014）。
  91  |  */
  92  | export async function scheduleNow(
  93  |   req: APIRequestContext,
  94  |   taskId: string,
  95  |   offsetMin = -30,
  96  |   durMin = 60,
  97  | ): Promise<void> {
  98  |   const start = new Date(Date.now() + offsetMin * 60_000);
  99  |   const end = new Date(start.getTime() + durMin * 60_000);
  100 |   const pad = (n: number) => String(n).padStart(2, "0");
  101 |   const date = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  102 |   await scheduleTask(req, taskId, {
  103 |     date,
  104 |     start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
  105 |     end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  106 |   });
  107 | }
  108 | 
  109 | /** 任务状态白名单操作 */
  110 | export async function actionTask(req: APIRequestContext, taskId: string, action: string): Promise<boolean> {
  111 |   const res = await req.post(`/api/tasks/${taskId}/action`, { data: { action } });
  112 |   if (!res.ok()) throw new Error(`action(${action}) 失败 ${res.status()}: ${await res.text()}`);
  113 |   return true;
  114 | }
  115 | 
  116 | /** 积累型任务打卡 */
  117 | export async function checkinTask(
  118 |   req: APIRequestContext,
  119 |   taskId: string,
  120 |   opts: { minutes?: number; detail?: string; date?: string } = {},
  121 | ): Promise<void> {
  122 |   const res = await req.post(`/api/tasks/${taskId}/checkin`, { data: opts });
  123 |   if (!res.ok()) throw new Error(`checkin 失败 ${res.status()}: ${await res.text()}`);
  124 | }
  125 | 
  126 | /** 获取任务详情（档案面板聚合） */
  127 | export async function getTask(req: APIRequestContext, taskId: string): Promise<Record<string, unknown>> {
  128 |   const res = await req.get(`/api/tasks/${taskId}`);
  129 |   if (!res.ok()) throw new Error(`getTask 失败 ${res.status()}`);
  130 |   return (await res.json()) as Record<string, unknown>;
  131 | }
  132 | 
  133 | /** 查询任务列表（按标题过滤辅助；默认返回活动任务） */
  134 | export async function findTaskByTitle(req: APIRequestContext, title: string): Promise<{ id: string; status: string } | null> {
  135 |   const res = await req.get("/api/tasks");
  136 |   if (!res.ok()) throw new Error(`list tasks 失败 ${res.status()}`);
  137 |   // GET /api/tasks 返回裸数组；兼容 {tasks:[]} 两种结构
  138 |   const body = (await res.json()) as
  139 |     | Array<{ id: string; title: string; status: string }>
  140 |     | { tasks?: Array<{ id: string; title: string; status: string }> };
  141 |   const list = Array.isArray(body) ? body : body.tasks ?? [];
  142 |   const hit = list.find((t) => t.title.includes(title));
  143 |   return hit ? { id: hit.id, status: hit.status } : null;
  144 | }
  145 | 
  146 | /**
  147 |  * 最近创建且标题含 prefix 的任务（按 createdAt 倒序取第一个）。
  148 |  * 用途：LLM 解析可能改写任务标题，按原标题匹配会失败；前缀+最新可兜底命中。
  149 |  */
  150 | export async function findLatestTaskByPrefix(req: APIRequestContext, prefix: string): Promise<{ id: string; title: string; status: string } | null> {
  151 |   const res = await req.get("/api/tasks");
  152 |   if (!res.ok()) throw new Error(`list tasks 失败 ${res.status()}`);
  153 |   const body = (await res.json()) as
  154 |     | Array<{ id: string; title: string; status: string }>
  155 |     | { tasks?: Array<{ id: string; title: string; status: string }> };
  156 |   const list = Array.isArray(body) ? body : body.tasks ?? [];
  157 |   const hit = list.find((t) => t.title.includes(prefix));
  158 |   return hit ?? null;
  159 | }
  160 | 
  161 | /** AI 是否已配置（决定 AI 相关用例是否可跑） */
  162 | export async function isAiConfigured(req: APIRequestContext): Promise<boolean> {
  163 |   const res = await req.get("/api/ai-config");
  164 |   if (!res.ok()) return false;
  165 |   const body = (await res.json()) as { configured?: boolean };
  166 |   return body.configured === true;
  167 | }
  168 | 
  169 | /** 清空当前用户的所有未完成任务（模块内隔离：currentTask 只认"进行中第一个"，共享数据会抢占） */
  170 | export async function clearUserTasks(req: APIRequestContext): Promise<void> {
> 171 |   const res = await req.get("/api/tasks");
      |                         ^ TypeError: apiRequestContext.get: Invalid URL
  172 |   if (!res.ok()) return;
  173 |   const body = (await res.json()) as
  174 |     | Array<{ id: string; status: string }>
  175 |     | { tasks?: Array<{ id: string; status: string }> };
  176 |   const list = Array.isArray(body) ? body : body.tasks ?? [];
  177 |   for (const t of list) {
  178 |     if (t.status === "completed" || t.status === "cancelled" || t.status === "snoozed") continue;
  179 |     await req.delete(`/api/tasks/${t.id}`).catch(() => {});
  180 |   }
  181 | }
  182 | 
  183 | /** 今日视图数据（断言联动用） */
  184 | export async function fetchTodayView(req: APIRequestContext): Promise<Record<string, unknown>> {
  185 |   const res = await req.get("/api/views/today");
  186 |   if (!res.ok()) throw new Error(`today view 失败 ${res.status()}`);
  187 |   return (await res.json()) as Record<string, unknown>;
  188 | }
  189 | 
  190 | /** 项目树（断言 Projects 页数据用） */
  191 | export async function fetchProjectTree(req: APIRequestContext): Promise<Record<string, unknown>> {
  192 |   const res = await req.get("/api/projects/tree");
  193 |   if (!res.ok()) throw new Error(`projects tree 失败 ${res.status()}`);
  194 |   return (await res.json()) as Record<string, unknown>;
  195 | }
  196 | 
  197 | /** 周统计（Review 页数据源；Neon 下聚合较慢，放宽超时到 90s） */
  198 | export async function fetchStats(req: APIRequestContext, range = "week"): Promise<Record<string, unknown>> {
  199 |   const res = await req.get("/api/views/stats", { params: { range }, timeout: 90_000 });
  200 |   if (!res.ok()) throw new Error(`stats 失败 ${res.status()}`);
  201 |   return (await res.json()) as Record<string, unknown>;
  202 | }
  203 | 
```