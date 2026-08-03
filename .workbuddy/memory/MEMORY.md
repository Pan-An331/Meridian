# Task OS 项目长期记忆

## 当前阶段
**V3 后端全链路实施完成（阶段 A-D），待前端对接真实数据**（2026-08-03）

## 项目核心规则
- Task ≠ Schedule，改时间必须通过 Schedule Service 的 $transaction
- LLM 不出 taskId，只出 keyword
- Schedule 是唯一时间数据源
- 用户最终控制权，AI 只建议不强制
- Today 的规则引擎（today-decide/pause-advisor/execution-advisor）是零 AI 依赖核心，不能删
- **一个信息只有一个「家」**：身份 Inbox 定 / 结构 Project 管 / 时间 Plan 管 / 执行 Today 产生 / AI 增强全自动
- **卡片三层规则**：身份→时间→状态，其余进详情（决策 D6）
- **领域 7 类封顶**：course/learning/practice/health/life/external/other（competition 已并入 practice+主题竞赛）
- **主题**：Task.theme 独立字段（索引 [userId,theme]），预设 3 个（考研/竞赛/身材）+自定义≤20字；resolveTheme 拿不准留空不强猜

## 产品理念
- 帮用户过滤未来，不是堆积未来
- 四页面链：Inbox（AI理解入口）→ Plan（时间规划）→ Today（执行驾驶舱）→ Review（复盘学习）+ Project（⑤整理）
- AI 不是聊天机器人，是嵌入页面的不同角色
- **产品定位 = 个人成长系统**（非泛用 GTD），服务成长闭环（决策 D1）
- **北极星**：周完成率；健康指标：堆积率（过滤失败信号）（决策 D2）

## 核心文档位置（SSOT）
- 总控文档（产品宪法）：`G:\Agent_Project\task-manage-sys\Task OS 项目总控文档 V2.0.md`（重写版，替代 V1.0 愿景版）
- 信息架构规范（开发 SSOT）：`G:\Agent_Project\task-manage-sys\docs\任务信息架构规范-V3.md`（V1/V2 已合并进 V3）
- API 清单：`docs/API接口清单.md`
- 开发必读顺序：总控 V2.0 → 信息架构 V3 → API 清单 → AGENTS.md
- 后端实施报告：`docs/V3后端实施报告-2026-08-03.md`（含前端交接表）

## 已完成
- Stage 0-4 + Phase 1/2/3 全部完成（2026-07-31）
- V2 五页面 UI + Project 整理页 + V5 任务层级重构（level/accumulate/积累型打卡/树形大纲）
- 历轮审查修复（时区/事务/IDOR/分类归一等）
- 产品规划：信息展示四关框架、路线图 RICE、任务信息架构 V1/V2/V3、7 个产品决策 D1-D7
- **V3 后端 A-D 全链路（2026-08-03）**：schema（删 5 死字段+theme+索引）/ 迁移脚本 scripts/v3-theme-migration.ts（competition→practice 等，零残留）/ 服务层（colors/parser/confirm/task-builder/新 theme.ts）/ API（search 新增+档案聚合+stats themeBreakdown+metrics+themes 图例+死路由删除）/ AI 链路（theme 分布注入+AgentFeedback 回流双点+Rule10）
- **D5 数据主权补丁（2026-08-03）**：src/lib/export-version.ts（schemaVersion=2 + 迁移映射表），settings 导出 JSON 顶层带版本标记（R4 红线）
- **前端对接第 3 步（2026-08-03）**：TaskArchivePanel 补 body.theme / Review 改消费 themeBreakdown+metrics / GlobalSearch 直读 theme —— 已全部完成，V3 全链路闭环
- **Focus Card V2 后端（2026-08-03）**：schema +Task.purpose/departureAt +TimeLog.detail；服务层 purpose 透传+父级继承+回流；API start 写出发/complete 补记/checkin detail/**惰性结算**（views/today 打开补算过期 scheduled 自动完成，无 cron，detail='auto'）；context 注入动机。报告 docs/FocusCardV2-后端实施报告-2026-08-03.md，前端待对接 5 处
- **Focus Card V2 前端对接（2026-08-03）**：FocusCardV2 钩子带数据（start/complete+duration/checkin+detail/pause+reason）；toCardV2 直读 purpose/departureAt；Inbox/档案面板加动机编辑 —— 已全部完成，**V2 全链路闭环**
- **Review 主题趋势周环比（2026-08-03）**：stats themeBreakdown 每项加 prev {count,percent}|null（上周同主题按任务数聚合）；纯函数 aggregateThemeCounts/buildThemePrev 抽到 src/lib/task/theme.ts；报告 docs/Review主题趋势周环比-实施报告-2026-08-03.md，前端 B5 一行消费
- **SQLite→PG 迁移 + Vercel 部署准备（2026-08-03 晚）**：schema provider=postgresql+binaryTargets(debian-openssl-3.0.x)；便携 PG 16.4 本地迁移成功（scripts/migrate-sqlite-to-pg.mjs + verify-migration.mjs）；20 表 1717 行一致 / 79 测试 / 冒烟全过；git init+commit 6a1c4a4；剩 GitHub push + Neon + Vercel 用户操作。报告 docs/数据库迁移与Vercel部署-实施报告-2026-08-03.md

## 待开发（可选遗留）
- **云部署收尾（需用户账号）**：GitHub 推仓库 → Neon 建库导数据 → Vercel 部署 + 环境变量（DATABASE_URL/AUTH_SECRET/AUTH_TRUST_HOST）
- Focus Card 左栏项目阶段 stages/projectProgress 直读项目树 API（当前 mock）
- 忘记确认提示条（前端 UI，基于 departureAt 补）
- mini-cal 迁入 V2 右栏
- Today Focus Card 主题小徽章、Project 树节点主题徽章（V3 §5.4 可选/克制）
- 导出全量 Task 明细（当前仅聚合视图）
- pattern-mining Rule11 动机达成反馈（观察 purpose 数据积累后实施）
- Review 主题趋势前端消费 prev（后端已就绪，前端显示"—"待切换）
