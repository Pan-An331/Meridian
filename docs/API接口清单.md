# Task OS — UI 交互 API 接口清单

> 生成时间：2026-07-31 | 基于源码全面审计 | 共 45 个路由，55+ 个接口

---

## 一、认证模块 (Auth)

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 1 | `POST` | `/api/auth/register` | 注册新用户（触发冷启动 Memory 注入） | `register/page.tsx` |
| 2 | `GET/POST` | `/api/auth/[...nextauth]` | NextAuth.js 登录/登出/Session | `auth-provider.tsx` (自动) |

**POST /api/auth/register**
- Body: `{ email, password, nickname? }`
- Response: `{ id, email }`

---

## 二、任务模块 (Tasks) — 8 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 3 | `GET` | `/api/tasks` | 查询任务列表 | `inbox/page.tsx`, `week-calendar.tsx`, `usePlan.ts` |
| 4 | `POST` | `/api/tasks` | 创建任务（scheduled 类型自动创建 Schedule） | `inbox/page.tsx`, `week-calendar.tsx` |
| 5 | `GET` | `/api/tasks/[id]` | 获取单个任务详情（含 children/timeLogs） | `task-detail-panel.tsx` |
| 6 | `PUT` | `/api/tasks/[id]` | 更新任务（标题/状态/重要性/时间等） | `task-detail-panel.tsx`, `deadline-pool.tsx`, `week-calendar.tsx` |
| 7 | `DELETE` | `/api/tasks/[id]` | 删除任务（已完成不可删） | `task-detail-panel.tsx` |
| 8 | `POST` | `/api/tasks/[id]/action` | 任务操作（start/pause/complete/skip/snooze/delay/postpone/adjust_time/reschedule/delete） | `task-card.tsx`, `FocusTaskCard.tsx` |
| 9 | `GET` | `/api/tasks/[id]/timer` | 获取计时器状态（当前 session + 累计时长 + 日志） | `timer.tsx` |
| 10 | `POST` | `/api/tasks/[id]/timer` | 计时器操作（start/resume/pause/complete） | `task-card.tsx`, `timer.tsx`, `FocusTaskCard.tsx` |
| 11 | `GET` | `/api/tasks/[id]/timeline` | 获取任务执行时间线（日志 + 暂停反馈） | `ExecutionTimeline.tsx` |
| 12 | `GET` | `/api/tasks/[id]/exec-state` | 获取任务执行状态（暂停历史、连续延迟等） | `FocusTaskCard.tsx` |

### 关键接口详情

**GET /api/tasks**
- Query: `?status=xxx&taskType=xxx&temperature=xxx`
- 默认排除 snoozed/cancelled/completed
- Response: `Task[]`（含 children/timeLogs）

**POST /api/tasks**
- Body: `{ title, description?, taskType?, importance?, startTime?, endTime?, deadline?, estimatedMinutes?, tags?, parentId? }`
- scheduled 类型自动调用 `createSchedule()` 创建排程
- Response: `Task` (201)

**POST /api/tasks/[id]/action**
- Body: `{ action, snoozeUntil?, postponeDays?, rescheduleDate?, reason?, newStart?, newEnd? }`
- 支持 11 种 action：
  | action | 效果 |
  |--------|------|
  | `start` | status → in_progress |
  | `pause` | status → not_started + 写 UserObservation + TaskExecutionFeedback |
  | `complete` | status → completed + 统计 actualMinutes |
  | `cancel` | status → cancelled |
  | `reopen` | status → not_started + 清除 completedAt/snoozeUntil |
  | `snooze` | status → snoozed + 设置 snoozeUntil |
  | `delay` | status → delayed |
  | `postpone` | 延期 deadline（按天数） |
  | `adjust_time` | 移动 Schedule 时间 |
  | `reschedule` | 删除所有未来 Schedule + 写 skip 观察 |
  | `delete` | 完全删除（不可逆） |

---

