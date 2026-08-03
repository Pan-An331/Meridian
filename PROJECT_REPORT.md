# Task OS 项目完整报告

> 生成时间：2026-07-31 | 当前分支：Phase 3 完成 + 全管线接通

---

## 一、产品理念

**Task OS ≠ 待办清单。它是一个减少心理负担的工具。**

核心理念：
- **帮用户过滤未来，不是堆积未来。** 不是把所有事扔进一个列表，而是帮用户判断「现在该做什么」。
- **AI 不是聊天机器人。** AI 是嵌入四个页面的四个不同角色，而不是一个独立对话窗口。
- **用户最终控制权。** AI 只建议不强制。所有 AI 输出都可以被用户修改、忽略、关闭。
- **零 AI 可用是底线。** 没配 API 的用户也应该完整使用所有核心功能。

### 四页面链

```
Inbox（AI 理解入口）
  → 自然语言输入 → AI 解析为结构化任务草案 → 用户确认 → 创建任务
  ↓
Plan（时间规划）
  → 周历视图拖拽排期 → 查看截止日和时间块 → 黄金时段高亮
  ↓
Today（执行驾驶舱）
  → 主任务卡（视觉中心）→ 状态仪表盘 → 今日路线时间线 → AI 助手
  ↓
Review（复盘学习）
  → 完成率/专注时/连续天数 → 行为洞察 → 效率矩阵 → AI 归因分析
```

### 核心规则（不可违反）

1. Task ≠ Schedule。任务本身不改时间，时间只由 Schedule Service 的 `$transaction` 管理。
2. LLM 不出 taskId，只出 keyword。
3. Schedule 是唯一时间数据源，所有时间变更必须走 Schedule Service。
4. Today 的规则引擎（today-decide / pause-advisor / execution-advisor）是核心，不能删。

---

## 二、技术架构

### 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router + Turbopack) |
| 语言 | TypeScript (strict) |
| 数据库 | SQLite (via Prisma ORM) |
| 样式 | Tailwind CSS + 自定义设计系统 |
| AI 集成 | OpenAI-compatible API（可选） |

### 目录结构

```
src/
├── app/
│   ├── (auth)/login,register/     # 认证
│   └── (dashboard)/
│       ├── today/                 # ★ 今日执行
│       ├── inbox/                 # ★ 收集箱（AI 入口）
│       ├── plan/                  # ★ 周计划
│       ├── review/                # ★ 复盘
│       └── settings/              # 设置 + AI 仪表盘
├── components/
│   ├── today/                     # FocusTaskCard, TodayBriefCard, TodayRoute
│   ├── plan/                      # WeekCalendar, CalendarGrid, UndoRedo
│   ├── ui/                        # PageHero, Card, Button, Modal, EmptyState...
│   ├── ai/                        # AIInsightCard
│   ├── sidebar.tsx                # 桌面端侧边栏
│   └── mobile-nav.tsx             # 移动端底部导航
├── lib/
│   ├── ai/
│   │   ├── parser.ts              # Inbox 输入解析（LLM + Fallback）
│   │   ├── today-decide.ts        # Today 决策引擎
│   │   ├── pattern-mining.ts      # 8 条本地规则 Pattern Mining
│   │   ├── cold-start.ts          # 冷启动基线 Memory 注入
│   │   ├── memory-manager.ts      # Memory 评分/衰减/冲突解决
│   │   ├── decision-engine.ts     # 决策引擎 + UserModel 聚合
│   │   ├── advanced.ts            # LLM 三级分析 + Memory 唤醒 + 日常管道
│   │   └── client.ts              # AI API 调用客户端
│   ├── plan/                      # 日历适配器、颜色系统
│   └── schedule/                  # Schedule Service（唯一时间数据源）
├── types/
│   ├── task.ts                    # Task 类型 + TaskTypeLabels
│   └── inbox.ts                   # Inbox 响应类型
└── hooks/
    └── usePlan.ts                 # Plan 页面数据 hook
prisma/
└── schema.prisma                  # 完整数据模型
```

---

## 三、数据库 Schema

### 核心表

| 表 | 用途 |
|---|---|
| `User` | 用户账户（email + passwordHash） |
| `Task` | 任务（title, description, category, taskType, status, deadline, importance...） |
| `Schedule` | 时间安排（taskId → scheduledStart/scheduledEnd） |
| `TimeLog` | 执行日志（start/end/duration） |
| `DailySummary` | 每日统计（完成数、总分钟数） |
| `AgentMemory` | AI 记忆（user 偏好/行为模式/约束） |
| `DecisionLog` | AI 决策记录（含 memoryId/confidence/outcome） |
| `UserState` | 用户当前状态（energy/focus/mood/stress） |
| `TodayDecision` | 今日 AI 决策（mustDo/recommended/reason） |
| `TaskDraft + TaskDraftItem` | 任务草稿（Inbox AI 解析结果暂存） |

### Phase 3 新增

