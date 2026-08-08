# BUGS.md — Meridian（Task OS）Bug 记录文档

> **维护纪律**：每修复一个 Bug 后**立即**记录，格式见下文"条目模板"；新发现未修复的问题登记到「待修复」区。
> 按 **所属模块 + 时间倒序** 组织；每条标注状态：`已修复` / `待修复`。
> 与测试协同：E2E 测试发现的缺陷（`e2e-results/report.md`）修复后，在本文档记录并回填测试回归结果。
> 编号规则：`BUG-<YYYYMMDD>-<序号>`（同日递增）。

---

## 📊 汇总统计

| 模块 | 已修复 | 待修复 |
| --- | --- | --- |
| 环境配置/认证 | 1 | — |
| E2E 脚本/隔离 | 20 | — |
| 产品代码（排期/档案/认证/并发/统计/账户/Today/计时） | 13 | — |
| 任务档案面板 | — | 1 |
| Plan 规划 | — | 1 |
| Review 复盘 | — | 1 |
| Today 执行 | — | 1 |
| AI / 代码清理 | — | 1 |
| 合计 | **34** | **4** |

> 统计随每次修复更新。最新更新：2026-08-08 13:40（BUG-050 mustDo 兜底卡勾选失效 / BUG-052 planned 误判固定时间卡）。

---

## ✅ 已修复

### 2026-08-07（E2E 回归测试阶段发现并修复 —— 环境/配置/脚本类）

#### BUG-20260807-007：AUTH_SECRET 缺失导致登录全线失败（环境配置）
- **状态**：已修复
- **所属模块**：环境配置 / 认证
- **复现步骤**：.env 仅有 DATABASE_URL；登录提交后跳转 `/api/auth/error`，dev 日志 `[auth][error] MissingSecret`
- **根因分析**：迁移 Neon 时 .env 漏配 `AUTH_SECRET`（NextAuth v5 必需），且 dev 进程为旧进程残留未加载新环境
- **修复方案**：生成 32 字节随机 hex 写入 `.env`（AUTH_SECRET + AUTH_TRUST_HOST=true）；彻底杀掉 3000 端口残留进程（taskkill /PID 35080 /T /F）后重启 dev server
- **代码位置**：`F:\Meridian\.env`（追加 AUTH_SECRET/AUTH_TRUST_HOST）
- **修复时间**：2026-08-07 01:42
- **回归验证**：curl 验证 `/api/auth/session`、`/api/auth/providers` 由 500 → 200；E2E 01-auth 模块 6/6 通过

#### BUG-20260807-008：run-e2e.mjs 误判中断为正常完成 + 触发批量删除保护（脚本）
- **状态**：已修复
- **所属模块**：E2E 测试脚本
- **复现步骤**：① Playwright 清理固定 outputDir（e2e-results）触发沙箱 safe-delete 批量删除拦截，测试未启动即失败 ② hasCompleteResult 对空对象 `{}` 误判为"正常完成"
- **根因分析**：① outputDir 固定目录导致 Playwright 每次启动清空旧产物 ② 完成判定过宽（`json && typeof json === "object"` 对空对象为 true）
- **修复方案**：① outputDir 改为动态时间戳子目录 `e2e-results/run-${Date.now()}`（Playwright 无需清理旧目录）② hasCompleteResult 严格化（`suites` 非空数组 + mtime 在本轮启动之后）③ 移除全部 `fs.rmSync`（避免删除保护）
- **代码位置**：`tests/e2e/playwright.config.ts`、`tests/e2e/run-e2e.mjs`、`tests/e2e/stop-e2e.mjs`
- **修复时间**：2026-08-07 01:43
- **回归验证**：运行器正常完成首轮、4 轮中断重试按预期执行

#### BUG-20260807-009：gotoNav 在全新 context 下找不到侧栏（脚本设计缺陷）
- **状态**：已修复
- **所属模块**：E2E 测试脚本
- **复现步骤**：Inbox/Plan/Today 等所有依赖 gotoNav 的用例在 beforeEach 超时 60s——`waiting for getByRole('link', { name: '收纳' })`；另 waitForLoadState("networkidle") 在 Next.js dev（HMR websocket）下永不满足
- **根因分析**：Playwright 每个用例是全新 context（起始 about:blank），gotoNav 未先导航进入 Dashboard 壳；networkidle 依赖对 dev 模式不适用
- **修复方案**：gotoNav 首步检测 URL，非壳内先 `goto("/today")` 进入壳再点侧栏；networkidle 改为 domcontentloaded
- **代码位置**：`tests/e2e/utils/helpers.ts`（gotoNav）
- **修复时间**：2026-08-07 01:55
- **回归验证**：Inbox 模块由 9/9 失败 → 逐步修复后 9/9 通过

#### BUG-20260807-010：Inbox 卡片定位取到内层按钮行（脚本定位缺陷）
- **状态**：已修复
- **所属模块**：E2E 测试脚本
- **复现步骤**：I1-I9 部分失败——`div.filter({hasText}).filter({has:button}).last()` 取到"标题+主按钮行"，快捷操作按钮/确认创建按钮在行外找不到
- **根因分析**：filter 匹配多层级 div，last()（DOM 最后=最内层）不是卡片本体；应取最外层容器（卡片）
- **修复方案**：`findInboxCard` 改用 `.first()`（最外层匹配=卡片容器，子按钮可下钻查找）；同步修 I4 按钮 exact 匹配（"忽略" vs "全部忽略" 子串冲突）、I1 断言改"撤销"按钮、I5 步骤重排（先快捷操作后加子任务——产品真实行为：加子任务后简单卡升级复杂卡，快捷按钮消失）、I9 改为"整理结果草稿恢复"（产品 DRAFT_KEY 语义是 AI 整理结果而非输入文字）
- **代码位置**：`tests/e2e/utils/helpers.ts`（findInboxCard）、`tests/e2e/modules/02-inbox.spec.ts`（I1/I4/I5/I9）
- **修复时间**：2026-08-07 02:05-02:20
- **回归验证**：Inbox 模块 9/9 通过