## 三、计划模块 (Plan) — 11 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 13 | `GET` | `/api/plan/week` | 获取周计划（Schedule + Task 聚合） | `usePlan.ts` |
| 14 | `GET` | `/api/plan/day` | 获取日计划 | `usePlan.ts` |
| 15 | `POST` | `/api/plan/move` | 拖拽移动任务时间（写 UserObservation） | `usePlan.ts`, `week-calendar.tsx`, `plan/page.tsx` |
| 16 | `POST` | `/api/plan/delete` | 删除排期项（任务回 UnscheduledPool） | `usePlan.ts` |
| 17 | `POST` | `/api/plan/analyze` | 计划分析（健康分 + 负荷检测 + 建议） | `usePlan.ts` |
| 18 | `POST` | `/api/plan/apply-decision` | 应用 AI/规则决策（批量 moveSchedule） | `usePlan.ts` |
| 19 | `POST` | `/api/plan/decision` | 决策分析（3 条规则：移负载/拆大块/保持） | `decision-panel.tsx` |
| 20 | `GET` | `/api/plan/task/[id]` | 获取任务详情 + 所有 Schedules + 决策历史 | `task-detail-panel.tsx` |
| 21 | `POST` | `/api/plan/repeat` | 批量创建重复排程（addManySchedules） | `week-calendar.tsx` |
| 22 | `POST` | `/api/plan/edit-schedule` | 编辑排程（this/future/all 三范围） | `task-detail-panel.tsx` |
| 23 | `POST` | `/api/plan/delete-schedule` | 删除排程（this/future/all 三范围） | `task-detail-panel.tsx` |

### 关键接口详情

**GET /api/plan/week**
- Query: `?weekStart=2026-07-27`
- Response: `{ success: true, plan: WeeklyPlan }`

**POST /api/plan/move**
- Body: `{ taskId, newStart, newEnd? }`
- 自动写 UserObservation(type="time_modification") 供 Pattern Mining
- Response: `{ success, id, oldStart }`

**POST /api/plan/analyze**
- Body: `{ weekStart }`
- Response: `{ issues: PlanIssue[], suggestions: Suggestion[], healthScore: number }`

**POST /api/plan/decision**
- Body: `{ weekStart }`
- Response: `{ healthScore, issues, options: DecisionOption[] }`
- 3 条规则：Rule A 移负载到空闲日 / Rule B 拆分长 session / Rule C 保持

---

## 四、收集箱模块 (Inbox) — 2 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 24 | `POST` | `/api/inbox/analyze` | AI 解析自然语言输入（LLM 优先 + 规则降级） | `inbox/page.tsx` |
| 25 | `POST` | `/api/inbox/confirm` | 确认 AI 解析草稿并创建任务 | (已实现，前端直接调 POST /api/tasks 替代) |

**POST /api/inbox/analyze**
- Body: `{ content: string }` — 用户输入的自然语言
- 流程：`analyzeInboxInput()` → LLM 解析 → JSON 归一化 → 降级规则回退
- Response: `{ success, data: InboxResponse }`
  - `InboxResponse.items[]`：拆项后的任务草稿（title/description/category/taskType/deadline/...）
  - 置信度：LLM 成功 ≥0.8，降级 = 0.5

---

## 五、视图聚合模块 (Views) — 3 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 26 | `GET` | `/api/views/today` | Today 页面聚合数据（核心，最复杂接口） | `today/page.tsx`, `TodayRecommendedPool.tsx` |
| 27 | `POST` | `/api/views/today/refresh` | 刷新 Today 决策缓存 | (可手动触发) |
| 28 | `GET` | `/api/views/stats` | Review 页面统计数据 + 行为洞察 | `review/page.tsx` |
| 29 | `GET` | `/api/views/week` | 本周视图（scheduled/planned/hot/unfreezing） | (历史遗留路由) |
| 30 | `GET` | `/api/views/week-calendar` | 周历视图（含去重、执行记录） | (历史遗留路由) |

