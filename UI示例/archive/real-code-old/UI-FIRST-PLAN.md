# Task OS · UI 先行实施方案（Design-Driven）

> 策略：**真实壳 + mock 数据层** —— 路由/导航/设置联动/宽度规则全部真实，仅页面数据用 mock，验收后逐页对接 Prisma。
> 提出：用户 · 方案评审：Senior Developer

---

## 一、策略结论

✅ **认可**。理由：
1. 视觉先行 → 用户能提前在真实交互环境中验证设计（切换导航/版式、看宽度留白），比静态稿反馈质量高得多
2. 壳真实 → 合并期只换"数据源"，路由/交互/状态管理零返工
3. 风险可控 → mock 层隔离，随时可回退

三条纪律（防返工）：
1. **壳必须真实**（路由、导航、设置联动、宽度容器）
2. **组件 props 即契约**（UI 组件只依赖定义的接口，不直接 import 数据库）
3. **mock 覆盖边界**（空 / 加载 / 超长 / 截止临近 / 多任务）

---

## 二、真实壳 vs mock 层 划分

### 真实（直接实现，进 src/）
| 模块 | 说明 |
|------|------|
| 导航壳 DashboardShell / Sidebar / Topbar / MobileNav | 按设置渲染，真实切换 |
| 设置「导航与版式」卡 + 偏好存储 | localStorage + CustomEvent 广播 |
| 内容宽度容器 ContentContainer | 720 / 1000 / 1100 居中规则 |
| 页面路由 today / inbox / plan / review / settings | App Router 真实路由 |
| 页面切换动画 / Ctrl+↑↓ | 真实实现 |

### mock（页面数据，隔离在 `src/mocks/`）
| 模块 | 说明 |
|------|------|
| `src/mocks/today.ts` | 当前任务（三种类型示例）、今日路线、状态、AI 建议 |
| `src/mocks/inbox.ts` | 输入后 AI 整理结果（3 卡片） |
| `src/mocks/plan.ts` | 周历任务块、本周截止 |
| `src/mocks/review.ts` | 战报数据、产出日记 |
| `src/mocks/settings.ts` | 用户资料、作息、AI 控制中心 |

> mock 数据形态 = UI 组件 props 形态（契约），由 `src/types/ui.ts` 统一定义。

---

## 三、UI 接口契约 ↔ Prisma 映射表（合并期按此对接）

| UI 数据形态（`src/types/ui.ts`） | 来源（Prisma 模型 + 聚合） |
|--------------------------------|--------------------------|
| `FocusCardData`（三种类型） | `Task`（taskType/status/startTime/endTime/deadline/estimatedMinutes/actualMinutes）+ `Task.children`（清单/知识点项） |
| `ChecklistItem` | `Task`（parentId 子任务：title/completedAt） |
| 计时圆环（45:22/领先/剩余） | `TimeLog`（durationSeconds 聚合）+ `Schedule` 计划 |
| `TodayRouteItem`（今日路线） | `Schedule`（scheduledStart/End）+ `Task.title` + `TodayDecision.mustDo` |
| 状态仪表盘（精力/目标/状态/压力） | `UserState`（stateType: energy/goal/mood/stress，value） |
| `ExecutionAdvice`（AI 执行建议） | `Task.scheduleAdvice` + `UserModel.trustScore` + `AgentMemory` |
| AI 调整助手（排期建议/采纳） | `TodayDecision.recommended/reason` + `AgentFeedback` |
| Inbox AI 整理卡 | `TaskDraft` + `TaskDraftItem`（status: WAIT_CONFIRM） |
| Review 战报（本周之最/关键词） | `DailySummary` + `TimeLog` 聚合 + `Task.completedAt` 分组 |
| Review 产出日记 | `Task.completedAt` 按天分组（实践/学习等 category） |
| Plan 周历任务块 | `Schedule` + `Task.category`（DOMAINS 色） |
| 本周截止卡 | `Task.deadline` 未来 7 天 + 剩余天数梯度色 |
| 设置·账户资料 | `User`（nickname/email） |
| 设置·时间作息 | `UserProfile`（wakeTime/sleepTime/peakEnergy/fixedBlocks） |
| 设置·AI 控制中心 | `AIConfig`（provider/baseUrl/model）+ 前端偏好 |
| 设置·导航与版式 | localStorage（UI 偏好，不进库） |

> 关键：**mock 阶段字段命名即契约**，对接时只改数据源，不改组件。

---

## 四、落地步骤

**阶段 0：地基（真实壳）**
1. `src/lib/ui-preferences.ts` + `src/lib/navigation.ts`（路径单数据源）
2. 导航三件套 Sidebar/Topbar/MobileNav + DashboardShell + ContentContainer
3. 设置页「导航与版式」卡 + 事件广播
4. `(dashboard)/layout.tsx` 默认落地 /today
→ 验收：切换导航/版式、宽度规则、Ctrl+↑↓ 全部真实可用

**阶段 1：页面 UI（mock 数据）**
5. `src/types/ui.ts` 契约 + `src/mocks/*`
6. 按预览设计稿还原：Today（Focus Card 两版式 + 状态/路线/AI 助手）、Inbox、Plan、Review、Settings
→ 验收：五个页面视觉与 `导航栏方案演示.html` 一致，交互可点

**阶段 2：逐页对接（mock → 真实数据）**
7. Today（Task/Schedule/TimeLog/UserState）→ 8. Inbox（TaskDraft）→ 9. Plan（Schedule/Task）→ 10. Review（DailySummary 聚合）→ 11. Settings（User/UserProfile/AIConfig）
→ 每页：mock 摘除 → API/服务层接入 → 边界态回归（空/加载/超时）

**阶段 3：收尾**
12. 删除 mock、清理 preview 残留、`npm run build` 55 页零错误、补单测（clampProgress/偏好/宽度判断）

---

## 五、验收清单（阶段 0 完成即达）

- [ ] 设置页切换 侧栏/顶栏 → 桌面立即切换，刷新保留
- [ ] 设置页切换 Focus Card 一栏/两栏 → Today 即时切换
- [ ] Today/Plan 侧栏 1000 / 顶栏 1100 居中；其余 720
- [ ] 移动端底部 4 tab，设置从页头齿轮
- [ ] Ctrl+↑↓ 循环切页
- [ ] 页面内容全为 mock（无任何数据库查询），可独立跑通
