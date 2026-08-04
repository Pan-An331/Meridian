# Meridian（Task OS）— Agent 快速上下文

> 项目完整导航见根目录 `README.md`（含目录结构/开发必读/交接说明）。

## 一句话

**个人成长系统**（非泛用 GTD）：收纳 → 规划 → 执行 → 复盘 的成长闭环，AI 理解/建议/复盘，用户始终拥有最终控制权。核心理念：**帮用户过滤未来，不是堆积未来**。

品牌：Meridian · 子午（slogan「你的时间，自有中轴」）。

## 不可破坏的架构规则

1. **Task ≠ Schedule** — 任务描述"做什么"，Schedule 描述"什么时候做"。改时间必须走 Schedule 相关服务/API（$transaction）。
2. **LLM 不出 taskId** — LLM 只输出 keyword，由服务层解析。
3. **Schedule 是唯一时间数据源**（Task 表时间字段已删）。
4. **用户最终控制权** — AI 只建议不强制；排期用户拖拽、分类用户确认。
5. **Today 规则引擎零 AI 依赖** — today-decide/pause-advisor/execution-advisor 不可删。
6. **领域 7 类封顶** — 新目标走 theme（Task.theme），不走领域。
7. **卡片三层规则** — 身份→时间→状态，其余进详情。
8. **导出带 schemaVersion**（export-version.ts）。

## 技术栈

Next.js 16 (App Router) · React 19 · TypeScript · **Prisma + PostgreSQL**（本地便携 PG，端口 5432，库 meridian）· NextAuth v5 · Tailwind CSS 4 · vitest

## 关键文件路径

| 用途 | 路径 |
|---|---|
| 数据库 Schema | `prisma/schema.prisma`（provider=postgresql） |
| 领域/主题配色 | `src/lib/plan/colors.ts`（DOMAINS 7 类 + THEMES + resolveTheme） |
| Inbox AI 解析 | `src/lib/ai/parser.ts`（保守推断，不强猜） |
| Inbox 确认服务 | `src/lib/inbox/confirm-service.ts`（白名单 + 反馈回流） |
| Today 规则引擎 | `src/lib/ai/today-decide.ts` / `pause-advisor.ts` |
| Focus Card V2 | `src/components/today/FocusCardV2.tsx`（purpose/departureAt/惰性结算） |
| 档案面板/全局搜索 | `src/components/task/` + `src/components/search/GlobalSearch.tsx` |
| 项目树 API | `src/app/api/projects/tree/route.ts`（themeColor/doneCount/suggestion） |
| 统计 | `src/app/api/views/stats/route.ts`（themeBreakdown + metrics + prev 周环比） |
| 版本导出 | `src/lib/export-version.ts` |
| 迁移脚本 | `scripts/migrate-sqlite-to-pg.mjs`（已完成，参考） |

## 当前状态（2026-08-04）

**产品完全体 ✅**：V3 信息架构 / Focus Card V2 / 五页面布局重排 / 品牌 Meridian / Project 页优化 / 收尾批次 / 全站移动端适配——全部完成并验收，测试 95/95。

**待办**：
- 部署三步（用户账号操作）：GitHub 推送 → Neon 建库 → Vercel 部署（见 `docs/Meridian-云端部署-用户操作指南-2026-08-04.md`）
- Next 路线图（见 `docs/项目开发地图.html`）：续排 UX 已做；打卡提醒 / 语音输入 / AI 周报 等按真实使用数据再排

**文档分层**：总控文档（宪法）→ `docs/任务信息架构规范-V3.md`（开发 SSOT）→ `docs/API接口清单.md`（契约）→ 代码。SSOT 冲突改代码不改文档。

## 运行

```bash
npm run dev     # http://localhost:3000
npm test        # vitest 95 用例
npx tsc --noEmit
npm run build
```

环境变量（.env）：`DATABASE_URL`（postgresql://postgres:postgres@localhost:5432/meridian）、`AUTH_SECRET`、`AUTH_TRUST_HOST`。

## 注意

- ⚠️ Next.js 16 有破坏性变更，写代码前读 `node_modules/next/dist/docs/`（见 AGENTS.md）
- 项目可整体移动（无绝对路径依赖）；新工作台接手先读根目录 README.md
- 历史过程文档已归档 `docs/archive/`、`UI示例/archive/`、`scripts/archive/`（git 历史可恢复）
