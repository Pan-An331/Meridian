# Today 弹性布局 + Review 两栏化 · 实施简报

> 日期：2026-08-03 18:05 | 角色：FrontendDeveloper
> 依据：《五页面布局重排方案》§7.1/§7.2（定稿）+《Today弹性与Review两栏-开发分工指令》§1
> 视觉基准：`UI示例/Today-弹性方案-类型全览-2026-08-03.html`（5 场景）+ `UI示例/FocusCard-V2-UI副本.html`（质感）
> 范围：只动布局/宽度/字号/输入框位置 —— 组件状态机、数据契约、弹窗逻辑、数据/接口逻辑零改动

---

## 一、Today 弹性布局（指令阶段 A）

### A1-A4 · 弹性容器 + 高度判定 + 双态呈现

| 改动 | 实现 |
|------|------|
| 弹性容器 | `src/app/(dashboard)/today/page.tsx`：`today-flex` 容器（globals.css 定义，`mx-auto + transition: max-width .2s ease`），简单态 `max-w-[760px]`、复杂态 `max-w-[880px]` |
| 简单/复杂判定 | `useRef<HTMLDivElement>` + 原生 `ResizeObserver` 测量「问候语 + 主卡」实际高度；**滞回带宽 60px**：`>600px → 复杂态`，`≤540px → 简单态`（防 max-w 切换引起高度回振振荡）；**不写死清单条数阈值**，0 条时间型 / 3 动作健身 / 10 项原理图自动归位 |
| 简单态 | 760px 居中，三块一屏：问候语 + 主卡 + 路线\|AI + 状态折叠条 |
| 复杂态 | 880px 居中，首屏只放问候语 + 主卡；路线\|AI 完整保留、整体沉底（滚动即见，信息不丢）；状态条继续折叠 |

### A5 · 字号提升（FocusCardV2.tsx）

| 元素 | 改动 |
|------|------|
| 任务标题 | `text-[17px]` → **`text-[20px] font-bold`**（B 区 h3，视觉锚点） |
| 所属项目 | `text-[13px]` → **`text-[14px] font-semibold`**（左栏） |
| 动机行 | `text-[11.5px]` → **`text-[12.5px]`**（A 区紫底行） |
| 元信息 | 10px 小字保持（角标语义） |

### A6 · AI 输入框上移（today/page.tsx AiPanel）
- 从面板底部（`border-t` 分隔）移到**紫色标题栏正下方**
- 新结构：`标题栏 → 输入框+发送（border-b 分隔）→ AI 提示语 → 建议列表 → 回复气泡`
- 先输入/提问，再浏览建议

### A8 · 移动端回退（globals.css）
- `today-row2`：900px 断点双栏（替换原 `md:grid-cols-2` 768px 断点）
- `.fcv2-left` 单栏（<860px）补 `border-bottom`（去右边框改下边框），≥860px 恢复右分隔

## 二、Review 两栏化（指令阶段 B）

### B1-B4 · 上锚点 + 左证据右仪表

```
[ 战报 ReportCard（顶部全宽 · 故事锚点）                      ]
[ 产出日记 DayDiary（左 13fr · 主叙事 1） | 指标卡 2×2 → 主题投入（右 7fr · 仪表区 sticky） ]
[ 下周建议 NextSuggestions（左 13fr）   | 本周洞察 WeekInsight（右 7fr） ]
```

- 容器：`grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-4 items-start`
- 右仪表容器：`MetricCards + ThemeInvestment`，`lg:sticky lg:top-4` 跟随；MetricCards 4 格改 `grid-cols-1 sm:grid-cols-2` 2×2
- WeekInsight 放右列第二行（短卡不 sticky）；NextSuggestions 承接日记叙事放左列第二行
- 区块组件逻辑零改动，仅容器位置与 margin 清理（MetricCards/ThemeInvestment/WeekInsight/NextSuggestions 的 `mb-4` 移除，grid gap 接管）

### B6 · 移动端回退（<860px）
- grid 单列 + CSS order：右仪表容器 order-1 → 日记 order-2 → 洞察 order-3 → 建议 order-4
- 回退顺序与定稿一致：**战报 → 指标 → 主题 → 日记 → 洞察 → 建议**
- lg 下 order 归零，col/row 定位恢复双栏

## 三、验证

| 项 | 结果 |
|----|------|
| `tsc --noEmit` | ✅ 零错误 |
| `vitest` | ✅ 73/73（零回归，未动测试） |
| `next build` | ✅ Compiled + 47/47 静态页生成 |
| dev 冒烟 | ✅ /today 200、/review 200 |

## 四、遗留 / 后续

- 后端小改（分工指令 §2）：`themeBreakdown[].prev`（上周对比）——就绪后前端主题趋势从"—"切真实数据（一行消费，无需返工）
- 浏览器实测建议：Today 简单卡（固定时间/背单词/健身 3 动作/清单 1 项）760px 三块一屏；复杂卡（清单 10 项）880px 主卡优先路线沉底；字号/AI 输入框位置；Review 双栏 + 右栏 sticky + 窄屏回退
- FocusCardV2 组件文件内 5 类型渲染结构未动（仅 3 处字号）；弹性判定是页面渲染层逻辑，未引入新依赖（原生 ResizeObserver）

---

