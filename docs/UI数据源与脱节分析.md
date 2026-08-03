# UI 数据源清单与脱节分析（2026-08-02）

> 目标：逐区域回答「这个 UI 是从后台读的，还是固定项？」「后台有没有数据给它读？」「哪些是新 UI 要求、但旧数据里根本没有的？」
> 对应修复已在本轮完成，见文末「修复清单」。

---

## 一、四个页面的数据来源全景

### Today（今日驾驶舱）

| UI 区域 | 数据来源 | 后台提供？ | 说明 |
|---|---|---|---|
| 问候语/日期/完成数/专注分钟 | `/api/views/today` | ✅ | todayStats.completedCount + totalMinutes（TimeLog 汇总） |
| **Focus Card（计时/清单/学习型）** | `/api/views/today` currentTask | ✅（部分） | **类型是前端推断**：有子任务→清单型 / 有排期→计时型 / 否则→学习型（与设计稿一致，无需 AI 判断） |
| 卡片上的「已用时间/进度」 | currentTask.elapsedMinutes + completionPercent | ✅ | TimeLog 汇总 |
| 状态仪表盘 | `/api/user-state` + currentState | ✅ | energy/focus/mood/stress，历史记录 |
| 今日路线（时间轴） | todayTimeline | ✅ | Schedule 当日排期 |
| AI 调整助手 | brief + recommended + executionAdvice | ✅ | 规则引擎 + LLM（可选） |
| 「AI 执行」提示行 | executionAdvice.message | ✅ | |

### Plan（规划）

| UI 区域 | 数据来源 | 后台提供？ | 说明 |
|---|---|---|---|
| 本周截止 | `/api/views/week-calendar` allActiveTasks | ✅ | deadline 未来 7 天 + 剩余天数梯度色 |
| **周历任务块颜色** | scheduledTasks.category | ⚠️→✅ | **旧数据 category 全空 → 已修**：数据库补 18 个 + API 按标题/标签兜底推断（课程灰/学习蓝/实践紫/竞赛粉/健康绿） |
| 周历任务块位置 | scheduledStart/End | ✅ | Schedule 是唯一时间源 |
| 高效时段条 | — | ❌ 未接 | **固定文案"9时/15时"，设计稿要求来自行为数据（UserModel.peakHours）** — 待接 |
| 收集箱 | plannedTasks | ⚠️→✅ | **原实现只显示 planned 类型 → 已改为显示全部未排期任务（inbox 想法 + planned 截止日）**，设计稿明确"收集箱 = inbox" |
| 收集箱「AI 解析/手动」标签 | — | ❌ | **固定文案"手动"** — 需按任务来源打标（AI 创建的标"AI 解析"），暂未接 |
| 任务详情抽屉（三种类型） | `/api/tasks/[id]` | ✅ | **本轮新建**：planned=截止日视图 / scheduled=时间块视图 / inbox=想法视图 + 执行清单（children） |
| 拖拽排期 | 前端 DnD → `/api/plan/apply-decision` | ✅ | **本轮恢复**：拖到日历自动转时间块（10:00 或下一整点，按预估时长） |

### Inbox（收集箱）

| UI 区域 | 数据来源 | 后台提供？ | 说明 |
|---|---|---|---|
| AI 整理结果 | `/api/inbox/analyze` | ✅ | LLM 优先 + 规则降级（无 AI 也能用） |
| 分类/类型/置信度/预估 | analyze 返回 items | ✅ | AI 判断 category + taskType |
| 编辑面板 | 前端 state → confirm 提交 | ✅ | 本轮已改为受控编辑（真编辑） |
| 撤销 | confirm 返回 taskId → action delete | ✅ | 本轮已接 |

### Review（复盘）

| UI 区域 | 数据来源 | 后台提供？ | 说明 |
|---|---|---|---|
| 战报/洞察/日记 | `/api/views/stats` | ✅ | 规则聚合，零 AI 依赖 |

---

## 二、关键结论：哪些数据"新 UI 要求但旧数据没有"

