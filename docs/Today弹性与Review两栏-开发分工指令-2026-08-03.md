# Today 弹性方案 + Review 两栏化 · 开发分工指令

> 版本：2026-08-03 · 产品审核通过稿
> 用途：分别转交前端工程师 / 后端工程师并行开工

---

## 0. 必读文档（按顺序）

1. `docs/五页面布局重排方案-2026-08-03.md`（§1-§6 已确认项 + §7.1 Today 弹性定稿 + §7.2 Review 两栏定稿）
2. `UI示例/Today-弹性方案-类型全览-2026-08-03.html`（**Today 视觉基准**：5 个场景全渲染 + 判定规则）
3. `UI示例/FocusCard-V2-UI副本.html`（Focus Card 质感基准：memo 黄清单、字号、弹窗）

---

## 1. 前端工程师任务

### 阶段 A：Today 弹性布局（主任务）

**目标**：把 Today 页面从"宽页面 1160/1280px 全宽"改为「方案 B 弹性让位」——内容多就长大（880px）、内容少就缩小（760px）。

| # | 改动 | 说明 |
|---|------|------|
| A1 | 宽度容器 | 内容区改弹性容器：简单态 `max-w-[760px] mx-auto`、复杂态 `max-w-[880px] mx-auto`；`transition: max-width 200ms` 顺滑过渡 |
| A2 | 简单/复杂判定 | 渲染后测量「问候语 + 主卡」实际高度：≤ 一屏可用高度（约 560–600px）→ 简单态；超出 → 复杂态。建议 `useRef` + `ResizeObserver` 实现，**不写死清单条数阈值** |
| A3 | 简单态呈现 | 三块一屏全见：主卡 + 今日路线\|AI 助手（双栏）+ 今日状态折叠条 |
| A4 | 复杂态呈现 | 首屏只放问候语 + 主卡；路线\|AI **完整保留、整体沉底**（滚动即见，信息不丢）；状态条继续折叠 |
| A5 | 字号提升 | 任务标题 17→**20px bold**；所属项目 13→**14px semibold**；动机行 11.5→**12.5px**（可带主题 tag：考研/身材/竞赛）；元信息保持 10px 小字 |
| A6 | AI 输入框上移 | AiPanel：输入框从底部移到**紫色标题栏正下方**（结构：标题栏 → 输入框+发送 → AI 提示语 → 建议列表 → 回复气泡） |
| A7 | 5 种卡片适配 | 固定时间（无清单）、积累·每日（无清单）、积累·频次（≤3 动作）、清单型·仅 1 项、清单型·10 项——全部对照视觉基准渲染正确 |
| A8 | 移动端回退 | `<900px`：`row2` 单栏、`fc-body` 纵向折叠（fc-left 去右边框改下边框） |

**注意**：
- **不动** FocusCardV2 内部状态机 / 数据契约 / 弹窗逻辑 / memo 黄清单 / 主题角标——只动外层容器、宽度、字号、输入框位置
- 判定逻辑是"前端渲染层"的事，不引入新依赖（ResizeObserver 原生即可）

### 阶段 B：Review 两栏化

**目标**：把 Review 从"6 区块单栏纵排"改为「上锚点 + 左证据右仪表」。

| # | 改动 | 说明 |
|---|------|------|
| B1 | 战报全宽 | ReportCard 保持顶部全宽（故事锚点，不拆栏） |
| B2 | 下方双栏 | `<div class="grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-4 items-start">`：左 65% / 右 35% |
| B3 | 左列（主叙事） | 产出日记 DayDiary + 下周建议 NextSuggestions |
| B4 | 右列（仪表区） | 指标卡 MetricCards（4 格改 `grid-cols-1 sm:grid-cols-2` 2×2）+ 主题投入 ThemeInvestment + 本周洞察 WeekInsight；`lg:sticky lg:top-4` 跟随 |
| B5 | 主题投入趋势 | 消费 `themeBreakdown[].prev`（后端未就绪先显示"—"，前端兼容 null）：上升绿 ↑ / 下降红 ↓ / 持平灰 — |
| B6 | 移动端回退 | `<860px` 回退单栏，顺序不变：战报 → 指标 → 主题 → 日记 → 洞察 → 建议 |

**注意**：各区块组件逻辑零改动，只动容器和位置。

### 阶段 C：验证