#### BUG-20260807-011：findTaskByTitle 解析结构不符导致假阴性/假阳性（脚本缺陷）
- **状态**：已修复
- **所属模块**：E2E 测试脚本
- **复现步骤**：I1/I7 断言"任务应已创建"失败（Received: null），但 Neon 中任务真实存在；I8 撤销用例因此假通过
- **根因分析**：`GET /api/tasks` 返回**裸数组**（`NextResponse.json(tasks)`），findTaskByTitle 按 `{tasks:[]}` 解析 → 恒空
- **修复方案**：findTaskByTitle 兼容数组与对象两种结构
- **代码位置**：`tests/e2e/utils/api.ts`（findTaskByTitle）
- **修复时间**：2026-08-07 02:10
- **回归验证**：I1/I7 通过，I8 撤销删除恢复真实有效性

#### BUG-20260807-012：I7 断言与规则降级行为不符（测试预期修正）
- **状态**：已修复
- **所属模块**：E2E 测试脚本
- **复现步骤**：全量环境下 I7 失败——规则降级把"事项A；事项B"合并为单任务（标题含全串）
- **根因分析**：无 AI 配置时规则降级不拆分多事项（降级设计预期）；测试按"拆分两任务"断言
- **修复方案**：I7 双路径断言——AI 拆分（两任务分别存在）或规则降级（合并单任务存在），并加 annotation 标注
- **代码位置**：`tests/e2e/modules/02-inbox.spec.ts`（I7）
- **修复时间**：2026-08-07 02:18
- **回归验证**：单独运行 9/9 通过（全量环境偶发待本轮确认）

---

## ⏳ 待修复

### 2026-08-07（预登记：来自《项目结构与信息联动梳理》全量扫描）

#### BUG-20260807-013：积累型任务排期创建事务超时 500（Neon 连接池 5s 上限）
- **状态**：已修复
- **所属模块**：排期服务 / accumulate
- **复现步骤**：创建积累型任务（自动生成 30 天排期）→ POST /api/tasks 返回 500 `Transaction not found`（E2E I7/L3 复现）
- **根因分析**：`createAccumulateSchedules` 在交互式事务内 30 次串行 `schedule.create`，Neon 高延迟下单次查询 200-500ms，累计超 Prisma 交互式事务 5s 默认超时，连接池回滚导致事务句柄失效
- **修复方案**：改为 `schedule.createMany`（单条批量 INSERT）+ `{timeout: 30_000}`；同类事务（confirm-service、tasks POST）同步加 timeout
- **代码位置**：`src/lib/schedule/service.ts`（createAccumulateSchedules）、`src/app/api/tasks/route.ts`、`src/lib/inbox/confirm-service.ts`
- **修复时间**：2026-08-07（第 13 轮回归期间）
- **回归验证**：I7 批量创建、L3 习惯打卡排期均稳定通过

#### BUG-20260807-014：Focus Card currentTask 只认"进行中"导致排期未到不出现（测试数据语义）
- **状态**：已修复
- **所属模块**：Today 执行 / E2E 测试数据
- **复现步骤**：T 系列用例排期固定 10:00 → 凌晨/非该时段运行时不出现"出发"按钮
- **根因分析**：currentTask 只取当前时段进行中的任务；固定时间排期只在特定时刻命中
- **修复方案**：`scheduleNow` 默认 -30min 开始 +60min 时长，保证任意时刻运行都能命中当前任务
- **代码位置**：`tests/e2e/utils/api.ts`（scheduleNow）
- **修复时间**：2026-08-07
- **回归验证**：T1-T8 稳定通过

#### BUG-20260807-015/016/017/018/019/020：Plan 拖拽三连坑（HTML5 DnD 模拟系列，脚本）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Plan 拖拽
- **复现步骤**：P3 拖拽收集箱任务到天列 → apply-decision 未发出 / dragover ring 不生效 / 拖到标题头
- **根因分析**：① mouse 模拟不触发 HTML5 drag 事件（015）② dispatchEvent 构造的 DataTransfer 经 React 合成事件后读不到 task-id（016）③ evaluate 内原生 DragEvent 的 ring 检查误报（017）④ 最终方案 dragTo+targetPosition 在 React 下不稳定（018）⑤ `.plan-week-col` 前 7 个是标题头需排除 `.plan-week-hd`（019）⑥ 任务块重叠需 force click（020）
- **修复方案**：统一用 `dragToPlanColumn`（page.evaluate 原生 DragEvent 事件链 + 排除 hd 选择器 + ring 校验）；P5 块点击 force
- **代码位置**：`tests/e2e/utils/helpers.ts`（dragToPlanColumn）、`tests/e2e/modules/03-plan.spec.ts`
- **修复时间**：2026-08-07（第 14 轮前陆续修复）
- **回归验证**：P3/P4/P5 稳定通过

#### BUG-20260807-021：共享用户数据抢占 currentTask / 任务块重叠（测试隔离）
- **状态**：已修复
- **所属模块**：E2E 测试隔离
- **复现步骤**：Today 模块多个进行中任务抢占 currentTask；Plan 模块历史任务块重叠遮挡点击
- **根因分析**：共享主用户下测试数据互相干扰
- **修复方案**：Today 模块独立测试用户（state/today.json）+ 各模块 beforeEach `clearUserTasks` 清空未完成任务
- **代码位置**：`tests/e2e/modules/04-today.spec.ts`、`tests/e2e/modules/03-plan.spec.ts`、`tests/e2e/utils/api.ts`
- **修复时间**：2026-08-07
- **回归验证**：T1-T8、P2-P7 稳定通过

