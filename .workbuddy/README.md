# Task OS — Agent 快速上下文

> 完整产品理念见 `G:\Agent_Project\Task_Manage_Sys\Task OS 项目总控文档 V1.0.md`

## 一句话

**AI 驱动的个人时间操作系统。** 用户表达想法 → AI 理解/规划/筛选/复盘 → 用户管理方向，AI 管理过程。

## 不可破坏的架构规则

1. **Task ≠ Schedule** — 任务描述"做什么"，Schedule 描述"什么时候做"。Plan/Today 只读 Schedule 表。
2. **LLM 不出 taskId** — LLM 只输出 keyword（任务关键词），由 `src/lib/task/resolver.ts` 解析。
3. **Schedule 是唯一时间数据源** — 修改时间必须通过 `src/lib/schedule/service.ts` 的 `$transaction`（deleteMany + create）。
4. **用户最终控制权** — AI 可建议/分析/提醒，不能擅自修改用户目标。

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · Prisma + SQLite · NextAuth v5 · Tailwind CSS 4

## 关键文件路径

| 用途 | 路径 |
|---|---|
| 数据库 Schema | `prisma/schema.prisma` |
| Prisma 客户端 | `src/lib/prisma.ts` |
| 认证 | `src/lib/auth.ts` |
| Schedule 事务服务 | `src/lib/schedule/service.ts` |
| 任务解析器（keyword→taskId） | `src/lib/task/resolver.ts` |
| AI LLM 客户端 | `src/lib/ai/client.ts` |
| AI 工具执行 | `src/lib/ai/executor.ts` |
| Today 规则决策引擎 | `src/lib/ai/today-decide.ts` |
| Today 暂停建议 | `src/lib/ai/pause-advisor.ts` |
| 执行建议 | `src/lib/ai/decision/execution-advisor.ts` |
| 记忆学习 | `src/lib/ai/memory-learning.ts` |
| 用户状态 | `src/lib/ai/user-state.ts` |
| Inbox AI 解析 | `src/lib/ai/parser.ts` |
| AI 规划器 | `src/lib/ai/planner.ts` |
| Plan 服务 | `src/lib/plan/service.ts` |
| Plan 冲突检测 | `src/lib/plan/conflict.ts` |
| 任务执行引擎 | `src/lib/task/execution.ts` |
| 任务类型定义 | `src/types/task.ts` |
| 收件箱类型定义 | `src/types/inbox.ts` |

## 当前开发阶段

**正在进行：第一阶段 — 零 AI 可完整使用**

目标：用户不配任何 API，能跑通 Inbox→Plan→Today→Review 全闭环。

已完成：
- Stage 0 (Step0-9): UI 统一设计系统
- Stage 1 (Step10-19): Today 模块 ~95% 完成（执行驾驶舱）
- Stage 2 (Step20-25): Plan 模块 ~55% 完成（日历拖拽可用）
- Stage 4 (Step40-47): Inbox 设计完成，代码 ~40%

待做（第一阶段）：
1. Inbox：手动创建任务入口（AI 为可选增强）
2. Plan：点击空白格创建任务
3. Inbox → Plan：AI 解析 + 手动创建走同一套 TaskForm 确认流程
4. Review：从纯统计升级为行为洞察

后续阶段：
- 第二阶段：AI 可选增强（规则回退 + Memory 接入链路）
- 第三阶段：AI 深度闭环（Step50-69）

## 禁止事项

- ❌ 直接操作 `prisma.schedule`（必须通过 Schedule Service）
- ❌ 修改 `task.startTime` 做时间展示
- ❌ 让 LLM 输出 taskId
- ❌ 删除 Today 的规则引擎逻辑（它们是零 AI 依赖的核心）
- ❌ 修改 `src/lib/schedule/service.ts` 的事务逻辑
- ❌ 未经分析修改核心架构

## 运行

```bash
cd G:\Agent_Project\task-manage-sys
npm run dev    # http://localhost:3000
npm run build  # 每次修改后验证编译
```