- `tsc --noEmit` 零错误
- `vitest` 现有 73 用例不回归（预期不动测试）
- `next build` 通过
- 浏览器实测：Today 简单卡（760px 三块一屏）/ 复杂卡（880px 主卡优先路线沉底）/ 字号 / AI 输入框上移；Review 双栏 + 右栏 sticky + <860px 回退

### 验收标准（对照勾选）

- [ ] Today 简单态 760px 三块一屏全见（固定时间/积累每日/积累频次 3 动作/清单 1 项）
- [ ] Today 复杂态 880px 首屏主卡占满、路线/AI 沉底不丢
- [ ] 简单↔复杂过渡顺滑（200ms 宽度动画）
- [ ] 标题 20px / 项目 14px / 动机 12.5px 生效
- [ ] AI 输入框在 AI 面板标题栏下方
- [ ] Review 战报全宽 + 左日记右仪表双栏 + 指标卡 2×2 + 右栏 sticky
- [ ] <860/900px 移动端回退正确
- [ ] tsc / vitest / build 全过

---

## 2. 后端工程师任务

**目标**：Review「主题投入」的周环比趋势数据——`themeBreakdown` 每项加 `prev`（上周同主题数据）。**唯一后端改动，其余零变更**。

### 改动点：`src/app/api/views/stats/route.ts`

| # | 改动 | 说明 |
|---|------|------|
| 1 | prev 周期聚合 | 对上周周期（`periodStart - days` ~ `periodStart`）做同样的 theme 聚合（按任务数 count，与本周口径一致） |
| 2 | 返回结构 | `themeBreakdown[].prev`: `{ count: number, percent: number } \| null`（该主题上周无数据时为 null）——**向后兼容，前端缺省显示"—"** |
| 3 | 不破坏现有 | 现有 `themeBreakdown` 字段（theme/count/percent/label）不动；`weekOverWeek` 不动 |

**注意**：
- 只加字段，不改现有字段语义，不动其他接口
- 补充 1 个单测：themeBreakdown prev 正确性（有上周数据 / 无上周数据 → null）

### 验证

- `tsc --noEmit` 零错误
- `vitest` 通过（新增 1 用例 + 现有不回归）
- API 冒烟：`GET /api/views/stats` 返回 themeBreakdown[].prev

---

## 3. 协作顺序

```
前端（阶段 A Today 弹性 → 阶段 B Review 两栏 → 阶段 C 验证）
   ↕ 可并行
后端（themeBreakdown prev 小改 + 单测）
   ↓ 后端就绪后
前端 B5 主题趋势从"—"切换真实数据（一行消费，无需返工）
```

前端阶段 A/B 不依赖后端（Review 主题趋势留"—"占位）；后端不依赖前端。**两边可同时开工**。

---

## 4. 转交话术（复制发送）

**给前端：**

> 做 Today 弹性布局 + Review 两栏化。必读：`docs/五页面布局重排方案-2026-08-03.md` §7（定稿）+ `docs/Today弹性与Review两栏-开发分工指令-2026-08-03.md` §1。视觉基准：`UI示例/Today-弹性方案-类型全览-2026-08-03.html`（5 场景照着渲）+ `UI示例/FocusCard-V2-UI副本.html`（质感）。
> 要求：① Today 简单态 760px 三块一屏 / 复杂态 880px 主卡优先路线沉底，按「渲染后实际高度」判定不写死阈值，200ms 宽度过渡 ② 字号：标题 20px、项目 14px、动机 12.5px ③ AI 输入框移到标题栏下方 ④ Review 战报全宽 + 左日记右仪表（指标卡 2×2 + 右栏 sticky）⑤ <900px 移动端回退。**只动布局/宽度/字号/输入框位置，不动组件状态机与数据逻辑**。改完 tsc + vitest + build 验证，写实施简报。

**给后端：**

> 做 Review 主题趋势的周环比数据。必读：`docs/Today弹性与Review两栏-开发分工指令-2026-08-03.md` §2。改动：`src/app/api/views/stats/route.ts` 的 themeBreakdown 每项加 `prev: {count, percent} | null`（上周同主题聚合，口径与本周一致按任务数），向后兼容、缺省 null。加 1 个单测。改完 tsc + vitest + API 冒烟，写实施报告。

---

*完成后交产品验收（抽查代码 + 跑测试 + 浏览器实测）。*