#### BUG-20260807-022：DELETE /api/user 500（FK RESTRICT daily_summaries/daily_briefs）
- **状态**：已修复
- **所属模块**：用户管理 / 认证
- **复现步骤**：E2E 清理用户 DELETE /api/user → 500（外键约束 daily_summaries）
- **根因分析**：连接池下事务内语句跨连接不可见（deleteMany 后外键仍报冲突）；且 Today 异步 pipeline 并发写入残留
- **修复方案**：改为非事务顺序 `$executeRawUnsafe` 逐表 DELETE + users 删除 10 次重试（重清 daily_summaries/daily_briefs，1.2s 间隔）
- **代码位置**：`src/app/api/user/route.ts`
- **修复时间**：2026-08-07（第 13 轮回归期间）
- **回归验证**：global-setup 用户注册/清理稳定

#### BUG-20260807-023：L1 统计断言依赖 daily_summaries 异步生成（测试时序）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Review 统计
- **复现步骤**：L1 ⑤ stats.totalCompleted 断言偶发失败——完成任务后统计未及时更新
- **根因分析**：daily_summaries 由 Today 视图打开时异步汇总，未打开 Today 时统计为旧值
- **修复方案**：断言前先打开 Today 页触发汇总，再 poll stats（60s）
- **代码位置**：`tests/e2e/modules/09-linkage.spec.ts`（L1）
- **修复时间**：2026-08-07（第 14 轮前）
- **回归验证**：L1 稳定通过

#### BUG-20260807-024：P8 续排断言 UTC/本地时区错位（脚本，API 字段为 UTC ISO）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Plan 续排
- **复现步骤**：P8 点击"复制到明天"后 UI 周六列已出现任务块（1项·12%），但 poll 90s 断言 `scheduledStart.startsWith(本地明天)` 恒 false
- **根因分析**：`GET /api/tasks/[id]` 返回的 scheduledStart 是 `toISOString()`（UTC，如 `2026-08-07T16:00:00.000Z`）；GMT+8 下本地明天 00:00 = UTC 今天 16:00，前缀永远不匹配 → 纯脚本断言缺陷，产品功能正常（trace 证实 complete 200）
- **修复方案**：断言改为 `new Date(scheduledStart)` 转本地后 `localDateStr()` 与 `dateOffset(1)` 比对（复用 helpers 本地日期工具）
- **代码位置**：`tests/e2e/modules/03-plan.spec.ts`（P8，L178-186）
- **修复时间**：2026-08-07 11:40
- **回归验证**：待第 15 轮确认

#### BUG-20260807-025：start 与 complete 并发竞态——start 事务覆盖 complete 结果（产品 Bug）
- **状态**：已修复
- **所属模块**：任务操作 / 并发一致性
- **复现步骤**：T2 首跑复现：点击"出发"后 168ms 内点击"该项完成"→ 确定 → complete 请求返回 200 `status:"completed"`（completedAt 已写库），但 45s 内任务状态始终 in_progress；UI 停在进行中态
- **根因分析**：Neon 高延迟下 start 事务耗时 3.5s，complete 的 update（03:28:23.3 提交）先于 start 事务（03:28:26.4 提交）；start 事务第二步无条件 `update(id → in_progress)` 把刚完成的同任务**覆盖回 in_progress**（trace 铁证：complete 200 body `status:"completed"` vs 数据库最终 in_progress）
- **修复方案**：start 事务内改为条件更新 `updateMany({ where: { id: anchorId, status: { notIn: ["completed","cancelled"] } } })`；count=0（任务已被并发操作置为终态）→ 返回 `{started:false}` 不覆盖，前端 load() 后自然展示终态
- **代码位置**：`src/app/api/tasks/[id]/action/route.ts`（start 分支，L43-66）
- **修复时间**：2026-08-07 11:45
- **回归验证**：并发复现脚本 3 轮 start+complete（150ms 间隔）全部最终 completed ✓；待第 15 轮 E2E 确认

#### BUG-20260807-026：档案面板无 Escape 关闭路径，遮罩拦截后续导航（产品 UX 缺口）
- **状态**：已修复
- **所属模块**：任务档案面板
- **复现步骤**：E2E L2：档案面板改主题保存后按 Escape → gotoNav 点侧栏"蓝图"链接 180s 无法点击（元素已定位但被 z-[90] 遮罩拦截）
- **根因分析**：GlobalSearch 的 Escape 只关搜索结果面板；TaskArchivePanel 无键盘关闭路径（仅 ✕/遮罩）；G1 未验证面板关闭属假通过
- **修复方案**：面板挂全局 keydown 监听（Escape → onClose）；补记用时输入框的局部 Escape 加 stopPropagation（防编辑行时误关面板）
- **代码位置**：`src/components/task/TaskArchivePanel.tsx`（useEffect + L339 局部处理）
- **修复时间**：2026-08-07 12:00
- **回归验证**：待第 15 轮确认