| 表 | 用途 |
|---|---|
| `UserObservation` | 用户行为原始事件（time_modification / pause / skip） |
| `UserPattern` | 统计规律（8 条本地规则输出） |
| `UserModel` | 聚合用户画像（peakHours, dailyCapacity, trustScore） |

### AgentMemory Phase 3 新增字段

| 字段 | 用途 |
|---|---|
| `status` | "active" / "dormant" / "retired" / "blocked" |
| `dimension` | "preference" / "ability" |
| `importanceScore` | 计算评分（confidence × frequency × recency × impact） |
| `contextTags` | 情境标签（morning, peak, big_task...） |
| `evidenceCount` | 支撑证据数量 |
| `lastUsedAt` | 最后一次被决策消费的时间 |

### Task Phase 3 新增字段

| 字段 | 用途 |
|---|---|
| `postponedCount` | 任务被推迟次数（腐化计数） |

---

## 四、AI 数据流（完整链路）

### 4.1 任务类型体系

| 内部值 | 中文显示名 | 含义 | 触发条件 |
|---|---|---|---|
| `inbox` | 收集箱 | 想法暂存，无时间约束 | 用户没提任何时间 |
| `planned` | 截止日 | 有截止日期，未确定具体时间 | 用户说了日期但没具体时间段 |
| `scheduled` | 时间块 | 已确定具体时间段 | 用户说了精确时间（下午3点） |

### 4.2 Inbox 解析流

```
用户输入自然语言
  ↓
POST /api/inbox/analyze
  ↓
analyzeInboxInput(userId, content)
  ├─ AI 已配置 → callAI(INBOX_ANALYZER_PROMPT, content)
  │   ├─ 成功 → 解析 JSON → 归一化 → 返回 InboxResponse
  │   └─ 失败 → 回退到 fallback
  └─ AI 未配置 → fallbackAnalyzeInboxInput(content)
      ├─ splitIntoSegments() → 拆成多个 item
      ├─ extractCoreAction() → 提取标题（≤15字）
      ├─ extractDescription() → 提取备注
      ├─ extractHour() → 检测精确时间
      ├─ matchCategory() → 关键词匹配分类
      └─ 返回 InboxResponse（confidence=0.5）
  ↓
前端渲染 AI 结果卡片（title + description + category + taskType）
  ↓
用户确认 → TaskForm（预填所有字段，可修改）
  ↓
POST /api/tasks → 创建任务
```

### 4.3 LLM Prompt 关键规则

**拆项规则：**
- "明天下午学数学2小时，晚上健身" → 2 个 item
- "下周五交报告，月底比赛还想学STM32" → 3 个 item

**标题 vs 备注分离：**
- title 只写核心动作 ≤15字
- description 放具体内容、清单、细节
- "下午3点买菜，买西红柿鸡蛋" → title="采购食材" description="西红柿、鸡蛋"

**taskType 判断：**
- 精确时间（下午3点、9:00-11:00）→ scheduled + startTime/endTime
- 只有日期（周五前、月底）→ planned + deadline
- 无时间 → inbox

**分类规则：**
- COURSE = 课程（作业/考试/上课/四六级）
- LEARNING = 自学（背单词/学Python/看书/刷题/学STM32）
- PRACTICE = 实践（做项目/开发/调试/部署）
- COMPETITION = 竞赛（电赛/比赛/备赛/集训）
- HEALTH = 健康（健身/跑步/早睡/减肥）
- PERSONAL = 生活（购物/买菜/打扫/缴费/聚会）
- EXTERNAL = 外部（老板/客户/会议/汇报/邮件）

### 4.4 Phase 3 知识层（AI 记忆系统）

```
┌─────────────────────────────────────────────┐
│                  决策引擎                     │
│         makeDecision(UserModel + Memory      │
│           + Context) → Action               │
├─────────────────────────────────────────────┤
│  Layer 4: UserModel（聚合画像）               │
│  peakHours / dailyCapacity / trustScore     │
│  commonFailures / taskChunk                  │
├─────────────────────────────────────────────┤
│  Layer 3: AgentMemory（结构化记忆）            │
│  10 条/用户（基线 + 学习 + 衰减）              │
│  importanceScore / status / source           │
├─────────────────────────────────────────────┤
│  Layer 2: UserPattern（统计规律）             │
│  8 条本地规则（零 LLM 成本）                   │
│  time_preference / daily_ceiling / ...       │
├─────────────────────────────────────────────┤
│  Layer 1: UserObservation（原始事件）          │
│  time_modification / pause / skip            │
│  自动写入：Plan 拖拽、Task action              │
└─────────────────────────────────────────────┘
```

**日常 AI 管道（runDailyAIPipeline）：**
每天首次打开 Today 时自动运行（后续缓存）：
1. Pattern Mining（8 条规则）→ 写 UserPattern
2. Memory 生命周期衰减（30/60/90 天）
3. Memory 复活检查
4. UserModel 重算
5. 异常检测（LLM 按需触发）

**冷启动：**
用户注册时自动注入 6 条系统基线 Memory（confidence=0.2）

