# Task OS - Code Wiki

> 生成时间：2026-07-31 | 项目版本：0.1.0 | Phase 3 完成

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [项目目录结构](#3-项目目录结构)
4. [数据库 Schema](#4-数据库-schema)
5. [核心模块详解](#5-核心模块详解)
   - [5.1 认证模块 (Auth)](#51-认证模块-auth)
   - [5.2 API 路由层](#52-api-路由层)
   - [5.3 AI/知识层模块](#53-aiknowledge-module)
   - [5.4 Plan 计划模块](#54-plan-模块)
   - [5.5 Schedule 排程服务](#55-schedule-排程服务)
   - [5.6 Task 任务模块](#56-task-任务模块)
   - [5.7 UserState 用户状态模块](#57-userstate-用户状态模块)
   - [5.8 Inbox 收集箱模块](#58-inbox-收集箱模块)
6. [页面路由与组件](#6-页面路由与组件)
7. [类型系统](#7-类型系统)
8. [关键类与函数说明](#8-关键类与函数说明)
9. [数据流与管线](#9-数据流与管线)
10. [项目运行](#10-项目运行)
11. [设计原则与核心规则](#11-设计原则与核心规则)

---

## 1. 项目概述

**Task OS** 是一个个人任务管理系统，核心理念是 **"帮助用户过滤未来，不是堆积未来"**。它不是传统的待办清单，而是一个减少心理负担的工具——帮用户判断「现在该做什么」。

### 四页面链（核心工作流）

```
Inbox（AI理解入口）→ Plan（时间规划）→ Today（执行驾驶舱）→ Review（复盘学习）
```

| 页面 | 职责 | 路由 |
|------|------|------|
| **Inbox** | 自然语言输入，AI解析为结构化任务 | `/inbox` |
| **Plan** | 周历视图拖拽排期，时间块管理 | `/plan` |
| **Today** | 主任务卡 + 状态仪表盘 + 今日路线 | `/today` |
| **Review** | 完成率/专注时间/行为洞察/AI归因分析 | `/review` |

### 核心理念

- **AI 不是聊天机器人**：AI 是嵌入四个页面的四个不同角色，而非独立对话窗口
- **用户最终控制权**：AI 只建议，不强制。所有 AI 输出都可被用户修改/忽略/关闭
- **零 AI 可用是底线**：未配置 API 的用户也能完整使用所有核心功能

---

## 2. 技术架构

### 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 框架 | Next.js (App Router + Turbopack) | 16.2.11 |
| 语言 | TypeScript | ^5 |
| 数据库 | SQLite (via Prisma ORM) | 5.22.0 |
| 样式 | Tailwind CSS | ^4 |
| 认证 | NextAuth.js (Credentials + JWT) | 5.0.0-beta.32 |
| 密码加密 | bcryptjs | 3.0.3 |
| 数据校验 | Zod | 4.4.3 |
| AI 集成 | OpenAI-compatible API (可选) | - |
| 包管理 | npm | - |

### 架构图示

```
┌──────────────────────────────────────────────────────┐
│                   前端 (React 19)                      │
│  (auth)/    (dashboard)/                              │
│  login      today / inbox / plan / review / settings  │
│  register   + 15 components + 5 hooks                 │
├──────────────────────────────────────────────────────┤
│              API 路由层 (Next.js Route Handlers)       │
│  /api/tasks/*  /api/plan/*  /api/ai/*                  │
│  /api/inbox/*  /api/agent/*  /api/views/*              │
│  /api/auth/*   /api/schedule/*  /api/user-state/*     │
├──────────────────────────────────────────────────────┤
│           lib 层 (业务逻辑 + AI 引擎)                  │
│  ├── ai/       (Parser, Decision Engine, Memory Mgr)  │
│  ├── plan/     (Adapter, Service, Colors, Types)      │
│  ├── schedule/ (Schedule Service - 唯一时间数据源)     │
│  ├── task/     (Execution, Monitor, Resolver)          │
│  ├── user-state/  (State management)                  │
│  └── context/     (Agent context, Decision context)   │
├──────────────────────────────────────────────────────┤
│           Prisma ORM (数据库访问层)                    │
│  models: User, Task, Schedule, AgentMemory,           │
│  UserPattern, UserModel, UserObservation, etc.        │
├──────────────────────────────────────────────────────┤
│              SQLite (dev.db)                           │
└──────────────────────────────────────────────────────┘
```

---

## 3. 项目目录结构

```
task-manage-sys/
├── prisma/
│   ├── schema.prisma          # 完整数据模型定义
│   ├── dev.db                 # SQLite 开发数据库
│   └── migrations/            # 数据库迁移记录
├── src/
│   ├── app/
│   │   ├── (auth)/            # 认证页面组
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/       # 主控制台页面组
│   │   │   ├── layout.tsx     # Dashboard 布局 (认证守卫 + Shell)
│   │   │   ├── today/page.tsx
│   │   │   ├── inbox/page.tsx
│   │   │   ├── plan/page.tsx
│   │   │   ├── review/page.tsx
│   │   │   ├── week/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── *-preview/     # 仅开发可见的预览页
│   │   ├── api/               # API 路由
│   │   │   ├── tasks/         # 任务 CRUD
│   │   │   ├── plan/          # 计划操作
│   │   │   ├── inbox/         # 收集箱 AI 分析
│   │   │   ├── ai/            # AI 解析/决策/建议
│   │   │   ├── agent/         # Agent 对话/记忆/配置
│   │   │   ├── views/         # 页面视图聚合 (today/stats/week)
│   │   │   ├── schedule/      # 排程查询
│   │   │   ├── auth/          # 认证 (注册 + NextAuth)
│   │   │   ├── ai-config/     # AI 配置 CRUD
│   │   │   ├── user-state/    # 用户状态管理
│   │   │   ├── daily-note/    # 每日笔记
│   │   │   └── decision/      # 决策分析/确认
│   │   ├── layout.tsx         # 根布局 (Metadata + AuthProvider)
│   │   ├── page.tsx           # 根页面 (redirect → /today)
│   │   └── globals.css        # 全局样式 + Tailwind
│   ├── components/
│   │   ├── ui/                # 通用 UI 组件 (Button, Card, Modal, Badge, etc.)
│   │   │   └── interaction/   # 交互动效 (AnimatedModal, HoverCard, etc.)
│   │   ├── today/             # Today 页面专属组件
│   │   ├── plan/              # Plan 页面专属组件
│   │   ├── ai/                # AI 相关组件
│   │   ├── task/              # 任务卡片/状态组件
│   │   ├── status/            # 状态指示组件 (Empty/Loading/Error States)
│   │   ├── DashboardShell.tsx # 主布局外壳 (Sidebar + 内容区 + MobileNav)
│   │   ├── sidebar.tsx       # 桌面端侧边导航
│   │   ├── mobile-nav.tsx    # 移动端底部导航
│   │   ├── auth-provider.tsx # SessionProvider 包装器
│   │   ├── task-form.tsx     # 统一任务创建/编辑表单
│   │   └── timer.tsx         # 计时器组件
│   ├── lib/
│   │   ├── ai/                # AI 引擎核心
│   │   │   ├── client.ts      # AI API 客户端 (OpenAI-compatible)
│   │   │   ├── parser.ts      # Inbox 自然语言解析器 (LLM + Fallback)
│   │   │   ├── today-decide.ts# Today 规则决策引擎
│   │   │   ├── pattern-mining.ts   # 8条本地规则 Pattern Mining
│   │   │   ├── cold-start.ts       # 冷启动基线 Memory 注入
│   │   │   ├── memory-manager.ts   # Memory 评分/衰减/冲突解决
│   │   │   ├── decision-engine.ts  # 决策引擎 + UserModel 聚合
│   │   │   ├── advanced.ts         # LLM 三级分析 + 日常管道
│   │   │   ├── decision/      # 决策子模块
│   │   │   │   ├── advisor.ts       # 任务安排顾问
│   │   │   │   ├── analyzer.ts      # 计划分析器
│   │   │   │   ├── execution-advisor.ts # 执行建议
│   │   │   │   ├── executor.ts      # 决策执行器
│   │   │   │   ├── scheduler.ts     # AI 调度器
│   │   │   │   └── interface.ts     # 决策接口定义
│   │   │   ├── context.ts     # Agent 上下文构建
│   │   │   ├── tools.ts       # Agent 工具定义
│   │   │   ├── planner.ts     # AI 计划编排
│   │   │   ├── feedback.ts    # AI 反馈收集
│   │   │   ├── today-decision.ts  # 今日决策生成
│   │   │   ├── daily-summary.ts   # 每日摘要
│   │   │   ├── daily-brief.ts     # 每日简报
│   │   │   ├── memory-learning.ts # 记忆学习
│   │   │   ├── pause-advisor.ts   # 暂停顾问
│   │   │   └── user-state.ts      # 用户状态解析
│   │   ├── plan/              # 计划模块
│   │   │   ├── service.ts     # Plan 业务逻辑 (getWeeklyPlan/getDailyPlan/movePlanItem)
│   │   │   ├── adapter.ts     # 数据适配器 (后端 Schedule → 前端 AdaptedDay)
│   │   │   ├── time.ts        # 显示时间/真实时间转换
│   │   │   ├── colors.ts      # 领域颜色系统 + 解析
│   │   │   ├── types.ts       # Plan 类型定义
│   │   │   ├── calendar-constants.ts  # 日历常量
│   │   │   └── conflict.ts    # 时间冲突检测
│   │   ├── schedule/          # 排程服务 (唯一时间数据源)
│   │   │   └── service.ts     # create/move/replace/delete Schedule
│   │   ├── task/              # 任务执行模块
│   │   │   ├── execution.ts         # 执行统计 (planned/actual/difference)
│   │   │   ├── execution-monitor.ts # 超时/遗漏/连续延迟检测
│   │   │   ├── execution-feedback.ts# 执行反馈收集
│   │   │   ├── resolver.ts          # 关键词 → taskId 解析器
│   │   │   └── task-execution-state.ts # 任务执行状态管理
│   │   ├── user-state/
│   │   │   └── state.ts       # 用户状态管理
│   │   ├── context/
│   │   │   ├── agent-context.ts    # Agent 对话上下文
│   │   │   ├── decision-context.ts # 决策上下文
│   │   │   └── shared-context.ts   # 共享上下文
│   │   ├── inbox/
│   │   │   ├── confirm-service.ts  # Inbox 确认服务
│   │   │   └── task-builder.ts     # 任务构建器
│   │   ├── prisma.ts          # Prisma Client 单例
│   │   ├── auth.ts            # NextAuth 配置 (Credentials + JWT)
│   │   └── api-utils.ts       # 通用 API 工具 (getServerSession, unauthorized, badRequest)
│   ├── types/
│   │   ├── task.ts            # 任务类型枚举 + 标签映射
│   │   └── inbox.ts           # Inbox 请求/响应类型
│   └── hooks/
│       └── usePlan.ts         # Plan 页面核心 Hook (数据/拖拽/撤销/重做)
├── public/                    # 静态资源
├── scripts/                   # 工具脚本
├── docs/                      # 项目文档
├── .workbuddy/memory/         # AI 会话记忆
├── package.json               # 项目依赖与脚本
├── next.config.ts             # Next.js 配置
├── tailwind.config.ts         # (Tailwind v4 使用 CSS-based config)
└── postcss.config.mjs         # PostCSS 配置
```

---

## 4. 数据库 Schema

### 4.1 核心表

#### User — 用户账户

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  nickname     String?
}
```

关联关系：User 拥有 tasks, timeLogs, dailySummaries, schedules, memories, patterns, userModel 等全部数据。

#### Task — 任务

```prisma
model Task {
  id               String    @id @default(uuid())
  userId           String
  parentId         String?         // 子任务父级
  title            String
  description      String?
  taskType         String    @default("inbox")   // inbox | planned | scheduled
  status           String    @default("not_started")
  startTime        DateTime?
  endTime          DateTime?
  deadline         DateTime?
  importance       Int       @default(3)         // 1-5 星
  temperature      String    @default("normal")  // exploding | hot | normal | longterm
  estimatedMinutes Int?
  actualMinutes    Int       @default(0)
  category         String?                       // COURSE | LEARNING | PRACTICE | ...
  complexity       String?                       // low | medium | high
  riskLevel        String?
  dependencies     String?
  scheduleAdvice   String?
  phaseOrder       Int       @default(0)
  cognitiveLoad    String?
  schedulingHint   String?
  postponedCount   Int       @default(0)         // Phase 3: 任务腐化计数
}
```

**关键索引**：`[userId, status]`, `[userId, taskType]`, `[userId, category]`, `[userId, deadline]`, `[parentId]`

#### Schedule — 排程时间（唯一时间数据源）

```prisma
model Schedule {
  id             String   @id @default(uuid())
  taskId         String
  userId         String
  scheduledStart DateTime
  scheduledEnd   DateTime?
  source         String   @default("manual")   // manual | ai | user
}
```

**核心规则**：Schedule 是唯一时间数据源，所有时间变更（创建/移动/删除）必须通过 Schedule Service。

#### TimeLog — 执行日志

```prisma
model TimeLog {
  id              String   @id @default(uuid())
  taskId          String
  userId          String
  startedAt       DateTime
  endedAt         DateTime?
  durationSeconds Int      @default(0)
  type            String                      // start | pause | resume | complete
}
```

#### DailySummary — 每日统计

```prisma
model DailySummary {
  date           String
  completedCount Int
  totalMinutes   Int
}
```

#### AgentMemory — AI 记忆

```prisma
model AgentMemory {
  memoryType      String    // preference | behavior_pattern | warning | hard_constraint | ability
  content         String
  confidence      Float     @default(0.7)
  status          String    @default("active") // active | dormant | retired | blocked
  dimension       String?                      // preference | ability
  importanceScore Float     @default(0)
  contextTags     String?
  evidenceCount   Int       @default(0)
  lastUsedAt      DateTime?
}
```

| status 值 | 含义 |
|-----------|------|
| `active` | 当前生效中 |
| `dormant` | 60天未使用，休眠 |
| `retired` | 90天未使用，退休（可复活） |
| `blocked` | 用户手动屏蔽 |

#### AIConfig — AI API 配置

```prisma
model AIConfig {
  userId   String   @unique
  provider String   @default("openai")
  baseUrl  String   @default("https://api.openai.com/v1")
  apiKey   String
  model    String   @default("gpt-4o")
}
```

### 4.2 Phase 3 AI 知识层表

#### Layer 1: UserObservation — 原始行为事件

```prisma
model UserObservation {
  type      String    // time_modification | pause | skip
  taskId    String?
  category  String?
  detail    String    // JSON 格式的详细信息
  timestamp DateTime
}
```

**自动写入场景**：
- Plan 拖拽改时间 → `time_modification`
- 暂停/跳过任务 → `pause` / `skip`

#### Layer 2: UserPattern — 统计规律

```prisma
model UserPattern {
  pattern       String   // time_preference_morning | over_planned | peak_hour | ...
  condition     String
  metric        String
  confidence    Float
  evidenceCount Int
}
```

**8 条本地规则（零 LLM 成本）**：
1. `time_preference` — 时间偏好（上午/下午/晚上）
2. `time_underestimation` — 时间低估
3. `over_planned` — 过度计划（延迟率 > 30%）
4. `category_blocking_*` — 分类难度阻塞
5. `daily_ceiling` — 每日容量上限（连续5天≤4h）
6. `category_avoidance_*` — 分类回避
7. `peak_hour` — 高峰时段
8. `weekly_fatigue` — 周疲劳（周五完成率 < 周一 × 0.6）

#### Layer 4: UserModel — 聚合用户画像

```prisma
model UserModel {
  userId         String   @unique
  peakHours      String   @default("[]")  // JSON: ["9","10","15"]
  dailyCapacity  Float    @default(0)
  taskChunk      String?                  // 任务拆分建议
  commonFailures String   @default("[]")  // JSON: 常见失败类型
  trustScore     Float    @default(0.5)   // AI 信任分
}
```

### 4.3 其他支撑表

| 表 | 用途 |
|----|------|
| `UserProfile` | 用户画像 (identity/wakeTime/sleepTime/peakEnergy) |
| `UserState` | 当前状态 (energy/focus/mood/stress 及决策权重) |
| `DecisionLog` | AI 决策记录 (含 memoryId/confidence/outcome) |
| `TodayDecision` | 今日 AI 决策 (mustDo/recommended/reason) |
| `TaskDraft + TaskDraftItem` | Inbox AI 解析结果暂存 |
| `TaskExecutionFeedback` | 任务执行反馈 (暂停原因等) |
| `DailyBrief` | 每日简报 |
| `AgentFeedback` | AI 建议 → 用户反馈闭环 |

---

## 5. 核心模块详解

### 5.1 认证模块 (Auth)

**文件**：[`src/lib/auth.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/auth.ts)

使用 **NextAuth.js v5** 的 Credentials Provider + JWT Session 策略。

```typescript
// 认证方式
Credentials({ email, password }) → bcrypt.compare → JWT token

// Session 结构
session.user = { id, email, name }
```

**关键导出**：
| 导出 | 用途 |
|------|------|
| `auth` | 服务端获取 session |
| `signIn` | 客户端登录 |
| `signOut` | 客户端登出 |
| `handlers` | Next.js Route Handler (GET/POST) |

**API 路由**：[`src/app/api/auth/[...nextauth]/route.ts`](file:///g:/Agent_Project/task-manage-sys/src/app/api/auth/%5B...nextauth%5D/route.ts)

**注册 API**：[`src/app/api/auth/register/route.ts`](file:///g:/Agent_Project/task-manage-sys/src/app/api/auth/register/route.ts) — 注册时自动触发 `injectBaselineMemories()` 冷启动。

**组件**：[`src/components/auth-provider.tsx`](file:///g:/Agent_Project/task-manage-sys/src/components/auth-provider.tsx) — 客户端 SessionProvider 包装器。

---

### 5.2 API 路由层

采用 Next.js App Router 的 Route Handler 模式，按资源组织在 `src/app/api/` 下。

#### 主要 API 端点一览

| 端点 | 方法 | 功能 | 关键文件 |
|------|------|------|----------|
| `/api/tasks` | GET/POST | 任务列表查询 / 创建任务 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/tasks/route.ts) |
| `/api/tasks/[id]` | GET/PUT/DELETE | 单个任务 CRUD | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/tasks/%5Bid%5D/route.ts) |
| `/api/tasks/[id]/action` | POST | 任务操作 (start/pause/complete/skip) | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/tasks/%5Bid%5D/action/route.ts) |
| `/api/tasks/[id]/timer` | POST | 任务计时器 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/tasks/%5Bid%5D/timer/route.ts) |
| `/api/plan/week` | GET | 获取周计划数据 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/plan/week/route.ts) |
| `/api/plan/day` | GET | 获取日计划 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/plan/day/route.ts) |
| `/api/plan/move` | POST | 拖拽移动任务时间 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/plan/move/route.ts) |
| `/api/plan/delete` | POST | 删除排期项 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/plan/delete/route.ts) |
| `/api/plan/analyze` | POST | 计划分析 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/plan/analyze/route.ts) |
| `/api/plan/apply-decision` | POST | 应用 AI 决策 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/plan/apply-decision/route.ts) |
| `/api/inbox/analyze` | POST | Inbox 自然语言 AI 解析 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/inbox/analyze/route.ts) |
| `/api/inbox/confirm` | POST | 确认 AI 解析结果 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/inbox/confirm/route.ts) |
| `/api/views/today` | GET | Today 页面聚合数据 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/views/today/route.ts) |
| `/api/views/stats` | GET | 统计面板数据 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/views/stats/route.ts) |
| `/api/views/today/refresh` | POST | 刷新 Today 缓存 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/views/today/refresh/route.ts) |
| `/api/ai/parse` | POST | AI 深度任务解析 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/ai/parse/route.ts) |
| `/api/ai/today-decide` | POST | Today AI 决策 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/ai/today-decide/route.ts) |
| `/api/ai/plan` | POST | AI 排程建议 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/ai/plan/route.ts) |
| `/api/ai/ingest` | POST | AI 摄入上下文 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/ai/ingest/route.ts) |
| `/api/ai-config` | GET/PUT/DELETE | AI 配置管理 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/ai-config/route.ts) |
| `/api/agent/chat` | POST | AI Agent 对话 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/agent/chat/route.ts) |
| `/api/agent/memory` | GET/POST | Agent 记忆查询/写入 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/agent/memory/route.ts) |
| `/api/agent/memory/dashboard` | GET | 记忆仪表盘数据 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/agent/memory/dashboard/route.ts) |
| `/api/agent/state` | GET/POST | Agent 状态管理 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/agent/state/route.ts) |
| `/api/user-state` | GET/POST | 用户当前状态 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/user-state/route.ts) |
| `/api/schedule` | GET | 排程查询 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/schedule/route.ts) |
| `/api/daily-note` | GET/PUT | 每日笔记 | [route.ts](file:///g:/Agent_Project/task-manage-sys/src/app/api/daily-note/route.ts) |

#### 通用工具

[`src/lib/api-utils.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/api-utils.ts)：

| 函数 | 用途 |
|------|------|
| `getServerSession()` | 获取已认证的 session，未登录返回 null |
| `unauthorized()` | 返回 401 JSON 响应 |
| `badRequest(msg)` | 返回 400 JSON 响应 |

---

### 5.3 AI/Knowledge Module

AI 模块是整个系统的"大脑"，位于 `src/lib/ai/` 下，实现从任务解析到行为学习的完整链路。

#### 5.3.1 AI Client — API 调用层

**文件**：[`src/lib/ai/client.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/client.ts)

| 导出函数 | 参数 | 说明 |
|----------|------|------|
| `getUserAIConfig(userId)` | userId | 从数据库读取用户 AI 配置 |
| `callAI(userId, systemPrompt, userMessage)` | userId, 系统提示, 用户消息 | 通用 AI 单次调用 |
| `callAgent(userId, userMessage)` | userId, 用户消息 | Agent 对话调用（含完整上下文） |

**`callAI` 流程**：读取 AIConfig → 构建 OpenAI-compatible 请求 → 发送到用户配置的 API → 返回 content

**Agent 调用流程**：`callAgent` → 构建包含用户画像/状态/记忆/今日数据的 System Prompt → 调用 AI → 返回 JSON 含 toolCalls

#### 5.3.2 Parser — Inbox 解析引擎

**文件**：[`src/lib/ai/parser.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/parser.ts)

实现了两套解析管线：

**主解析器 `analyzeInboxInput(userId, content)`**：
```
AI 已配置 → callAI(INBOX_ANALYZER_PROMPT) → 解析 JSON → InboxResponse
  ├─ 成功 → 返回结构化结果
  └─ 失败 → 回退到 fallback
AI 未配置 → fallbackAnalyzeInboxInput(content)
```

**降级解析器 `fallbackAnalyzeInboxInput(content)`**（纯本地规则，不依赖 AI）：
```
splitIntoSegments()       → 按连接词拆段
extractCoreAction()       → 提取核心动作（≤15字）
extractDescription()      → 提取备注
matchCategory()           → 关键词匹配分类
extractRelativeDate()     → 识别明天/后天/下周
extractExplicitDate()     → 识别 YYYY-MM-DD
extractHour()             → 检测精确时间
→ 返回 InboxResponse (confidence=0.5)
```

**分类规则**：COURSE(课程) / LEARNING(自学) / PRACTICE(实践) / COMPETITION(竞赛) / HEALTH(健康) / PERSONAL(生活) / EXTERNAL(外部)

**taskType 判断**：
- 精确时间（下午3点、9:00）→ `scheduled`
- 只有日期（周五前、月底）→ `planned`
- 无时间 → `inbox`

#### 5.3.3 Pattern Mining — 8条本地规则

**文件**：[`src/lib/ai/pattern-mining.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/pattern-mining.ts)

**入口**：`runPatternMining(userId)` → 依次执行 8 条规则 → 每个发现写/更新 `UserPattern`

| # | 规则函数 | 检测内容 | 数据源 |
|---|---------|---------|--------|
| 1 | `mineTimePreference` | 用户反复将任务移到某个时段 | UserObservation(type=time_modification) |
| 2 | `mineTimeDeviation` | 实际耗时 > 预估 × 1.5 | Task(estimated/actual) |
| 3 | `mineOverPlanned` | 延迟率 > 30% | Task(status=delayed) |
| 4 | `mineCategoryBlocking` | 同一分类 3+ 次暂停=太难 | TaskExecutionFeedback |
| 5 | `mineDailyCeiling` | 连续 5 天完成 ≤ 4h | DailySummary |
| 6 | `mineCategoryAvoidance` | 同一分类跳过 3+ 次 | UserObservation(type=skip) |
| 7 | `minePeakHour` | 某时段启动任务次数显著高 | TimeLog |
| 8 | `mineWeeklyFatigue` | 周五完成率 < 周一 × 0.6 | DailySummary |

#### 5.3.4 Memory Manager — 记忆生命周期管理

**文件**：[`src/lib/ai/memory-manager.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/memory-manager.ts)

| 导出函数 | 功能 |
|----------|------|
| `computeImportanceScore(memoryId)` | 计算记忆重要度: confidence×0.4 + usageFrequency×0.25 + recency×0.2 + impact×0.15 |
| `getTopMemories(userId, n)` | 获取 top N 活跃记忆（按 importanceScore 排序）|
| `runMemoryLifecycle(userId)` | 每日衰减：30天置信度×0.8，60天→dormant，90天→retired |
| `resolveMemoryConflicts(memories)` | 冲突解决：按 source 优先级 + confidence 排序，高者胜出 |
| `blockMemory(memoryId)` | 用户屏蔽记忆 → status="blocked" |
| `checkBlockedMemoryRevival(userId)` | 检查被屏蔽记忆是否有新证据支持 |

**Source 优先级链**：`hard_constraint(100) > user_declaration(90) > user_correction(80) > pattern_mining(60) > ai_analysis(40) > system_baseline(10)`

#### 5.3.5 Decision Engine — 决策引擎

**文件**：[`src/lib/ai/decision-engine.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/decision-engine.ts)

**入口**：`makeDecision(input: DecisionInput)` → `DecisionOutput`

```
决策规则链（按优先级）：
1. 硬约束检查 → 直接 skip
2. 截止时间危机（< 24h + importance ≥ 4）→ do_now
3. 低精力 + 非紧急 → reduce_scope
4. 当前处于高效时段 → do_now
5. 当前不在高效时段 → reschedule_morning/reschedule_afternoon
6. 默认 → do_now
```

**决策输出**：
```typescript
interface DecisionOutput {
  action: "do_now" | "reschedule_morning" | "reschedule_afternoon" | "reduce_scope" | "skip"
  reason: string
  reasoning: string[]      // 解释层
  confidence: number
  actionRisk: "low" | "medium" | "high"
  memoryUsed: string[]     // 引用的 Memory 内容
}
```

**其他导出**：
- `recomputeUserModel(userId)` — 从 Memory + Pattern 重算 UserModel
- `computeTrustScore(userId)` — 基于决策接受率计算信任分（拒绝惩罚×2）
- `canAutoExecute(trustScore, actionRisk)` — 判断 AI 是否可自动执行

#### 5.3.6 Today Decide — Today 决策引擎

**文件**：[`src/lib/ai/today-decide.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/today-decide.ts)

**入口**：`analyzeToday(input: TodayDecideInput)` → `TodayDecideResult`

```
用户输入自然语言 → detectIntent()
  ├─ skip    → genSkip(减少时间/延期/交换)
  ├─ postpone→ genPostpone(1天/3天)
  ├─ too_hard→ genTooHard(降低量/延期/切换简单任务)
  ├─ state_bad → genStateBad(减少所有/延期当前/只保留必须)
  ├─ swap    → 与另一任务交换
  └─ unknown → 通用建议
→ Memory 增强（读取相关偏好 & 行为模式）
→ DecisionEngine 增强（UserModel + makeDecision）
→ 返回 analysis + options
```

#### 5.3.7 Advanced — 日常 AI 管道

**文件**：[`src/lib/ai/advanced.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/advanced.ts)

**`runDailyAIPipeline(userId)`** — 每日管道（Today 打开时触发，每天一次）：

```
1. runPatternMining()        — 8条规则 (零 LLM)
2. runMemoryLifecycle()      — Memory 衰减
3. checkMemoryResurrection() — Memory 复活检查
4. recomputeUserModel()      — UserModel 重算
5. triggerAnomalyAnalysis()  — 异常检测 (LLM 按需)
```

**三级分析**：
- Level 1: Daily — Pattern Mining (零 LLM)
- Level 2: Anomaly — 完成率下降 >40% 或 跳过激增 (LLM 触发)
- Level 3: Monthly — 月度深度分析 (LLM)

#### 5.3.8 Cold Start — 冷启动基线

**文件**：[`src/lib/ai/cold-start.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/cold-start.ts)

| 函数 | 调用时机 |
|------|----------|
| `injectBaselineMemories(userId)` | 用户注册时，注入 6 条系统基线 Memory (confidence=0.2) |
| `createOnboardingMemories(userId, answers)` | 用户完成 onboarding 问答 |
| `createUserDeclaration(userId, content, memoryType)` | 用户明确告知 AI 信息 (confidence=1.0) |

**6 条基线记忆**：
1. 午后 14:00-15:00 是注意力低谷
2. 连续工作超 90 分钟效率下降
3. 大任务应拆为 30-45 分钟小块
4. 周一精力最好
5. 睡前 1 小时不宜屏幕任务
6. 早上先做最难的任务

---

### 5.4 Plan 模块

#### 5.4.1 Plan Service

**文件**：[`src/lib/plan/service.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/plan/service.ts)

| 导出函数 | 功能 |
|----------|------|
| `getWeeklyPlan(userId, weekStart)` | 查询一周 Schedule + Task，去重后返回 WeeklyPlan |
| `getDailyPlan(userId, date)` | 查询单日 Schedule，返回 DailyPlan |
| `movePlanItem(userId, taskId, newStart, newEnd?)` | 移动任务时间 → 调用 Schedule Service |
| `deletePlanItem(userId, taskId)` | 删除排期项 → 任务回到 UnscheduledPool |

**去重逻辑** `deduplicate()`：同一 taskId + 同日 → 保留最新 schedule。

#### 5.4.2 Plan Adapter — 数据适配器

**文件**：[`src/lib/plan/adapter.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/plan/adapter.ts)

**核心函数** `adaptPlanData(planItems, rawTasks, weekStart)`：

将后端 Schedule/Task 数据转换为前端可渲染的格式：
- **AdaptedDay[]**：按天分组的时段任务 (morning/afternoon/evening/midnight)
- **AdaptedIdeas[]**：未排期的 inbox 任务
- **DeadlineItem[]**：本周截止的任务
- **DayDensity**：每日密度计算 (totalMinutes / 900 × 100 = fullness%)

**辅助函数**：
- `computeDayDensity(day)` — 计算日排程密度 (low 0-25% / medium 25-50% / high 50-80% / overload 80%+)
- `mapSource(source)` — 来源映射 (ai → AI_PROPOSED, ai_fallback → SYSTEM, 其他 → HARD)

#### 5.4.3 Plan Time — 时间显示转换

**文件**：[`src/lib/plan/time.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/plan/time.ts)

凌晨 0-3 点的任务在视觉上归入前一天的晚上时段，`realTimeToVisualTime()` 和 `visualTimeToRealTime()` 互为逆转换。

#### 5.4.4 Plan Colors — 领域颜色

**文件**：[`src/lib/plan/colors.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/plan/colors.ts)

8 个领域（COURSE/LEARNING/PRACTICE/COMPETITION/HEALTH/PERSONAL/EXTERNAL/OTHER），每个有固定的 border/bg 颜色 + emoji 图标。`resolveDomain()` 从 tags 或标题关键词推断领域。

#### 5.4.5 Plan Hook — usePlan

**文件**：[`src/hooks/usePlan.ts`](file:///g:/Agent_Project/task-manage-sys/src/hooks/usePlan.ts)

Plan 页面的核心状态管理 Hook：

| 状态/方法 | 说明 |
|-----------|------|
| `days` | AdaptedDay[] — 前端渲染数据 |
| `ideas` | AdaptedIdeas[] — 未排期任务 |
| `deadlineTasks` | DeadlineItem[] — 截止任务 |
| `analysis` | PlanAnalysisResult | null |
| `handleTaskMove(taskId, date, hour, minute)` | 拖拽移动任务 |
| `handleUndo()` / `handleRedo()` | 撤销/重做（20步栈） |
| `handleApplyDecision(optionId, changes)` | 应用 AI 决策 |
| `handleDelete(taskId)` | 删除排期项 |
| `undoStack` / `redoStack` | UndoEntry[] |

---

### 5.5 Schedule 排程服务

**文件**：[`src/lib/schedule/service.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/schedule/service.ts)

**核心原则**：Schedule 是唯一时间数据源，所有时间变更必须走此 Service。

| 函数 | 说明 | 事务 |
|------|------|------|
| `createSchedule(userId, taskId, start, end)` | 创建排程（先删除旧的再创建） | 否 |
| `createScheduleWithSource(userId, taskId, start, end, source)` | 带来源的创建 | 否 |
| `addSchedule(userId, taskId, start, end, source)` | 追加排程（不删除旧的） | 否 |
| `addManySchedules(userId, taskId, slots, source)` | 批量追加（repeat用） | $transaction |
| `moveSchedule(userId, taskId, newStart, newEnd)` | 移动排程（验证写入） | $transaction |
| `deleteFutureSchedules(userId, taskId)` | 删除未来排程 | 否 |
| `deleteAllSchedules(taskId)` | 删除全部排程 | 否 |
| `replaceSchedule(userId, taskId, newStart, newEnd, source)` | 替换未来排程 | $transaction |
| `updateSchedule(scheduleId, userId, data)` | 更新排程（禁止时间修改） | 否 |
| `deleteScheduleById(scheduleId, userId)` | 按 ID 删除 | 否 |

**每次操作自动写入 DecisionLog**（异步，失败静默忽略）。

---

### 5.6 Task 任务模块

#### 5.6.1 Task Resolver

**文件**：[`src/lib/task/resolver.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/task/resolver.ts)

LLM 不出 taskId（只出 keyword），由 Resolver 在后端将 keyword 解析为 taskId。

```typescript
resolveTask(userId, keyword)
  → 精确匹配 title
  → 模糊匹配 title (contains)
  → 多结果时返回 needChoose=true + candidates
  → Schedule 标题匹配
```

#### 5.6.2 Task Execution

**文件**：[`src/lib/task/execution.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/task/execution.ts)

| 函数 | 说明 |
|------|------|
| `getPlannedMinutes(taskId)` | 从 Schedule 获取计划时长 → 回退到 Task.estimatedMinutes |
| `getActualMinutes(taskId)` | 从 TimeLog 聚合实际耗时 |
| `getTaskExecutionStats(taskId)` | 完整执行统计 (planned/actual/difference/completionRate) |
| `getCompletionPercent(taskId)` | 完成百分比 |
| `getTodayTimeline(userId)` | 生成今日时间轴 |

#### 5.6.3 Task Execution Monitor

**文件**：[`src/lib/task/execution-monitor.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/task/execution-monitor.ts)

| 函数 | 说明 |
|------|------|
| `checkOvertime(taskId)` | 检测超时（当前时间超出 scheduledEnd） |
| `checkMissSchedule(userId)` | 检测遗漏（scheduledEnd 已过但未启动） |
| `checkConsecutiveDelay(userId, taskId)` | 检测连续延迟 |

---

### 5.7 UserState 用户状态模块

**文件**：[`src/lib/user-state/state.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/user-state/state.ts) 和 [`src/lib/ai/user-state.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/ai/user-state.ts)

管理用户的 energy/focus/mood/stress 状态，每个状态带有：
- `impactLevel` — 对决策的影响程度 (low/medium/high)
- `decisionWeight` — 决策中的权重 (0-1)
- `confidence` — 状态可信度
- `validUntil` — 有效期

---

### 5.8 Inbox 收集箱模块

**文件**：
- [`src/lib/inbox/confirm-service.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/inbox/confirm-service.ts) — 确认 AI 解析结果并创建任务
- [`src/lib/inbox/task-builder.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/inbox/task-builder.ts) — 任务构建器

Inbox 流程：
```
用户输入 → POST /api/inbox/analyze → AI 解析 → 返回 TaskDraft + TaskDraftItem[]
→ 前端展示 → 用户确认/修改 → POST /api/inbox/confirm → 创建 Task + Schedule
```

---

## 6. 页面路由与组件

### 6.1 路由结构

| 路由 | 页面组件 | 布局 | 认证 |
|------|----------|------|------|
| `/` | `page.tsx` | RootLayout | 重定向到 /today |
| `/login` | `(auth)/login/page.tsx` | RootLayout | 公开 |
| `/register` | `(auth)/register/page.tsx` | RootLayout | 公开 |
| `/today` | `(dashboard)/today/page.tsx` | DashboardLayout | 需要登录 |
| `/inbox` | `(dashboard)/inbox/page.tsx` | DashboardLayout | 需要登录 |
| `/plan` | `(dashboard)/plan/page.tsx` | DashboardLayout | 需要登录 |
| `/review` | `(dashboard)/review/page.tsx` | DashboardLayout | 需要登录 |
| `/week` | `(dashboard)/week/page.tsx` | DashboardLayout | 需要登录 |
| `/settings` | `(dashboard)/settings/page.tsx` | DashboardLayout | 需要登录 |

### 6.2 关键组件

#### 布局组件

| 组件 | 文件 | 职责 |
|------|------|------|
| `RootLayout` | [src/app/layout.tsx](file:///g:/Agent_Project/task-manage-sys/src/app/layout.tsx) | 根 HTML 结构, Metadata, PWA 配置, AuthProvider |
| `DashboardLayout` | [src/app/(dashboard)/layout.tsx](file:///g:/Agent_Project/task-manage-sys/src/app/%28dashboard%29/layout.tsx) | 认证守卫 + DashboardShell |
| `DashboardShell` | [src/components/DashboardShell.tsx](file:///g:/Agent_Project/task-manage-sys/src/components/DashboardShell.tsx) | Sidebar + 内容区 + MobileNav + Ctrl+Arrow 快捷键 |
| `Sidebar` | [src/components/sidebar.tsx](file:///g:/Agent_Project/task-manage-sys/src/components/sidebar.tsx) | 桌面端侧边导航（可折叠） |
| `MobileNav` | [src/components/mobile-nav.tsx](file:///g:/Agent_Project/task-manage-sys/src/components/mobile-nav.tsx) | 移动端底部 5 Tab 导航 |

#### Today 页面组件

| 组件 | 职责 |
|------|------|
| `FocusTaskCard` | 视觉中心的当前主任务卡 |
| `TodayBriefCard` | 今日简报（问候 + 状态 + 建议） |
| `TodayRoute` | 今日路线时间线 |
| `TodayAIPanel` | AI 助手面板 |
| `CompletionSummaryCard` | 完成度摘要 |
| `MustDoList` | 必须完成列表 |
| `PauseDialog` | 暂停确认弹窗 |
| `TodayStatusAdviceCard` | 状态建议卡片 |

#### Plan 页面组件

| 组件 | 职责 |
|------|------|
| `WeekCalendar` | 周历主视图 |
| `CalendarGrid` | 日历网格（时间段 × 星期） |
| `CalendarTaskBlock` | 日历上的任务块（可拖拽） |
| `PlanDashboard` | 计划仪表盘（密度统计） |
| `PlanHeader` | 周导航头 |
| `DeadlinePool` | 截止任务池 |
| `UnscheduledPool` | 未排期任务池 |
| `DecisionPanel` | AI 决策面板 |
| `UndoRedo` | 撤销/重做控制 |
| `TaskDetailPanel` | 任务详情侧面板 |

#### 通用 UI 组件

| 组件 | 职责 |
|------|------|
| `Button` | 通用按钮 |
| `Card` | 通用卡片容器 |
| `Modal` | 模态框 |
| `Badge` | 标签徽章 |
| `Input` | 表单输入 |
| `PageContainer` | 页面容器 |
| `PageHeader` | 页面标题栏 |
| `PageHero` | 页面 Hero 区（带 emoji） |
| `Section` | 内容分区 |
| `EmptyState` | 空状态占位 |
| `LoadingState` | 加载状态 |
| `ErrorState` | 错误状态 |
| `StatusBadge` | 状态徽章 |
| `StatusIndicator` | 状态指示器 |
| `StatusMeter` | 状态仪表 |
| `AnimatedModal` | 动画模态框 |
| `FadeTransition` | 淡入过渡 |
| `HoverCard` | 悬停卡片 |
| `PulseLoader` | 脉冲加载 |
| `DragOverlay` | 拖拽覆盖层 |

#### 关键业务组件

| 组件 | 职责 |
|------|------|
| `TaskForm` | 统一任务创建/编辑表单（类型/重要度/时间/分类/标签） |
| `TaskCard` | 任务卡片 |
| `TaskStatus` | 任务状态显示 |
| `TaskPriority` | 优先级星星 |
| `TaskTime` | 任务时间显示 |
| `ExecutionTimeline` | 执行时间线 |
| `Timer` | 专注计时器 |
| `SubtaskList` | 子任务列表 |
| `AIAction` | AI 操作按钮 |
| `AIAssistantPanel` | AI 助手面板 |
| `AIInsightCard` | AI 洞察卡片 |
| `AIMessage` | AI 消息气泡 |
| `AuthProvider` | SessionProvider 包装器 |

---

## 7. 类型系统

### 7.1 Task 类型枚举

**文件**：[`src/types/task.ts`](file:///g:/Agent_Project/task-manage-sys/src/types/task.ts)

```typescript
// 任务类型
TaskType = { INBOX: "inbox", PLANNED: "planned", SCHEDULED: "scheduled" }
// 中文标签
TaskTypeLabels = { inbox: "收集箱", planned: "截止日", scheduled: "时间块" }

// 任务状态
TaskStatus = { NOT_STARTED, IN_PROGRESS, COMPLETED, DELAYED, SNOOZED, CANCELLED }

// 重要度
ImportanceLevel = { VERY_LOW:1, LOW:2, MEDIUM:3, HIGH:4, CRITICAL:5 }

// 温度（紧急程度）
Temperature = { EXPLODING, HOT, NORMAL, LONGTERM }

// 复杂度
ComplexityLevel = { LOW, MEDIUM, HIGH }

// 风险等级
RiskLevel = { LOW, MEDIUM, HIGH }

// 认知负荷
CognitiveLoad = { LOW, MEDIUM, HIGH }
```

**关键映射函数**：

| 函数 | 说明 |
|------|------|
| `importanceToTemperature(importance)` | 5→exploding, 4→hot, 2-3→normal, 1→longterm |
| `parseTags(tags)` | 逗号分隔字符串 → 数组 |
| `joinTags(tags)` | 数组 → 逗号分隔字符串 |

**TaskCategory 枚举**（8个分类，各有 border/bg 色值 + 图标）：
COURSE / LEARNING / PRACTICE / COMPETITION / HEALTH / PERSONAL / EXTERNAL / UNCATEGORIZED

### 7.2 Inbox 类型

**文件**：[`src/types/inbox.ts`](file:///g:/Agent_Project/task-manage-sys/src/types/inbox.ts)

```typescript
interface InboxResponse { draftId; understanding; items: InboxDraftItem[] }
interface InboxDraftItem { id; title; description; category; taskType; importance; deadline; startTime; endTime; estimatedMinutes; complexity; aiReason; confidence; breakdown? }
interface BreakdownDraft { shouldBreakdown; reason; phases: BreakdownPhase[] }
interface BreakdownPhase { title; phaseOrder; tasks: {title, estimatedMinutes, cognitiveLoad}[] }
interface InboxConfirmRequest { draftId; confirmed; discarded }
```

### 7.3 Plan 类型

**文件**：[`src/lib/plan/types.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/plan/types.ts)

```typescript
interface PlanItem { taskId; title; schedule; status; importance; taskType }
interface DailyPlan { date; items: PlanItem[] }
interface WeeklyPlan { weekStart; weekEnd; items: PlanItem[] }
interface DeadlineItem { taskId; title; deadline; estimatedMinutes; scheduledMinutes; remainingDays; hasSchedule; schedules; domain }
```

---

## 8. 关键类与函数说明

### 8.1 Prisma Client 单例

**文件**：[`src/lib/prisma.ts`](file:///g:/Agent_Project/task-manage-sys/src/lib/prisma.ts)

```typescript
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
```

Dev 环境下复用 globalThis 防止 HMR 重复创建连接。

### 8.2 Schedule Service — 核心函数

| 函数 | 关键行为 |
|------|----------|
| `createSchedule(userId, taskId, start, end)` | 先 `deleteMany` 再 `create`（防重复）→ 写 DecisionLog |
| `moveSchedule(userId, taskId, newStart, newEnd)` | `$transaction` 内 delete + create + verify → 写 DecisionLog |
| `addManySchedules(userId, taskId, slots, source)` | `$transaction` 批量创建 → 写 DecisionLog |
| `updateSchedule(scheduleId, userId, data)` | **禁止时间修改**，会直接 throw Error |

### 8.3 Plan Adapter — `adaptPlanData()`

**输入**：
- `planItems` — Schedule 关联的 PlanItem 数组
- `rawTasks` — 从 /api/tasks 获取的所有任务
- `weekStart` — 周起始日期

**输出**：
- `days: AdaptedDay[]` — 7 天 × 4 时段 = 28 个 AdaptedPeriod
- `ideas: AdaptedIdeas[]` — 未排期未截止的任务
- `deadlineTasks: DeadlineItem[]` — 本周截止的任务
- `interactions: PlanInteractionItem[]`

### 8.4 Inbox Parser — `analyzeInboxInput()`

**主路径**（AI可用）：
```
content → callAI(userId, INBOX_ANALYZER_PROMPT, content) → JSON.parse → 归一化 → InboxResponse
```

**降级路径**（AI不可用或解析失败）：
```
content → fallbackAnalyzeInboxInput(content)
  → splitIntoSegments() → extractCoreAction() → matchCategory()
  → extractRelativeDate() → detectTaskType() → InboxResponse(confidence=0.5)
```

### 8.5 Today API — `GET /api/views/today`

数据聚合流程：
```
1. getOrCreateTodaySummary(userId)       — 创建/更新今日统计
2. analyzeDailyBehavior(userId)         — 日常行为分析
3. runDailyAIPipeline(userId)           — Phase 3 AI 管道（每天一次）
4. 并行查询：
   - inProgress task (status="in_progress")
   - todayDecision (mustDo/recommended)
   - currentState (energy/focus/stress)
   - todayCompleted count
   - todayTimeLogs
   - todaySchedules
   - todayTimeline
5. 确定 currentTask (Priority: in_progress → 当前时段排期)
6. 检测 alerts (overtime/miss/consecutiveDelay)
7. 生成/读取 dailyBrief
8. 获取 executionAdvice + executionPattern
```

### 8.6 Decision Engine — `makeDecision()`

决策优先级链：

| 优先级 | 条件 | 动作 | confidence |
|--------|------|------|------------|
| 1 | 硬约束存在 | skip | 1.0 |
| 2 | deadline < 24h + importance ≥ 4 | do_now | 0.9 |
| 3 | energy=low + importance ≤ 3 | reduce_scope | 0.7 |
| 4 | 当前在 peakHours 内 | do_now | 0.8 |
| 5 | 当前不在 peakHours 内 | reschedule | 0.65 |
| 6 | 默认 | do_now | 0.5 |

### 8.7 UsePlan Hook

**文件**：[`src/hooks/usePlan.ts`](file:///g:/Agent_Project/task-manage-sys/src/hooks/usePlan.ts)

```typescript
const {
  days, ideas, deadlineTasks, analysis,
  loading, error, weekStart, setWeekStart,
  handleTaskMove, handleUndo, handleRedo,
  handleApplyDecision, handleDelete, refresh,
  undoStack, redoStack,
  selectedTaskId, setSelectedTaskId,
  showDecision, setShowDecision
} = usePlan()
```

数据流：
```
weekStart change → fetchData()
  → Promise.all([GET /api/plan/week, GET /api/tasks, POST /api/plan/analyze])
  → adaptPlanData() → setDays/setIdeas/setDeadlineTasks
```

---

## 9. 数据流与管线

### 9.1 任务创建流程

```
用户输入（Inbox / 手动表单）
  ↓
Inbox: POST /api/inbox/analyze → AI 解析 → TaskDraft
      用户确认 → TaskForm(预填) → POST /api/tasks
Manual: TaskForm → POST /api/tasks
  ↓
Task 创建（Prisma）
  ↓
type=scheduled → createSchedule(userId, taskId, start, end)
  ↓
Schedule 创建 + DecisionLog 写入
  ↓
Plan 页面 → getWeeklyPlan() → Schedule JOIN Task
  ↓
Today 页面 → /api/views/today → currentTask 确定
```

### 9.2 Phase 3 AI 管线

```
┌─────────────────────────────────────────────────────────┐
│              触发：用户打开 Today 页面                     │
├─────────────────────────────────────────────────────────┤
│  检查 UserModel.lastUpdated < today                      │
│    → runDailyAIPipeline(userId)                         │
│                                                         │
│  Pipeline:                                              │
│  ┌─ Level 1: runPatternMining()                         │
│  │   8 条规则 → UserPattern (零 LLM)                    │
│  ├─ runMemoryLifecycle()                                │
│  │   AgentMemory 衰减 (30d/60d/90d)                     │
│  ├─ checkMemoryResurrection()                           │
│  │   退休 Memory 有新证据 → 复活                        │
│  ├─ recomputeUserModel()                                │
│  │   Pattern → UserModel (peakHours/dailyCapacity/...)  │
│  └─ triggerAnomalyAnalysis()                            │
│      完成率下降 >40% or 跳过激增 → LLM 分析             │
└─────────────────────────────────────────────────────────┘
```

### 9.3 隐式反馈闭环

```
用户拖拽改时间 (Plan)
  → POST /api/plan/move
  → moveSchedule() → $transaction → verify
  → 写入 UserObservation(type="time_modification")
  → runPatternMining() 下次触发时学习用户偏好
```

```
用户暂停/跳过任务 (Today)
  → POST /api/tasks/[id]/action
  → 写入 UserObservation(type="pause"/"skip")
  → 写入 TaskExecutionFeedback
  → Pattern Mining 学习
```

### 9.4 Today 页面数据流

```
GET /api/views/today
  ├─ 并行：inProgress / todayDecision / currentState / completed / timeLogs / schedules / timeline
  ├─ currentTask 确定：status=in_progress > 当前时段排期
  ├─ alerts：checkOvertime + checkMissSchedule + checkConsecutiveDelay
  ├─ brief：DailyBrief 或 getMorningBrief()
  └─ advice：getExecutionAdvice() + getUserExecutionPattern()

前端 Today 页面
  ├─ FocusTaskCard：currentTask + timer
  ├─ TodayBriefCard：brief (greeting, topTasks, stateDescription, suggestion)
  ├─ TodayRoute：todayTimeline
  ├─ MustDoList：decision.mustDo
  ├─ TodayStatusAdviceCard：executionAdvice
  └─ CompletionSummaryCard：todayStats
```

---

## 10. 项目运行

### 环境要求

- Node.js 18+
- npm

### 环境变量

[`.env`](file:///g:/Agent_Project/task-manage-sys/.env) 文件：

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="your-secret-key"
```

### 安装与启动

```bash
# 安装依赖
npm install

# 生成 Prisma Client + 数据库迁移
npx prisma generate
npx prisma db push

# 启动开发服务器
npm run dev
# → 访问 http://localhost:3000

# 生产构建
npm run build
npm run start

# 代码检查
npm run lint
```

### 常用命令

```bash
# 数据库可视化
npx prisma studio

# 数据库迁移
npx prisma migrate dev --name <name>

# 重置数据库
npx prisma db push --force-reset
```

### 工具脚本

[`scripts/`](file:///g:/Agent_Project/task-manage-sys/scripts) 目录：

| 脚本 | 用途 |
|------|------|
| `query_db.js` | 数据库查询工具 |
| `cleanup-schedules.ts` | 清理冗余 Schedule 数据 |
| `phase3-audit.ts` | Phase 3 数据审计 |

### 服务器维护

```bash
# 重启（Windows PowerShell）
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
cd G:/Agent_Project/task-manage-sys && npm run dev

# Turbopack 缓存损坏
rm -r .next && npm run dev
```

---

## 11. 设计原则与核心规则

### 不可违反的核心规则

1. **Task ≠ Schedule**：任务本身不改时间，时间只由 Schedule Service 的 `$transaction` 管理
2. **LLM 不出 taskId，只出 keyword**：AI 不直接操作数据库 ID，通过 Resolver 后端解析
3. **Schedule 是唯一时间数据源**：所有时间变更必须走 Schedule Service
4. **Today 的规则引擎不可删**：`today-decide` / `pause-advisor` / `execution-advisor` 是核心

### 任务类型体系

| 类型值 | 中文显示 | 含义 | 触发条件 |
|--------|----------|------|----------|
| `inbox` | 收集箱 | 想法暂存，无时间约束 | 用户没提任何时间 |
| `planned` | 截止日 | 有截止日期，未确定具体时间 | 用户说了日期但没具体时间段 |
| `scheduled` | 时间块 | 已确定具体时间段 | 用户说了精确时间 |

### Inbox AI 解析规则

- **拆项规则**：`"明天学数学2小时，晚上健身"` → 2 个 item
- **标题 vs 备注**：title 只写核心动作（≤15字），description 放细节
- **taskType 判断**：精确时间 → scheduled，只有日期 → planned，无时间 → inbox
- **分类规则**：7 个分类 + 关键词表

### Agent Tool 权限等级

| 权限等级 | 说明 | 示例 |
|----------|------|------|
| `read` | 只读查询 | get_today_tasks, get_schedule, get_user_state |
| `write` | 直接写入 | update_task, schedule_task, save_memory |
| `confirm` | 需用户确认 | create_task, batch_reschedule, delete_task |

### Memory 状态生命周期

```
active ──30天未用(置信度×0.8)──→ active (降置信度)
active ──60天未用──→ dormant
active ──90天未用──→ retired
retired ──有新匹配 Pattern──→ active (复活, confidence=0.5)
任意 ──用户 blockMemory()──→ blocked
```

### UI 设计约定

- 页面间距统一 `space-y-6`
- 四个主页面 emoji：Inbox(🤔) / Plan(📅) / Today(⚡) / Review(📈)
- MobileNav 5 个 Tab 包含 Settings
- 生产环境 Sidebar 隐藏预览页入口

---

*本文档基于项目源码自动生成，涵盖完整架构、数据模型、模块职责、关键函数和运行方式。*