#### BUG-20260807-027：完成任务后当日 Review 统计恒 0（daily_summaries 固化不刷新，产品 Bug）
- **状态**：已修复
- **所属模块**：Review 复盘 / 统计正确性
- **复现步骤**：E2E L1 ⑤：完成 1 个任务后 poll stats.totalCompleted 60s 恒 0；实测 dailyBreakdown 当天 completedCount=0
- **根因分析**：views/today 打开时 getOrCreateTodaySummary 生成当日摘要（completedCount=0）并"存在即返回"固化；之后 complete/checkin 不再更新 → 用户早上打开 Today、白天完成任务、当天 Review 统计恒 0
- **修复方案**：daily-summary.ts 新增 refreshTodaySummary（强制 createDailySummary upsert）；action complete 分支与 checkin 路由落库后异步刷新（不阻塞响应）
- **代码位置**：`src/lib/ai/daily-summary.ts`、`src/app/api/tasks/[id]/action/route.ts`、`src/app/api/tasks/[id]/checkin/route.ts`
- **修复时间**：2026-08-07 12:05
- **回归验证**：待第 15 轮确认

#### BUG-20260807-028：Projects 习惯区 fetch /api/tasks/[id]/streak 404，已打卡状态永不显示（产品断链）
- **状态**：已修复
- **所属模块**：Projects 项目页 / 习惯区
- **复现步骤**：E2E L3 ②：Today 打卡成功后 Projects 页 45s 找不到「已打卡 ✓」按钮；树行"今日已打卡"状态点也不出现
- **根因分析**：Projects 页习惯区一直 fetch `/api/tasks/:id/streak`，但 `src/app/api/tasks/[id]/` 下无 streak 路由（404 被 catch 静默吞掉）→ streaks 永空 → 按钮恒为"今日打卡"
- **修复方案**：补建 `src/app/api/tasks/[id]/streak/route.ts`（GET → getStreak，校验任务归属）
- **代码位置**：`src/app/api/tasks/[id]/streak/route.ts`（新建）
- **修复时间**：2026-08-07 12:10
- **回归验证**：curl 验证 todayChecked=true；待第 15 轮确认

#### BUG-20260807-029：DELETE /api/user 被导航打断 + 重试仅重清 2 表（脚本时序 + 产品加固）
- **状态**：已修复
- **所属模块**：账户管理 / E2E 脚本
- **复现步骤**：E2E X1：删除账户后原凭据仍能登录（无"邮箱或密码错误"）；trace 铁证 DELETE 响应 status:-1（请求被取消）
- **根因分析**：① 脚本点击删除后未等响应，20s 后 goto("/login") 导航打断仍在执行的 fetch（Neon 下 18 表顺序删除需 20-40s）→ 账户未删 ② 产品侧 users 删除重试循环仅重清 daily_summaries/daily_briefs，异步 pipeline（analyzeDailyBehavior 写 user_models/user_patterns 等）冲突时 10 次重试全失败
- **修复方案**：① 测试用 waitForResponse 等待 DELETE 完成并断言 ok，setTimeout 240s ② 产品侧重清逻辑抽成 cleanupUserTables()，重试时全量重清 18 表
- **代码位置**：`tests/e2e/modules/10-account.spec.ts`（X1）、`src/app/api/user/route.ts`（DELETE）
- **修复时间**：2026-08-07 12:15
- **回归验证**：待第 15 轮确认

#### BUG-20260807-030：L2 收集箱看不到任务——收集箱只放行 ★ 任务（测试数据缺陷）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Plan 收集箱
- **复现步骤**：L2 创建无 star 任务 → Plan 页收集箱 20s 找不到（收集箱 = plannedTasks 过滤 `t.star`）
- **根因分析**：V3 设计"收集箱只放行 ★（执行清单）任务"（week-calendar route L44-50）；L2 测试数据未带 star
- **修复方案**：L2 createTask 补 `star: true`（与 P3/L4 一致）
- **代码位置**：`tests/e2e/modules/09-linkage.spec.ts`（L2）
- **修复时间**：2026-08-07 12:30
- **回归验证**：L2 单跑 15.1s 通过 ✓

#### BUG-20260807-031：Today currentTask 被已完成任务顶替（产品 Bug，Priority 2 未过滤状态）
- **状态**：已修复
- **所属模块**：Today 执行 / currentTask 选择
- **复现步骤**：T10 复现：前序用例完成的任务（completed，排期 11:31-12:31 仍在窗口内）打开 Today 被选为 currentTask，显示"未出发"卡片，顶替真正活跃任务
- **根因分析**：views/today Priority 2（当前时段排期任务）只按排期窗口匹配 `todaySchedules.find`，**未过滤任务状态**——completed/cancelled 任务只要今天有时段排期就会被选中
- **修复方案**：Priority 2 改为遍历窗口内排期，`findFirst({ where: { id, userId, status: { notIn: ["completed","cancelled"] } } })` 跳过已终态任务，命中第一个活跃任务
- **代码位置**：`src/app/api/views/today/route.ts`（Priority 2，L219-240）
- **修复时间**：2026-08-07 12:35
- **回归验证**：T10 单跑 22.1s 通过 ✓（含测试侧"＋"展开修复）

#### BUG-20260807-032：L3 树行"今日已打卡"状态点断言落空——孤儿积累任务无树行（测试预期与产品行为不符）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Projects 树
- **复现步骤**：L3 创建无父积累任务 → Projects 页习惯区"已打卡 ✓"可见，但 `[title="今日已打卡"]` 树行状态点 10s 找不到
- **根因分析**：树行状态点（.pt-gold-dot）只渲染在【树内节点】；孤儿积累任务只进习惯区（待整理池排除 accumulate，L232-233），**没有树行**——断言前提不成立
- **修复方案**：L3 先创建项目（level=project）再挂积累任务（parentId=项目），树行状态点出现；习惯区断言保持
- **代码位置**：`tests/e2e/modules/09-linkage.spec.ts`（L3）
- **修复时间**：2026-08-07 12:40
- **回归验证**：L3 单跑 27.8s 通过 ✓