**隐式纠错：**
用户拖拽任务改时间 → 自动写 UserObservation(type="time_modification") → Pattern Mining 学习偏好

---

## 五、已完成功能清单

### Phase 1：零 AI 可完整使用 ✅

| 功能 | 状态 |
|---|---|
| Inbox 手动创建任务（+ 手动创建按钮 + Modal + TaskForm） | ✅ |
| Plan 点击空白格创建任务（quickCreate 内联表单） | ✅ |
| 统一 TaskForm 确认流程（手动 + AI 统一走 POST /api/tasks） | ✅ |
| Review 行为洞察（黄金时段 + 效率矩阵 + 周趋势 + 拖延率） | ✅ |
| 全链路编译通过（55 页面零错误） | ✅ |

### Phase 2：AI 可选增强 ✅

| 功能 | 状态 |
|---|---|
| Inbox AI 解析规则回退（LLM 失败 → 关键词降级） | ✅ |
| Memory 输出接入 Today 决策（偏好/行为模式 → 分析建议） | ✅ |
| AI 接入端到端验证（Settings→Inbox→TaskForm→Agent→Today） | ✅ |

### Phase 3：AI 深度闭环 ✅

| 功能 | 状态 |
|---|---|
| Schema 升级（UserObservation / UserPattern / UserModel + AgentMemory 6 新字段） | ✅ |
| Pattern Mining 引擎（8 条规则，零 LLM） | ✅ |
| 冷启动基线注入 + Onboarding | ✅ |
| Memory Manager（评分/衰减/冲突/blocked） | ✅ |
| Decision Engine + UserModel 聚合 + Trust Score | ✅ |
| LLM 三级分析 + Memory 复活 + 日常管道 | ✅ |
| AI 记忆仪表盘（Settings UI + API） | ✅ |
| 全管线接通（UserObservation 写入 / 冷启动注册触发 / 管道接入 Today） | ✅ |

### Phase 3 管线接通 ✅

| 管线 | 文件 |
|---|---|
| 拖拽改时间 → UserObservation | `api/plan/move/route.ts` |
| 暂停/跳过 → UserObservation | `api/tasks/[id]/action/route.ts` |
| 注册 → 冷启动基线注入 | `api/auth/register/route.ts` |
| 打开 Today → 日缓存管道 | `api/views/today/route.ts` |
| Today 决策 → UserModel + Decision Engine | `lib/ai/today-decide.ts` |
| Plan 黄金时段显示 | `plan/page.tsx → plan-dashboard → week-calendar` |
| Review AI 归因分析 | `review/page.tsx` |

### UI 整改 ✅

| 改动 |
|---|
| Sidebar 删除预览页入口（生产环境只显示设置） |
| MobileNav 增加 Settings 入口（5 个 Tab 替代原来的 4 个） |
| Inbox 根据 AI 配置动态切换描述/按钮/placeholder |
| Plan 移动端水平滚动支持 |
| Today 空状态改用 EmptyState 组件 |
| Today 布局重排（FocusTaskCard 居中 + 删掉 AIInsightCard） |
| Settings 从 PageHeader 改为 PageHero（统一带 emoji） |
| Review 删除重复的效率矩阵 + 标签字号修复 |
| 全局页面间距统一为 `space-y-6` |
| Undo/Redo z-index 降低避免盖住移动端导航 |
| 四个页面 emoji 统一方案 A：🏠💭🗓️📈 |
| 任务类型中文名：收集箱 / 截止日 / 时间块 |

---

## 六、Inbox AI 解析测试用例

| 输入 | 预期 title | 预期 taskType | 预期 category | 预期 description |
|---|---|---|---|---|
| "下午3点买菜，买西红柿鸡蛋" | 采购食材 | scheduled | PERSONAL | 西红柿、鸡蛋 |
| "明天学数学2小时，晚上健身" | 学数学 + 健身 | scheduled | LEARNING + HEALTH | — |
| "周五前交实验报告" | 完成实验报告 | planned | COURSE | — |
| "背单词" | 背单词 | inbox | LEARNING | — |
| "想学Python和STM32" | 学Python + 学STM32 | inbox | LEARNING | — |

---

## 七、已知待处理

| 项目 | 优先级 |
|---|---|
| AIInsightCard 在其他页面可能也冗余（需逐个核查） | 低 |
| 设计令牌（globals.css CSS 变量）写了但没接入组件，相当于白写 | 低 |
| Plan 页面移动端无天视图降级，只有水平滚动 | 中 |
| WeekCalendar 的 `/week` 路由是历史遗留，可清理 | 低 |

---

## 八、服务器维护

**重启命令：**
```bash
# 杀掉所有 Node 进程
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# 启动
cd G:/Agent_Project/task-manage-sys && npm run dev
```

**常见问题：**
- 服务器卡死 → 僵尸 Node 进程积累。全杀重启即可。
- Turbopack 缓存损坏 → 删除 `.next` 目录后重启。

---

*本报告供新聊天会话快速理解项目全貌。所有代码在 `G:\Agent_Project\task-manage-sys`。*