## 追加：弹性档位上调（2026-08-03 18:12 · 用户验收反馈）

**反馈**：实际产品宽度比预览稿明显窄。

**根因分析（两个）**：
1. **视口观感差**：预览稿在 1080px 视口渲染，880px 占 81% 屏宽；实际内容区 1160px + 全屏浏览器下，760px 只占约 65% —— 同样的像素值观感差很远；且 760px 本就低于用户原始需求「880–960px 居中」下限（UI 稿选值偏保守）。
2. **判定阈值偏紧**：原阈值 600px（滞回 540）把清单 5–6 项的中等任务（实测高度 ~550–600px）留在简单态 760px，不会升档。

**修复**（today/page.tsx）：
- 弹性档位：简单态 760 → **880px**、复杂态 880 → **960px**（贴合需求区间上限）
- 判定阈值：600 → **560**（滞回 540 → **520**，带宽 40px），中等任务也能进复杂态
- 200ms 宽度过渡不变；高度判定逻辑不变（只调数值）

**验证**：tsc ✅ / next build ✅

---

## 追加：Review 全量同步视觉稿 v3.1（2026-08-03 20:15 · 用户验收反馈"严重 bug + 审美问题"）

**问题根因**：上一轮只落地了两栏化布局，视觉稿 v2/v3/v3.1 定稿的**战报加厚、发现条加宽、关键词加大、本周成果字号放大、删本周基础**全部未同步，页面 = 新布局 + 旧样式，与视觉稿差异大。

**本次全量同步（review/page.tsx，数据逻辑零改动，仅样式）**：

| 区块 | 改动 |
|------|------|
| 战报双卡 | 从"两行小字"（13px 小字 + 10px 副标题）改为竖排加厚：大色点 34px（白描边+紫光晕）+ 分类名 15px + **26px 大数字**（主色=占比% / 之最=分钟数）+ 辅助行；min-h 112px 不扁 |
| 战报之最 | 任务名 16px + 大数字「150 分钟」+ "全周最长 · 周X"（真实数据：completedAt 星期） |
| 关键词 | chip 11px/px-10 → **12px/px-14 py-4.5** |
| 发现条 | 12px/px-3 → **13px/px-4 py-3.5** + 左侧 4px 紫竖条 + ✨ 26px 白底圆角方标 |
| 本周基础 | **删除**（战果信息已融入双卡大数字：占比% + 分钟数；完成任务数在摘要文案里） |
| 整卡 | padding 22 → 24px、区块间距 14 → 16px |
| 本周成果 | 任务名 13.5 → **15px** / 星期 13 → **14.5px** / 时间时长 12.5 → **13.5px** / badge 11 → **12px** / 标题 14 → 15.5px / 图例 11.5 → 12px |
| 清理 | ReportCard 删未用 totalMinutes / trendUp / 本周基础 JSX |

**验证**：tsc ✅ / vitest 73/73 ✅（零回归）/ next build ✅ / dev 冒烟 /review 200（未登录跳 /login 正常）

---

## 追加：Review 全宽化（2026-08-03 20:23 · 用户验收反馈"视觉稿全宽而你居中"）

**根因**：ContentContainer 按 `isWidePath` 决定宽度，`WIDE_PATHS` 原为 `["/today","/plan","/week","/projects"]`，**Review 不在其中 → 720px 窄容器**。两栏化后 13fr/7fr 在 720px 里被挤成 468/252px（右栏指标卡 2×2 每个仅 ~120px），挤压变形 = 视觉稿（1100px 全宽）与实现的严重偏差。

**修复**（src/lib/navigation.ts）：
- `WIDE_PATHS` 加入 `"/review"` → Review 走侧栏 1160px / 顶栏 1280px 全宽容器，与视觉稿 v3.1（1100px）一致
- 同步更新 tests/navigation.test.ts：Review 从"窄页面"断言移到"宽页面"断言（旧断言过期）

**验证**：tsc ✅ / vitest 79/79 ✅ / next build ✅ / dev 冒烟 /review 200

---

## 追加：Review 布局修订 v4（2026-08-03 20:29 · 用户验收反馈"洞察位置 + sticky 不动"）

**反馈**：① 本周洞察应和本周成果一块（两栏显示），下周建议（AI）不该占主叙事位置；② 右栏指标卡 4 格 + 主题投入滚动时"定住不动"（sticky）有问题。

**修复**（review/page.tsx + 视觉稿 v4 同步）：

```
[ 战报（全宽）                                    ]
[ 本周成果（左 13fr）→ 本周洞察     | 指标卡 2×2 → 主题投入（右 7fr，不 sticky）]
[ 下周建议（AI · 沉底全宽独立）                     ]
```

- **本周洞察移入左列**：紧跟本周成果（证据 → 结论 承接叙事）
- **下周建议沉底全宽**：独立成区，不占用主叙事位置
- **右栏去 sticky**：`lg:sticky lg:top-4` 移除 → 滚动正常跟随
- 移动端回退顺序不变：战报 → 指标 → 主题 → 成果 → 洞察 → 建议（order 1/2/3 + 建议全宽自然收尾）
- 视觉稿 v4 同步（洞察左列 / 建议底部 / sticky 标注去除 + 设计要点更新）

**验证**：tsc ✅ / vitest 79/79 ✅ / next build ✅ / dev 冒烟 /review 200