#### BUG-20260807-033：J3 ★ 落库失败——reload 打断异步 PUT（测试时序）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Projects ★
- **复现步骤**：J3 首跑+retry 均失败：点击 ★ 乐观点亮（10s 断言过）→ reload → poll getTask(id).star 90s 恒 false
- **根因分析**：toggleStar 乐观更新立即生效，但 PUT /api/tasks/:id 是异步的（Neon 慢时 2-5s）；测试在乐观点亮断言后立即 reload，**导航打断未完成的 PUT**（与 BUG-029 X1 同源）→ star 未落库
- **修复方案**：waitForResponse 等待 PUT 完成（并断言 ok）再 reload；poll 缩至 30s（PUT 已确认完成）
- **代码位置**：`tests/e2e/modules/06-projects.spec.ts`（J3）
- **修复时间**：2026-08-07 15:15
- **回归验证**：J3 单跑 8.3s 通过 ✓；**第 17 轮全量 8.4s 通过 ✓**

#### BUG-20260807-034：全流程 UI 拖拽挂树失败（测试选择器 + React state 时序）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Projects 拖拽
- **复现步骤**：全流程用例（11 模块）拖待整理池孤儿到项目行 → parentId 30s 恒 null
- **根因分析**：① `text=` 匹配可能落到 span/toast（drop 事件未到 `.pt-row` 的 onDrop）② dragstart 后立即 dragover/drop，React setDragId 异步未提交，onRowDrop 优先读 dragId 落空
- **修复方案**：源/目标改用精确类（`.pt-pool-item` / `.pt-row` filter）；dragstart 后 waitForTimeout(150) 等 state 提交
- **代码位置**：`tests/e2e/modules/11-fullflow-ui.spec.ts`
- **修复时间**：2026-08-07 16:20
- **回归验证**：全流程用例通过 ✓

#### BUG-20260807-035：补记时长不进 actualMinutes——complete 统计先于 TimeLog（产品 Bug）
- **状态**：已修复
- **所属模块**：任务操作 / 计时统计
- **复现步骤**：UI 完成清单型任务（补记时长弹窗确定）→ 档案面板"实际用时"显示 0；GET task actualMinutes=0（curl 传 durationMinutes=25 得 25，但 UI 流程恒 0）
- **根因分析**：complete 分支顺序——`getTaskExecutionStats`（基于 timeLogs 聚合）在补记 TimeLog **创建之前**执行 → actualMinutes 恒为 0（补记时长永远不进统计）
- **修复方案**：补记 TimeLog（durationMinutes>0）移到 task.update / stats 计算之前；错误从静默 catch 改为 console.error
- **代码位置**：`src/app/api/tasks/[id]/action/route.ts`（complete 分支，L205-222）
- **修复时间**：2026-08-07 16:24
- **回归验证**：curl 1/2/25 全正确；全流程用例 timeLogs manual + actualMinutes=durVal ✓

#### BUG-20260807-036：Today 顶部统计文本结构断言（数字+标签布局，脚本）
- **状态**：已修复
- **所属模块**：E2E 测试脚本 / Today 统计
- **复现步骤**：全流程用例 poll「专注 X 分钟」正则不匹配（-1）——顶部统计为「0 专注分钟」（数字在前标签在后）
- **根因分析**：断言正则 `/专注\s*(\d+)\s*分钟/` 假设"标签在前"，实际布局为"数字在前"
- **修复方案**：正则改为 `/(\d+)\s*专注分钟/`，并严格断言 ≥ durVal（防止显示 0 假通过）
- **代码位置**：`tests/e2e/modules/11-fullflow-ui.spec.ts`
- **修复时间**：2026-08-07 16:50
- **回归验证**：全流程用例通过 ✓

#### BUG-20260807-037：快速"出发→完成"时 departureAt 丢失，补记时长仍为 0（产品并发竞态）
- **状态**：已修复
- **所属模块**：任务操作 / 计时统计
- **复现步骤**：UI 出发后立即点完成（<1s 内）→ complete 请求先于 start 事务提交（Neon 高延迟 start 3-5s）→ complete 读 departureAt=null 且无 start TimeLog → 补记跳过 → actualMinutes=0（全流程用例首跑/retry 随机复现；debug 轮恰逢 start 先提交而通过）
- **根因分析**：complete 先于 start 时：① existing.departureAt=null ② start 后到因任务已 completed 被 BUG-025 条件更新跳过（started:false）→ departureAt 永远丢失
- **修复方案**：complete 补记 TimeLog 的 startRef 增加兜底——departureAt 缺失且无 start 日志时取当前时刻（补记时长为用户确认值，起点精度不影响"实际用时"统计）；原 `if (startRef)` 分支移除（始终创建）
- **代码位置**：`src/app/api/tasks/[id]/action/route.ts`（complete 分支，L205-224）
- **修复时间**：2026-08-07 17:55
- **回归验证**：全流程用例首跑即过（2.1m）✓；T2/L1/J3 单跑全过 ✓；单测 95/95 ✓

#### BUG-20260807-001：档案面板"去 Project / 去 Plan"定位跳转失效（断链）
- **状态**：待修复
- **所属模块**：任务档案面板 / Projects / Plan
- **复现步骤**：
  1. 任意页面打开任务档案面板（全局搜索 ⌘K 或 Projects 树节点点击）
  2. 点击面板内"去 Project 定位"或"去 Plan"按钮
  3. 跳转至 `/projects?highlight=taskId` 或 `/plan?highlight=taskId`
  4. 目标页面**不会**滚动定位/高亮目标任务
