<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Meridian（Task OS）开发纪律

> 产品：Meridian · 子午（个人成长系统）。阅读本文前先读 `README.md`（项目导航）与总控文档。

## 必读文档顺序（开发/改代码前）

1. `Task OS 项目总控文档 V2.0.md` — 产品宪法（定位/理念/红线/决策）
2. `docs/任务信息架构规范-V3.md` — 开发 SSOT（信息架构五层/四维分类/后端契约/前端契约）
3. `docs/API接口清单.md` — API 契约
4. 本文 — 开发纪律

**SSOT 纪律**：本文档 > 总控文档 > API 清单 > 代码。冲突时改代码，不改文档。

## 核心规则（红线，违反即返工）

- **Task ≠ Schedule**：改时间必须通过 Schedule 相关服务/API，Task 表不存时间（startTime/endTime 为死字段已删）
- **Schedule 是唯一时间数据源**
- **LLM 不出 taskId**：AI 只出 keyword，taskId 由服务层解析
- **用户最终控制权**：AI 只建议不强制；排期用户拖拽、分类用户确认
- **Today 规则引擎零 AI 依赖**：today-decide/pause-advisor/execution-advisor 不可删除
- **领域 7 类封顶**：course/learning/practice/health/life/external/other，不再增加；新目标走主题（theme）不走领域
- **主题推断保守**：AI 拿不准留空，不强猜（resolveTheme）
- **卡片三层规则**：身份→时间→状态，其余进详情；禁止卡片自创样式
- **暖色纪律**：暖色只留给主题标记；领域色低频低调
- **提醒克制**：只提醒"承诺兑现"（打卡/截止），可一键关
- **导出带版本号**：schemaVersion（export-version.ts）

## 工程纪律

- 改 schema → `prisma db push` + generate；删字段走迁移脚本（参考 scripts/v3-theme-migration.ts）
- 每阶段 `tsc --noEmit` + `npm test`（95 用例）+ `next build`
- 改 UI 先对照 `UI示例/` 定稿稿（FocusCard/Today/Project/登录页）
- 生产部署配置：`DATABASE_URL`(PG) + `AUTH_SECRET` + `AUTH_TRUST_HOST`；next.config 的 `distDir` 部署时需注释
- 过程文档（实施报告等）写完后可归档到 `docs/archive/`，不堆积在 docs/ 顶层

## 目录速查

- 五页面：`src/app/(dashboard)/{inbox,plan,today,review,projects}/page.tsx`
- Focus Card：`src/components/today/FocusCardV2.tsx`（+ 全局档案面板 `src/components/task/`）
- 领域/主题配色：`src/lib/plan/colors.ts`
- 统计：`src/app/api/views/stats/route.ts`（themeBreakdown/metrics）
- 项目树：`src/app/api/projects/tree/route.ts`（themeColor/doneCount/suggestion）
- AI 解析：`src/lib/ai/parser.ts`；规则引擎：`src/lib/ai/today-decide.ts` 等
