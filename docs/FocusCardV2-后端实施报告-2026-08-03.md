# Focus Card V2 后端实施报告（2026-08-03）

> 依据：《FocusCardV2-后端开发指令.md》阶段 A→D + 《FocusCard-V2-UI设计规格.html》§5 数据契约
> 状态：**全部完成 ✅**（tsc ✅ / vitest 73/73 ✅ / next build ✅ / API 冒烟全通过 ✅）
> 前端：FocusCardV2 组件已就绪（purpose/departureAt/detail 用 mock），本报告为后端字段对接依据

---

## 阶段 A：数据库（✅ tsc 零错）

| 字段 | 类型 | 说明 |
|------|------|------|
| `Task.purpose` | `String?` | 动机文案（≤50 字），身份层，Inbox 确认可填 + 档案面板可改 |
| `Task.departureAt` | `DateTime?` | 出发时刻，执行层，Today「出发」写入；补记时长默认值来源 |
| `TimeLog.detail` | `String?` | 打卡内容 / 自动完成标记 `'auto'` |

执行：杀 dev server → `prisma db push` + `prisma generate`（可空字段，无数据迁移）。
⚠️ 环境坑：db push 时 safe-delete 干扰 Prisma client 类型生成 → 出现一堆 implicit any → **重新 `prisma generate` 恢复**。

---

## 阶段 B：服务层（✅ tsc 零错）

| # | 文件 | 改动 |
|---|------|------|
| B1 | `src/lib/ai/parser.ts` | INBOX prompt 加 purpose 规则（"从上下文提取目标/意义，不重复标题；拿不准留空"）；items 映射 +purpose（≤50 字）；fallback 加 `extractPurposeFallback`（**保守**：仅"为/为了"明确句式提取，否则 null） |
| B2 | `src/lib/inbox/task-builder.ts` | TaskCreateParams + purpose；单任务/积累型/四层建树全链路透传 |
| B3 | `src/lib/inbox/confirm-service.ts` | `normalizePurpose` 白名单（≤50 字，null 清除）；**父级继承**（子任务 purpose 为空时查父节点非空则填）；**回流扩展**：purpose 与 category/theme 同机制（AI 推断值 ≠ 用户值 → AgentFeedback modifiedField='purpose'） |
| B4 | `src/lib/ai/executor.ts` | AI create_task + purpose 透传（两处） |

---

## 阶段 C：API（✅ tsc 零错 + 登录态冒烟全通过）

| # | 路由 | 改动 |
|---|------|------|
| C1 | `POST /api/tasks` | +purpose（≤50 字，空→null） |
| C2 | `PUT /api/tasks/[id]` | +purpose（null 清除）+ departureAt（出发写回，null 清除）；purpose 变更 → AgentFeedback 回流（context='archive_panel'） |
| C3 | `GET /api/tasks/[id]` | +purpose（**继承后最终值**，向上找最近非空祖先 ≤8 级）+ departureAt |
| C4 | `GET /api/views/today` | currentTask +purpose（继承后）+ departureAt（两个查询点） |
| C5 | `POST /api/tasks/[id]/action` | **start**：departureAt 为空则写当前时间（出发时刻）；**complete**：body 带 `durationMinutes` → 写 TimeLog（起点=departureAt 或最近 start 日志，endedAt=起点+duration） |
| C6 | `POST /api/tasks/[id]/checkin` | +detail（≤200 字）→ TimeLog.detail |
| C7 | **惰性结算** | views/today 读取时：taskType=scheduled 且未完成且最近排期 scheduledEnd < now → 自动 completed + TimeLog（时长=计划时长，detail='auto'）+ DecisionLog（action='auto_complete'）。**无 cron**，打开页面补算，幂等（事务内复查状态） |

---

## 阶段 D：AI 链路（✅ tsc 零错）

| # | 改动 |
|---|------|
| D1 | buildTodayContext 注入 purpose：正在进行任务与今日日程均带（"正在进行：画原理图（动机：为四轴飞行器打好电路基础）"） |
| D2 | Rule11 暂不做（观察 purpose 数据积累，后续再定） |

---

## 验证结果

| 验证 | 结果 |
|------|------|
| tsc --noEmit | ✅ 零错误（全部阶段） |
| vitest | ✅ **73/73**（新增 tests/fcv2-purpose.test.ts 10 用例：purpose 白名单/惰性结算 plannedMin/fallback 保守推断） |
| next build | ✅ 通过（5.7s 编译，47 页） |
| API 冒烟（登录态） | ✅ 全部通过：POST purpose / PUT purpose 回流 / 档案聚合继承 / start→departureAt / complete+durationMinutes 补记（55min=3300s）/ checkin detail / **惰性结算**（过期 scheduled 自动 completed + TimeLog detail='auto' 3600s + DecisionLog）/ today currentTask purpose |
| 冒烟数据清理 | ✅ fcv2smoke 测试账号全关联表删除 |

---

## 前端对接说明（后端就绪后，前端小改）

| 前端现状（mock） | 对接动作 |
|-----------------|---------|
| purpose：mock | 直读 `Task.purpose`（**含父级继承后值**，C3/C4 已返回）；Inbox 确认表单/档案面板可编辑（PUT 白名单已支持） |
| departureAt：本地模拟 | 出发按钮 → action `start`（自动写 departureAt）；回来补记 → action `complete` 带 `durationMinutes` |
| 打卡 detail：本地 state | checkin 带 `detail`（≤200 字）→ TimeLog.detail |
| 忘记确认提示：未做 UI | 惰性结算已自动兜底（过点 scheduled 自动完成）；未确认的普通任务可基于 departureAt 计算已过去时长做提示条 |

## 遗留
- D2 Rule11「动机达成反馈」待 purpose 数据积累后实施（指令标注可选，不阻塞）
- 惰性结算目前仅覆盖 taskType=scheduled 且最近排期已过；积累型/无排期任务不受影响（符合设计）

*实施报告 · Focus Card V2 后端四阶段完成。下一步：前端对接真实数据（小改 5 处）。*