- **根因分析**：`TaskArchivePanel.tsx` 跳转时携带 `?highlight=` 参数，但 `projects/page.tsx` 与 `plan/page.tsx` 均无 `useSearchParams` 消费该参数（全库搜索确认无匹配）
- **修复方案**：待定 — 在 Projects/Plan 页挂载 `useSearchParams` 监听，命中后滚动到目标任务行并短暂高亮；`gotoProject/gotoPlan` 需保留参数
- **代码位置**：`src/components/task/TaskArchivePanel.tsx`（约 L171-172 跳转处）；`src/app/(dashboard)/projects/page.tsx`、`src/app/(dashboard)/plan/page.tsx`（缺消费逻辑）
- **修复时间**：—

#### BUG-20260807-002：POST /api/views/today/refresh 无前端消费（预留接口闲置）
- **状态**：待修复
- **所属模块**：Today 执行
- **复现步骤**：全库搜索 `fetch` 指向 `/api/views/today/refresh` 的调用 → 无；仅服务端就绪
- **根因分析**：实现"今日决策强制刷新"接口后未接前端入口（或设计为手动/预留）
- **修复方案**：待定 — 若确需保留，在 Today 页提供刷新交互；否则按死路由清理
- **代码位置**：`src/app/api/views/today/refresh/route.ts`
- **修复时间**：—

#### BUG-20260807-003：POST /api/plan/repeat 未接线（文件头自标"已知未接线"）
- **状态**：待修复
- **所属模块**：Plan 规划
- **复现步骤**：无前端页面/组件调用 `/api/plan/repeat`；功能不可达
- **根因分析**：重复任务批量排期接口实现后未接前端 UI
- **修复方案**：待定 — 接前端（重复任务编辑入口）或标注为计划中
- **代码位置**：`src/app/api/plan/repeat/route.ts`
- **修复时间**：—

#### BUG-20260807-004：Review 主题趋势周环比（prev）前端显示"—"
- **状态**：待修复
- **所属模块**：Review 复盘
- **复现步骤**：Review 页"主题投入"区 → 周环比列显示"—"而非 ±N% 数据
- **根因分析**：后端 stats themeBreakdown 已带 `prev {count, percent}` 字段，前端未消费
- **修复方案**：待定 — 前端消费 `prev` 渲染环比（差值与涨跌箭头）
- **代码位置**：`src/app/(dashboard)/review/page.tsx`（ThemeInvestment 组件）
- **修复时间**：—

#### BUG-20260807-005：Focus Card 左栏项目阶段（stages/projectProgress）为 mock 数据
- **状态**：待修复
- **所属模块**：Today 执行
- **复现步骤**：Focus Card V2 左栏展示项目阶段/进度 → 数据为前端 mock，与真实项目树不一致
- **根因分析**：实施时未接入项目树 API，使用占位数据
- **修复方案**：待定 — 直读 `GET /api/projects/tree` 计算阶段链与进度
- **代码位置**：`src/app/(dashboard)/today/page.tsx`（buildAncestry / mock 相关）
- **修复时间**：—

#### BUG-20260807-006：lib/ai/today.ts（getTodaySuggestion）无引用（疑似遗留）
- **状态**：待修复
- **所属模块**：AI / 代码清理
- **复现步骤**：全库搜索 `getTodaySuggestion` / `ai/today` 引用 → 无
- **根因分析**：旧版 Today 建议逻辑被 today-decision.ts 取代后遗留
- **修复方案**：待定 — 确认无引用后删除或归档
- **代码位置**：`src/lib/ai/today.ts`
- **修复时间**：—

---

## 📋 条目模板（修复后按此填写）

```
#### BUG-YYYYMMDD-XXX：<一句话标题>
- **状态**：已修复
- **所属模块**：<模块名>
- **复现步骤**：<1. 2. 3.>
- **根因分析**：<为什么会出现>
- **修复方案**：<改了什么、怎么改>
- **代码位置**：<文件路径 + 行号>
- **修复时间**：YYYY-MM-DD HH:MM
- **回归验证**：<关联 E2E 用例 / 单测结果>
```

---

*维护：随开发推进持续更新 · 上次更新 2026-08-07 01:30*


#### BUG-20260807-038：今日决策缓存不随任务创建失效（产品 Bug，扩展覆盖 confirm 链路）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：today_decision 首次打开 Today 生成后存在即返回；tasks POST 已删决策但 Inbox 确认创建（confirm-service）未覆盖 → 用户先开 Today 再录入，新任务永不进 mustDo
- **修复**：confirm-service 创建后删今日决策；/api/tasks POST 同步
- **验证**：全流程用例环节 6/7 决策重算生效

#### BUG-20260807-039：Inbox 设截止后确认创建 500（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：task-builder 假定 deadline 为 YYYY-MM-DD 拼接 T23:59:59；前端 onModify 传完整 ISO → 二次拼接 Invalid Date → Prisma 500
- **修复**：toDeadlineDate 兼容两种格式（date-only 拼接 / ISO 直接解析）
- **验证**：curl confirm(deadline ISO) 200；E2E 环节 1/2-D/B 通过

#### BUG-20260807-040：带空格时间表达无法识别为 scheduled（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：parser 正则不匹配数字与点之间带空格（真实输入「早上 8 点」）
- **修复**：正则改 \s*\d{1,2}\s*点
- **验证**：curl analyze 返回 scheduled + 08:00 排期

#### BUG-20260807-041：Inbox scheduled 任务确认后丢失排期（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：analyze 返回 startTime/endTime，confirm-service 未写 Schedule → 惰性结算/今日路线/续排全失效
- **修复**：confirm-service 对 scheduled 任务按 startTime/endTime 补建排期
- **验证**：curl confirm 后 schedules=1；E2E 环节 1/2-F2 通过

