# Focus Card V2 · 后端开发指令（2026-08-03）

> 依据：《FocusCard-V2-UI设计规格.html》§5 数据契约 + 产品决策（2026-08-03 定稿）
> 前端状态：**已就绪**（FocusCardV2 组件完成，purpose/departureAt/detail 用 mock，等后端字段对接）
> 范围：数据库 → 服务层 → API → AI 链路，按阶段顺序执行，每阶段 tsc 验证

---

## 0. 必读文档（按顺序）

1. `Task OS 项目总控文档 V2.0.md` — §4 技术红线（Schedule 唯一时间源/单一编辑入口等）
2. `docs/任务信息架构规范-V3.md` — §4 后端契约（参考上轮 V3 实施方式）
3. `docs/FocusCard-V2-UI设计规格.html` — **§5 数据契约 + §2 状态机**（本轮核心）
4. `docs/API接口清单.md` — 接口现状
5. `prisma/schema.prisma` — 当前 schema

---

## 阶段 A：数据库（schema）

| # | 字段 | 类型 | 说明 | 归属层 |
|---|------|------|------|--------|
| A1 | `Task.purpose` | `String?` | 动机文案（"为四轴飞行器打好电路基础"），**≤50 字**；身份层，Inbox 确认可填、档案面板可改 | 身份层 |
| A2 | `Task.departureAt` | `DateTime?` | 出发时刻；执行层，Today「出发」写入；补记时长默认值来源 + 忘记确认兜底 | 执行层 |
| A3 | `TimeLog.detail` | `String?` | 打卡内容（背了哪些词/勾选动作）+ 自动完成标记 `'auto'` | 执行层 |

执行：`prisma db push` + `prisma generate`（杀 dev server 后）；无数据迁移（可空字段）。

---

## 阶段 B：服务层

| # | 文件 | 改动 |
|---|------|------|
| B1 | `src/lib/ai/parser.ts` | ParsedTask + `purpose`（可选）：从输入上下文推断（"做四轴飞行器，先画原理图" → "为四轴飞行器打好电路基础"）；**拿不准留空，不强猜**（对齐 resolveTheme 保守原则） |
| B2 | `src/lib/inbox/task-builder.ts` | TaskCreateParams + purpose 透传（单任务/积累型/建树全链路） |
| B3 | `src/lib/inbox/confirm-service.ts` | purpose 白名单（≤50 字，null 清除）；**父级继承**：子任务 purpose 为空时继承父任务 purpose（查父节点，非空则填）；与 category/theme 同机制的修改回流（AI 推断值 ≠ 用户值 → AgentFeedback modifiedField='purpose'） |
| B4 | `src/lib/ai/executor.ts` | AI create_task + purpose 透传 |

---

## 阶段 C：API

| # | 路由 | 改动 |
|---|------|------|
| C1 | `POST /api/tasks` | body + `purpose?`（≤50 字白名单） |
| C2 | `PUT /api/tasks/[id]` | 白名单 + `purpose`（null 清除）、+ `departureAt`（出发写回，null 清除）；purpose 变更走 AgentFeedback 回流（context='archive_panel'） |
| C3 | `GET /api/tasks/[id]`（档案聚合） | + `purpose`（含父级继承后的最终值） |
| C4 | `GET /api/views/today` | currentTask + `purpose`（继承后最终值）+ `departureAt` |
| C5 | `POST /api/tasks/[id]/action` | **出发**：`start` 动作扩展——若 departureAt 为空则写当前时间（出发时刻）；**回来确认**：`complete` 动作扩展——body 可带 `durationMinutes?`（补记时长，有则写 TimeLog endedAt=startedAt+duration，无则按现状） |
| C6 | `POST /api/tasks/[id]/checkin` | body + `detail?`（打卡内容，≤200 字）→ TimeLog.detail |
| C7 | **固定时间型到点自动完成（惰性结算）** | views/today 读取时：taskType=scheduled 且 status 未完成且最近排期 scheduledEnd < now → 自动标记 completed + 写 TimeLog（时长=计划时长，`detail='auto'`）+ DecisionLog 记录（action='auto_complete'）。**无 cron，打开页面时补算** |

---

## 阶段 D：AI 链路

| # | 改动 |
|---|------|
| D1 | `buildAgentContext`：注入任务 purpose（"当前任务「画原理图」——为四轴飞行器打好电路基础"），AI 建议更贴合动机 |
| D2 | pattern-mining（可选，不阻塞）：Rule11「动机达成反馈」暂不做，观察 purpose 数据积累 |

---

## 前端对接说明（后端就绪后，前端只需小改）

| 前端现状（mock） | 后端就绪后 |
|-----------------|-----------|
| purpose：`为「父级」+类型理由` | 直读 `Task.purpose`（继承后值）；Inbox 确认表单/档案面板可编辑 |
| departureAt：本地模拟 | 出发按钮 → action `start` 写回；回来补记 → `complete` 带 durationMinutes |
| 打卡 detail：本地 state | checkin 带 `detail` → TimeLog.detail |
| 忘记确认提示：未做 UI | views/today 返回"出发未确认"任务数据后，前端加提示条（规格 §4） |

---

## 验证要求

- 每阶段：tsc + vitest（新增单测：purpose 白名单/父级继承/purpose 回流/detail 写入/惰性结算）
- `next build`；API 冒烟：POST+PUT purpose、start 写 departureAt、complete 带时长、checkin detail、惰性结算（手动造一条过期 scheduled 任务验证自动完成）
- 环境坑：改 schema 前杀 dev server；`export NODE_OPTIONS=""`；清 `.next/.next-prod`

---

*完成后更新 docs 报告并通知产品验收（与上轮 V3 同流程）。*