### 核心接口：GET /api/views/today

**返回结构**：
```json
{
  "currentTask": { id, title, scheduledStart/End, elapsedMinutes, remainingMinutes, plannedMinutes, completionPercent },
  "nextTask": { id, title, plannedStart },
  "todayTimeline": [...],
  "mustDo": [...],         // Today 决策必做列表
  "recommended": [...],    // 推荐列表
  "alerts": [...],         // 超时/遗漏/连续延迟告警
  "brief": { greeting, topTasks, stateDescription, suggestion },
  "currentState": { energy, focus, mood, stress },
  "todayStats": { completedCount, totalMinutes },
  "executionAdvice": {...},
  "executionPattern": {...}
}
```

**内部管线**（每次调用触发）：
1. `getOrCreateTodaySummary()` — 创建/更新今日统计
2. `analyzeDailyBehavior()` — 行为学习
3. `runDailyAIPipeline()` — Phase 3 AI 管道（每天一次，检查 UserModel.lastUpdated）

**currentTask 确定优先级**：
1. status=in_progress 的任务
2. 当前时段（scheduledStart ≤ now ≤ scheduledEnd）的排期

### GET /api/views/stats

- Query: `?range=week|month`
- Response:
```json
{
  "range": "week",
  "totalCompleted": 12,
  "totalMinutes": 480,
  "avgCompletionRate": 75,
  "streakDays": 5,
  "dailyBreakdown": [{ date, completedCount, totalMinutes, summaryText }],
  "completedTasks": [...],
  "tagBreakdown": [{ tag, count, minutes }],
  "behavioral": {
    "peakHours": [{ hour, count, label }],
    "efficiencyByTag": [{ tag, ratio, count }],
    "weekOverWeek": { completedChange, minutesChange, direction },
    "procrastinationRate": 20,
    "delayedCount": 3,
    "totalActive": 15
  }
}
```

---

## 六、AI 模块 — 4 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 31 | `POST` | `/api/ai/today-decide` | Today AI 决策对话（用户说什么 AI 给建议） | `TodayAIPanel.tsx` |
| 32 | `GET` | `/api/ai/today-suggest` | Today 页面 AI 建议（自动） | (已实现，未直接调用) |
| 33 | `POST` | `/api/ai/parse` | AI 深度任务解析（单任务） | (已实现，未直接调用) |
| 34 | `POST` | `/api/ai/plan` | AI 排程建议（需传入 taskIds） | (已实现，未直接调用) |
| 35 | `POST` | `/api/ai/ingest` | AI 摄入自然语言并自动创建任务+排程 | (已实现，未直接调用) |

**POST /api/ai/today-decide**
- Body: `{ message: string }` — 用户说的话（如"今天太累了"）
- 流程：收集上下文 → `analyzeToday()` → 意图检测 → Memory 增强 → Decision Engine
- Response: `{ analysis, matchedTask?, options: DecideOption[] }`
  - DecideAction: `reduce_time | postpone | skip | swap | reduce_all | keep_mustdo_only | switch_to_simple`

---

## 七、AI 配置模块 — 1 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 36 | `GET` | `/api/ai-config` | 获取 AI 配置（API Key 脱敏显示） | `settings/page.tsx`, `inbox/page.tsx` |
| 37 | `PUT` | `/api/ai-config` | 保存/更新 AI 配置 | `settings/page.tsx` |

---