#### BUG-20260807-042：积累孤儿被排除在待整理池外（产品死链）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：待整理池过滤 accumulate → 积累任务无法挂树 → 无法 ★ → 无法排期 → Today 积累卡今日不可达
- **修复**：待整理池包含积累孤儿（可挂树；习惯区保留）
- **验证**：E2E 环节 3 挂 C 成功

#### BUG-20260807-043：完成路线前置卡后 routeSel 不清除（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：complete 后 routeSel 仍指向旧任务 → 静态未出发前置卡占主卡
- **修复**：doAction complete 成功后 setRouteSel(null)
- **验证**：E2E 环节 6 到 7 主卡切换正常

#### BUG-20260807-044：路线选中任务的前置卡写死 checklist+空清单（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：routeSel 前置卡 items 空 + type 固定 checklist
- **修复**：点击时 fetch 任务详情用 toCardV2 真实构造
- **验证**：E2E 环节 5 A 卡真实清单勾选通过

#### BUG-20260807-045：GET 任务 children 字段 title 与 toCardV2 期待 text 不匹配（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：前置卡 routeSelTask 直接喂 toCardV2 → 清单项文本空
- **修复**：前置卡构造归一化 children（title 到 text）
- **验证**：E2E 环节 5 勾选通过

#### BUG-20260807-046：routeSelTask 不随 load 刷新（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：新增/勾选后 load() 刷新 data 但前置卡详情不更新
- **修复**：useEffect 监听 routeSel/data 同步刷新
- **验证**：E2E 环节 5 新增子项显示通过

#### BUG-20260807-047：任务完成不失效今日决策，mustDo 长期指向已完成任务（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：决策缓存存在即返回；mustDo 项无 status 无法前端跳过
- **修复**：complete 后删今日决策；mustDo 项带 status；前端兜底跳过已完成
- **验证**：E2E 环节 6 到 7 决策重算生效

#### BUG-20260807-048：积累任务默认 imp3 使 mustDo 排序异常（测试数据设计）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：C 未设低（imp3：排期30+6=36 大于 D 的 35）抢占 mustDo[0]（curl 铁证）
- **修复**：脚本 C 录入时设低
- **验证**：环节 7 D 成为 mustDo[0]

#### BUG-20260807-049：enhanceCard 用 buildChecklist 补 children，学习型误判清单型（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：mustDo 兜底卡 children 含 description 拆行项 → hasChildren=true → 无子任务的学习型显示为清单型
- **修复**：enhanceCard 只取真实子任务
- **验证**：curl mustDo children=[]；待全流程确认


#### BUG-20260807-038：今日决策缓存不随任务创建失效（产品 Bug，扩展覆盖 confirm 链路）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：today_decision 首次打开 Today 生成后存在即返回；tasks POST 已删决策但 Inbox 确认创建（confirm-service）未覆盖 → 用户先开 Today 再录入，新任务永不进 mustDo
- **修复**：confirm-service 创建后删今日决策；/api/tasks POST 同步
- **验证**：全流程用例环节 6/7 决策重算生效

#### BUG-20260807-039：Inbox 设截止后确认创建 500（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：task-builder 假定 deadline 为 YYYY-MM-DD 拼接 T23:59:59；前端 onModify 传完整 ISO → 二次拼接 Invalid Date → Prisma 500
- **修复**：toDeadlineDate 兼容两种格式（date-only 拼接 / ISO 直接解析）
- **验证**：curl confirm(deadline ISO) 200；E2E 环节 1/2-D/B 通过

#### BUG-20260807-040：带空格时间表达无法识别为 scheduled（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：parser 正则不匹配数字与点之间带空格（真实输入「早上 8 点」）
- **修复**：正则改 \s*\d{1,2}\s*点
- **验证**：curl analyze 返回 scheduled + 08:00 排期

#### BUG-20260807-041：Inbox scheduled 任务确认后丢失排期（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：analyze 返回 startTime/endTime，confirm-service 未写 Schedule → 惰性结算/今日路线/续排全失效
- **修复**：confirm-service 对 scheduled 任务按 startTime/endTime 补建排期
- **验证**：curl confirm 后 schedules=1；E2E 环节 1/2-F2 通过

#### BUG-20260807-042：积累孤儿被排除在待整理池外（产品死链）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：待整理池过滤 accumulate → 积累任务无法挂树 → 无法 ★ → 无法排期 → Today 积累卡今日不可达
- **修复**：待整理池包含积累孤儿（可挂树；习惯区保留）
- **验证**：E2E 环节 3 挂 C 成功

#### BUG-20260807-043：完成路线前置卡后 routeSel 不清除（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：complete 后 routeSel 仍指向旧任务 → 静态未出发前置卡占主卡
- **修复**：doAction complete 成功后 setRouteSel(null)
- **验证**：E2E 环节 6 到 7 主卡切换正常

#### BUG-20260807-044：路线选中任务的前置卡写死 checklist+空清单（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：routeSel 前置卡 items 空 + type 固定 checklist
- **修复**：点击时 fetch 任务详情用 toCardV2 真实构造
- **验证**：E2E 环节 5 A 卡真实清单勾选通过

#### BUG-20260807-045：GET 任务 children 字段 title 与 toCardV2 期待 text 不匹配（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：前置卡 routeSelTask 直接喂 toCardV2 → 清单项文本空
- **修复**：前置卡构造归一化 children（title 到 text）
- **验证**：E2E 环节 5 勾选通过

#### BUG-20260807-046：routeSelTask 不随 load 刷新（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：新增/勾选后 load() 刷新 data 但前置卡详情不更新
- **修复**：useEffect 监听 routeSel/data 同步刷新
- **验证**：E2E 环节 5 新增子项显示通过