| 数据 | 数据库有没有 | 现状 | 处理 |
|---|---|---|---|
| **category（分类）** | 字段有，但 33/34 个任务为空 | 周历全灰、分类统计失真 | ✅ 数据库按标题推断补 18 个；API 层兜底推断（resolveDomain）；新任务 AI 会判断 |
| **卡片类型（计时/清单/学习）** | **没有字段，也不需要** | 设计稿本身就是"形态推断"：有排期=计时、有子任务=清单、其他=学习 | ✅ 无需改动，前端推断已实现 |
| **项目归属（parentTitle）** | 字段有（parentId），当前 0 个任务有父子 | 只有 Inbox 复杂任务拆解会生成父子 | ✅ 结构就绪；TaskForm 支持 parentId 创建子任务；subtask-list 可加子任务 |
| **taskType（inbox/planned/scheduled）** | ✅ 有 | AI parser 已判断 | ✅ |
| **执行清单（children 子任务）** | ✅ 有 | Inbox breakdown 拆解生成；Today/详情抽屉读取 | ✅ |
| **高效时段（行为数据）** | ✅ UserModel.peakHours + UserPattern | Plan 头部的"9时/15时"还是固定文案 | ⚠️ 待接（小改） |
| **AI/手动来源标签** | 部分（schedule.source / decisionLog） | 收集箱固定显示"手动" | ⚠️ 待接（小改） |
| **AI 执行建议** | ✅ executionAdvice | Today 卡片底部展示 | ✅ |

---

## 三、本轮修复清单（针对脱节）

1. **数据清洗（prisma/dev.db）**：2 个 in_progress 冲突 → 保留最早 1 个；33 个空分类 → 按标题推断补 18 个
2. **week-calendar API**：分类兜底推断（effCategory：category 空 → resolveDomain(tags, title)）；scheduledTasks 补 tags/estimatedMinutes；plannedTasks 改为「未排期任务池」（inbox + planned）
3. **Plan 收集箱**：显示所有未排期任务 + 「想法/截止日」类型徽标 + 截止日期显示
4. **任务详情抽屉（设计稿核心）**：点周历块/收集箱卡 → 右侧抽屉，三种 taskType 三种主视觉（截止日红卡 / 时间块蓝卡 / 想法黄卡）+ 执行清单 + 开始/完成/调整时间/移除
5. **拖拽恢复**：收集箱卡拖到周历天列 → 自动转为时间块（当天 10:00 或下一整点，时长取预估）
6. **Today Focus Card 单卡**：只显示当前任务（无当前任务时显示第一个必做）；不再堆多卡
7. **卡片颜色**：周历任务块按分类着色（数据缺失时标题推断兜底）

---

## 四、遗留项处理状态（2026-08-02 二轮收尾 ✅ 全部完成）

| 项 | 状态 | 做法 |
|---|---|---|
| 高效时段接真实数据 | ✅ 已修 | week-calendar 返回 UserModel.peakHours，Plan 头部显示真实高效时段（无数据时提示"暂无高效时段数据"） |
| 收集箱 AI/手动来源标签 | ✅ 已修 | Task 表新增 `source` 字段（user/ai），Inbox 确认创建与 AI create_task 打 `ai` 标签，收集箱显示"AI 解析/手动" |
| 详情抽屉子任务操作 | ✅ 已修 | 子任务行可点击勾选完成/重新打开；底部「+ 追加子任务」直接创建子任务；操作后抽屉自动刷新 |
| save_memory 类型语义 | ✅ 已修 | fact/event/goal 等保留原始类型，不再被映射为 temporary_context |
| 记忆复活匹配 | ✅ 已修 | 语义关键词（上午/精力/拖延…）交集判断，不再用内容截断匹配固定 pattern 名 |
| planner 冲突检测 | ✅ 已修 | scheduledEnd=null 的全天事件也参与冲突检测 |
| 关键词提取误伤 | ✅ 已修 | extractKw 不再误删单字"换"（如"换灯泡"） |

> 数据库迁移：`prisma db push` 已给 tasks 表加 source 列（默认 'user'，历史数据无需回填）。

---

*分析基于：UI示例/ 四个设计稿 + prisma/dev.db 实际数据 + 全部 API 源码。*