## 八、Agent 模块 — 6 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 38 | `POST` | `/api/agent/chat` | Agent 对话（执行 toolCalls + 自动排程） | (已实现) |
| 39 | `POST` | `/api/agent/confirm` | 确认执行需要用户批准的 Tool | (已实现) |
| 40 | `GET` | `/api/agent/memory` | 查询 Agent Memory | (已实现) |
| 41 | `GET` | `/api/agent/memory/dashboard` | AI 记忆仪表盘（Top 15 + Trust Score + peakHours） | `settings/page.tsx`, `review/page.tsx`, `plan/page.tsx` |
| 42 | `POST` | `/api/agent/memory/dashboard` | 管理 Memory（block/pin/unblock/declare） | `settings/page.tsx` |
| 43 | `GET` | `/api/agent/state` | 获取所有有效 UserState | (已实现) |
| 44 | `POST` | `/api/agent/state` | 创建新 UserState | (已实现) |
| 45 | `GET` | `/api/agent/context` | 获取 Agent 完整上下文 | (已实现) |
| 46 | `GET` | `/api/agent/profile` | 获取用户画像（UserProfile） | `settings/page.tsx` |
| 47 | `PUT` | `/api/agent/profile` | 更新用户画像 | `settings/page.tsx` |
| 48 | `GET` | `/api/agent/feedback` | 查询 Agent 反馈记录 | (已实现) |
| 49 | `POST` | `/api/agent/feedback` | 提交 Agent 反馈 | (已实现) |

**GET /api/agent/memory/dashboard**
- Response:
```json
{
  "topMemories": [
    { id, memoryType, content, confidence, source, dimension, status, evidenceCount, importanceScore, contextTags, createdAt, lastUsedAt }
  ],
  "trustScore": 0.65,
  "peakHours": ["9","10","15"],
  "dailyCapacity": 4.5,
  "blockedRevivals": [...]
}
```

**POST /api/agent/memory/dashboard**
- Body: `{ action: "block"|"pin"|"unblock"|"declare", memoryId?, content?, memoryType? }`

---

## 九、用户状态模块 — 1 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 50 | `GET` | `/api/user-state` | 获取今日状态历史 + 当前状态 | `today/page.tsx` |
| 51 | `POST` | `/api/user-state` | 更新用户状态（energy/focus/mood/stress） | `today/page.tsx` |

---

## 十、排程模块 (Schedule) — 1 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 52 | `GET` | `/api/schedule` | 查询排程（按日期/周范围） | (已实现) |
| 53 | `POST` | `/api/schedule` | 创建排程 | (已实现) |
| 54 | `PUT` | `/api/schedule` | 更新排程（时间变更走 moveSchedule） | (已实现) |
| 55 | `DELETE` | `/api/schedule` | 删除排程 | (已实现) |

---

## 十一、每日笔记 — 1 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 56 | `GET` | `/api/daily-note` | 获取每日笔记（按日期/周/月） | `review/page.tsx` |
| 57 | `PUT` | `/api/daily-note` | 保存/更新每日笔记 | (已实现) |

---

## 十二、决策模块 — 1 个接口

| # | 方法 | 路由 | 功能 | UI 调用方 |
|---|------|------|------|-----------|
| 58 | `POST` | `/api/decision/analyze` | 决策分析（自然语言→结构化决策） | (已实现) |
| 59 | `POST` | `/api/decision/confirm` | 执行决策动作 | (已实现) |

---

## 附录 A：按页面的 API 调用关系