#### BUG-20260807-047：任务完成不失效今日决策，mustDo 长期指向已完成任务（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：决策缓存存在即返回；mustDo 项无 status 无法前端跳过
- **修复**：complete 后删今日决策；mustDo 项带 status；前端兜底跳过已完成
- **验证**：E2E 环节 6 到 7 决策重算生效

#### BUG-20260807-048：积累任务默认 imp3 使 mustDo 排序异常（测试数据设计）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：C 未设低（imp3：排期30+6=36 大于 D 的 35）抢占 mustDo[0]（curl 铁证）
- **修复**：脚本 C 录入时设低
- **验证**：环节 7 D 成为 mustDo[0]

#### BUG-20260807-049：enhanceCard 用 buildChecklist 补 children，学习型误判清单型（产品 Bug）
- **状态**：已修复 ｜ 2026-08-07
- **根因**：mustDo 兜底卡 children 含 description 拆行项 → hasChildren=true → 无子任务的学习型显示为清单型
- **修复**：enhanceCard 只取真实子任务
- **验证**：curl mustDo children=[]；待全流程确认


#### BUG-20260808-050：mustDo 兜底卡的子任务勾选失效，action 误判 reopen（产品 Bug）
- **状态**：已修复 ｜ 2026-08-08
- **现象**：环节 7 学习型卡 D（mustDo 兜底）勾选知识点子任务后，poll children status 恒为未完成（20s 超时）；主卡勾选按钮点击无效果
- **根因**：`toggleChildItem` 只从 `data.currentTask.children` 查找被点项——mustDo 兜底卡场景 currentTask 为 null → item 缺失 → `item?.done` undefined → 误发 `reopen` 给未完成子任务（reopen 不改状态）→ 子任务永不变更
- **修复**：查找源扩大到 `currentTask.children + routeSelTask.children + mustDo/recommended 增强 children`；done 判断兼容 `{text,done}`（views/today）与 `{title,status}`（GET /api/tasks/:id）两种序列化；定义移动到 routeSelTask 声明之后
- **代码变更**：`src/app/(dashboard)/today/page.tsx` toggleChildItem（依赖 [data, routeSelTask, load]）
- **验证**：全流程环节 7 勾选→取消→再勾可逆通过；`1 passed (5.1m)`

#### BUG-20260808-051：DELETE 任务不级联删除子孙，孤儿任务残留参与今日决策（产品 Bug）
- **状态**：待修复 ｜ 2026-08-08
- **现象**：curl 复现时 DELETE 父任务后，其子任务/阶段任务成为孤儿顶层任务（parentId 指向已删 id），残留进入 mustDo/recommended 抢占主卡（复现：mustDo 出现 2 个同名孤儿任务）
- **根因**：`DELETE /api/tasks/:id` 仅删自身，未递归删除子孙；孤儿任务 status=not_started 参与 today-decision 评分
- **修复**：待实施——删除时递归收集子孙一并删除（或软删除并排除孤儿查询）
- **验证**：待全量回归后确认影响面


#### BUG-20260808-052：planned 任务被拖拽排期后误判「固定时间」卡，提前执行不可达（产品 Bug）
- **状态**：已修复 ｜ 2026-08-08
- **现象**：11-fullflow-ui 环节 ⑤ 路线点击任务 A（无子任务+有排期）后前置卡显示「固定时间 · 到点自动完成」（无「出发」按钮）→ 提前执行不可达；此前通过属「排期失败反而假绿」（A 无排期→learning→出发）
- **根因**：`toCardV2` 的 timer 判定 `hasSchedule ? "timer"` 过宽——用户手动拖拽排期的 planned 任务被误判为「固定时间」；但惰性结算（到点自动完成）仅对 taskType=scheduled 生效，planned 不会自动完成，卡片语义错误且交互错乱
- **修复**：timer 判定收窄为 `hasSchedule && taskType === "scheduled"`；planned+排期+无子任务 → learning 卡（「出发」→计时→完成）
- **代码变更**：`src/app/(dashboard)/today/page.tsx` toCardV2（type 判定）
- **联动脚本**：12-daily-flow 环节 8 E（planned 组会）改 learning 交互；11-fullflow-ui 搜索定位改「未 」前缀（text= 误匹配主卡 heading）
- **验证**：11+12 定向重跑 `2 passed (6.2m)`；单元 95/95、tsc 0 错误


#### BUG-20260808-053：POST /api/tasks 创建时 ★ 执行清单标记不落库（产品 Bug，线上验证发现）
- **状态**：已修复 ｜ 2026-08-08
- **现象**：线上部署后全链路验证——API 创建 ★ 采购元器件清单（star=True）+ 2 子任务 + 排期 → currentTask 指向子任务「采购电容」（细小事项）而非清单标题；本地 100% 复现（star 回读 False → 锚点 BFS 到子任务 → 排期建在子任务）
- **根因**：POST /api/tasks 解构与 create data 均无 star 字段 → 创建时丢失 ★（UI 路径经 PUT 落库正常，API 路径丢失，E2E 走 UI 未暴露）
- **修复**：`src/app/api/tasks/route.ts` 解构加 star + create data 加 `star: !!star`
- **验证**：本地复现 PASS（star=True → 排期在父 → currentTask=★父任务）；线上复验 PASS（注册→建★清单→排期→views/today currentTask=清单标题，children=2 子项）
- **用户影响**：已存在的「采购元器件」旧数据若排期建在子任务上，需在 Plan 移除旧排期重新拖拽（★ 在父任务时锚点自动解析到父）