```
┌────────────────────────────────────────────────────────────────┐
│ Inbox 页面                                                     │
│  GET /api/tasks          — 加载已有任务                        │
│  GET /api/ai-config      — 判断 AI 是否配置                    │
│  POST /api/inbox/analyze — AI 解析用户输入                     │
│  POST /api/tasks         — 手动创建任务                        │
├────────────────────────────────────────────────────────────────┤
│ Plan 页面                                                      │
│  GET /api/plan/week       — 周计划数据                         │
│  GET /api/tasks           — 任务列表                           │
│  POST /api/plan/analyze   — 计划健康分析                       │
│  POST /api/plan/move      — 拖拽移动                           │
│  POST /api/plan/delete    — 删除排期                           │
│  POST /api/plan/decision  — 决策分析                           │
│  POST /api/plan/apply-decision — 应用决策                      │
│  GET /api/plan/task/[id]  — 任务详情                           │
│  POST /api/plan/repeat    — 重复排程                           │
│  POST /api/plan/edit-schedule — 编辑排程                       │
│  POST /api/plan/delete-schedule — 删除排程                     │
│  PUT /api/tasks/[id]      — 更新任务                           │
│  DELETE /api/tasks/[id]   — 删除任务                           │
│  GET /api/agent/memory/dashboard — 读取 peakHours              │
├────────────────────────────────────────────────────────────────┤
│ Today 页面                                                     │
│  GET /api/views/today     — 核心聚合（57 行逻辑）               │
│  GET /api/user-state      — 状态历史                           │
│  POST /api/user-state     — 更新状态                           │
│  POST /api/ai/today-decide — AI 助手对话                       │
│  GET /api/tasks/[id]/timer — 计时器状态                        │
│  POST /api/tasks/[id]/timer — 计时器操作                       │
│  POST /api/tasks/[id]/action — 任务操作                        │
│  GET /api/tasks/[id]/exec-state — 执行状态                     │
│  GET /api/tasks/[id]/timeline — 时间线                         │
├────────────────────────────────────────────────────────────────┤
│ Review 页面                                                    │
│  GET /api/views/stats     — 统计数据 + 行为洞察                 │
│  GET /api/daily-note      — 每日笔记                           │
│  GET /api/agent/memory/dashboard — AI 记忆数据                 │
├────────────────────────────────────────────────────────────────┤
│ Settings 页面                                                  │
│  GET /api/ai-config       — AI 配置                            │
│  PUT /api/ai-config       — 保存配置                           │
│  GET /api/agent/profile   — 用户画像                           │
│  PUT /api/agent/profile   — 更新画像                           │
│  GET /api/agent/memory/dashboard — 记忆仪表盘                  │
│  POST /api/agent/memory/dashboard — 管理记忆                   │
├────────────────────────────────────────────────────────────────┤
│ 认证                                                           │
│  POST /api/auth/register  — 注册                               │
│  GET/POST /api/auth/[...nextauth] — NextAuth                   │
└────────────────────────────────────────────────────────────────┘
```

## 附录 B：未接前端的已实现 API（可由 Agent/测试/未来 UI 使用）

| 路由 | 说明 |
|------|------|
| `/api/views/week` | 本周视图聚合 |
| `/api/views/week-calendar` | 周日历视图 |
| `/api/views/today/refresh` | 刷新 Today 缓存 |
| `/api/ai/today-suggest` | Today 自动建议 |
| `/api/ai/parse` | 深度任务解析 |
| `/api/ai/plan` | AI 排程 |
| `/api/ai/ingest` | 自然语言摄入 |
| `/api/agent/chat` | Agent 对话 |
| `/api/agent/confirm` | 确认执行 |
| `/api/agent/memory` | Memory 查询 |
| `/api/agent/state` | Agent 状态 |
| `/api/agent/context` | Agent 上下文 |
| `/api/agent/feedback` | Agent 反馈 |
| `/api/schedule` | Schedule 独立 CRUD |
| `/api/decision/analyze` | 决策分析 |
| `/api/decision/confirm` | 决策确认 |
| `/api/inbox/confirm` | Inbox 草稿确认 |

---

## 附录 C：API 设计规范

### 通用规则
- 所有 API（除 auth）需要登录 → 401 `{ error: "请先登录" }`
- 参数校验失败 → 400 `{ error: "xxx" }`
- 统一使用 `getServerSession()` 获取当前用户
- Path param 用 Next.js 16 async `params: Promise<{ id: string }>`

### 数据源核心原则（不可违反）
1. **Task ≠ Schedule** — 任务不改时间，时间由 Schedule Service `$transaction` 管理
2. **LLM 不出 taskId** — 只出 keyword，后端 Resolver 解析
3. **Schedule 是唯一时间数据源**
4. **Today 规则引擎不可删** — 零 AI 依赖底线

---

*共计 12 个模块、45 个路由文件、59 个 HTTP 接口（GET/POST/PUT/DELETE），其中 31 个被前端页面直接调用。*
