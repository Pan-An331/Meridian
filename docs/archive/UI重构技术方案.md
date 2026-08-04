# Task OS UI 重构技术方案

> 基于 `design-preview.html` 对标当前产品全 UI，按设计稿逐页面重构
> 生成时间：2026-07-31

---

## 一、方案总览

### 1.1 重构范围

设计稿定义了 **8 个屏幕**：Login / Dashboard(Today) / Inbox / Review / Modal / Plan / Settings / Mobile。本次重构覆盖全部。

### 1.2 重构原则

1. **设计令牌驱动**：所有颜色/间距/圆角/阴影使用 CSS 变量，不硬编码
2. **组件原子化**：拆分大型组件（FocusTaskCard 115行、WeekCalendar 325行）
3. **动画标准化**：统一动效（入场、hover、呼吸、折叠），全部基于 CSS @keyframes
4. **图标统一**：用 SVG 图标替代所有表情符号
5. **Token 兼容**：不破坏现有 4 轴主题系统（brand/AI/page/semantic），在此基础上扩展

### 1.3 分阶段策略

| 阶段 | 范围 | 工作量 |
|------|------|--------|
| **Phase A**: 基础设施 | Token 扩展 + 图标库 + 动画工具类 + 通用组件升级 | 基础 |
| **Phase B**: Today 页面 | FocusTaskCard V3 + CompletionCard + 暂停原因面板 + 状态栏 | 中 |
| **Phase C**: Plan 页面 | ProgressSnapshot + AI Decision Panel 重排 + 日历网格优化 | 中 |
| **Phase D**: 其余页面 | Login / Inbox / Review / Settings / Mobile 逐页对标 | 中 |
| **Phase E**: 收尾 | 暗色模式适配 + 移动端适配 + npm run build 验证 | 小 |

---

## 二、Phase A：基础设施改造

### 2.1 Design Token 扩展 (`src/app/globals.css`)

当前 globals.css 已有 V2 令牌系统（brand/AI/page/semantic），需补充设计稿中的新变量：

```css
/* 新增：品牌渐变色 */
--grad-brand: linear-gradient(135deg, var(--brand-500), #8b5cf6);
--grad-brand-light: linear-gradient(135deg, var(--brand-50), #e0e7ff);
--grad-header: linear-gradient(135deg, #1e1b4b, #312e81, var(--brand-700));
--grad-login-bg: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
--grad-progress: linear-gradient(90deg, var(--brand-500), #8b5cf6);
--grad-chart: linear-gradient(180deg, #818cf8, var(--brand-500));

/* 新增：AI Card 面板色 */
--ai-card-bg: linear-gradient(135deg, var(--ai-50), #faf5ff);
--ai-card-border: var(--ai-200);
--ai-accent: var(--ai-500);
--ai-accent-bg: var(--ai-50);
--ai-advice-item-border: var(--ai-200);
--ai-advice-item-hover-bg: #fafafe;
--ai-text-color: var(--ai-600);
--ai-collapse-hover: rgba(99,102,241,0.05);

/* 新增：Plan 页面专用 */
--plan-today-bg: var(--brand-50);
--plan-task-scheduled: #dbeafe;
--plan-task-scheduled-text: #1e40af;
--plan-task-deadline: #fef3c7;
--plan-task-deadline-text: #92400e;

/* 新增：Complete Card */
--complete-bg: #dcfce7;
--complete-border: #bbf7d0;
--complete-text: #166534;
--complete-btn: #16a34a;
--complete-btn-hover: #15803d;

/* 新增：语义色 — 来源/优先级/密度 */
--sem-source-user: #3b82f6;
--sem-source-user-bg: #eff6ff;
--sem-source-ai: #7c3aed;
--sem-source-ai-bg: #f5f3ff;
--sem-priority-p4: #f97316;
--sem-priority-p5: #ef4444;
--sem-density-low: #22c55e;
--sem-density-medium: #3b82f6;
--sem-density-high: #f59e0b;
--sem-density-overload: #ef4444;

/* 新增：统计色 */
--stat-tasks: var(--brand-500);
--stat-time: #10b981;
--stat-streak: #f59e0b;
```

### 2.2 图标库扩展 (`src/components/ui/icons.tsx`)

当前只有 6 个图标。设计稿使用了 20+ 个 SVG 图标，需扩展：

**新增图标清单**：
```
ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
ArrowRight, ArrowLeft,
Plus, Check, X, Close,
Search, Filter,
Calendar, Clock, User,
LogOut, MoreHorizontal, MoreVertical,
Trash, Edit, Info, Alert, Send, Upload, Download,
GripVertical (drag handle),
Mail, Lock (for login)
```

实现方式：统一的 SVG 组件（viewBox="0 0 24 24"、stroke="currentColor"、strokeWidth={2}、Feather 风格），与现有图标保持一致。

### 2.3 动画系统 (`src/app/globals.css`)

新增 keyframes（从设计稿提取）：

```css
/* 呼吸边框 — 当前执行任务 */
@keyframes breathe-blue {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.35); }
  50% { box-shadow: 0 0 0 8px rgba(59,130,246,0); }
}
@keyframes breathe-green {
  0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.35); }
  50% { box-shadow: 0 0 0 8px rgba(22,163,74,0); }
}
@keyframes breathe-indigo {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.35); }
  50% { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
}

/* 折叠展开 */
@keyframes collapse-open {
  from { max-height: 0; opacity: 0; }
  to { max-height: 600px; opacity: 1; }
}
@keyframes collapse-close {
  from { max-height: 600px; opacity: 1; }
  to { max-height: 0; opacity: 0; }
}
```

提供 Tailwind 工具类：
```css
.animate-breathe-blue  { animation: breathe-blue 3s ease-in-out infinite; }
.animate-breathe-green { animation: breathe-green 3s ease-in-out infinite; }
.animate-breathe-indigo { animation: breathe-indigo 3s ease-in-out infinite; }
.animate-collapse-in  { animation: collapse-open 0.35s ease forwards; }
.animate-collapse-out { animation: collapse-close 0.35s ease forwards; }
```

### 2.4 通用组件升级

#### Card 组件改进
- **当前**：硬编码 `bg-white`
- **目标**：使用 `bg-[var(--color-surface)]` 主题感知
- **新变体**：增加 `focus`（大卡 V3）、`route`（时间线行）

#### PageHero 改进
- **当前**：图标区域不够突出
- **目标**：图标区域使用 `var(--grad-brand-light)` 渐变背景 + 圆角 `var(--radius-xl)`
- 新增 `subtitle` 属性

#### Button 组件改进
- 新增 `outline` 变体
- `iconOnly` + `aria-label` 支持
- 尺寸：`sm` (8px/16px)、`md` (10px/20px)、`lg` (12px/24px)

#### Modal 组件改进
- **当前**：无动画
- **目标**：入场动画 `animate-modal-enter`（已定义但未使用）

---

## 三、Phase B：Today 页面重构

### 3.1 改造文件清单

| 文件 | 改造内容 |
|------|----------|
| `components/today/FocusTaskCard.tsx` | V3 设计：状态徽章右上角 + 暂停/完成在底部 + 暂停原因面板 |
| `components/today/FocusTaskCard.tsx` | **拆分** → 拆出 `PauseReasonPanel.tsx`、`CompletionSummary.tsx` |
| `components/today/CompletionSummaryCard.tsx` | 对标设计稿 ".completion-card" 样式 |
| `components/today/TodayBriefCard.tsx` | 对标设计稿内联状态栏 ".stat-grid" |
| `components/today/TodayRoute.tsx` | 增加时间颜色编码（current=蓝色呼吸、ahead=绿色呼吸） |
| `app/(dashboard)/today/page.tsx` | 调整布局 + 移除重复逻辑 |

### 3.2 FocusTaskCard V3 设计

```
┌─────────────────────────────────────────┐
│ [执行中 badge 右上角]                     │
│                                          │
│ 当前任务                                  │
│ 完成项目方案初稿                            │
│ 9:00 - 11:00 · 预计 2 小时               │
│ ████████████░░░░░░░░ 45%                │
│ 已投入 54 分钟            预计剩余 66 分钟  │
│                                          │
│ ┌─ 🤖 AI 执行建议 (可折叠) ────────────┐  │
│ │ 💡 先梳理大纲框架，再填充细节    [采纳] │  │
│ │ ⚠️ 专注较久，短暂休息后继续   [知道了] │  │
│ │ ✓ 当前节奏正常，参考上次      [知道了] │  │
│ └──────────────────────────────────────┘  │
│                                          │
│ ───────────────────────────────────────  │
│ [⏸ 暂停]                    [✓ 完成]    │
│                                          │
│ (暂停原因面板 — 条件渲染)                   │
│  • 状态下滑 — 注意力下降，效率较低          │
│  • 遇到困难 — 不知道下一步如何继续          │
│  • 被打断 — 被消息/电话中断               │
│  • 临时任务 — 新紧急事件需重排优先级        │
│  • 调整计划 — 想重新规划                     │
└─────────────────────────────────────────┘
```

核心改动：
1. `task-status-badge` 移到右上角（`absolute top-0 right-0`），显示「执行中」/「已暂停」+ 呼吸动画
2. 暂停按钮点击后展开 `PauseReasonPanel`（5 个预设原因）
3. 完成后替换为 `CompletionSummaryCard`
4. AI 建议部分改成可折叠面板（`ai-collapse-header` + `ai-collapse-body`）
5. 进度条使用 `var(--grad-progress)` 渐变

### 3.3 PauseReasonPanel（新组件）

```tsx
// components/today/PauseReasonPanel.tsx
interface PauseReasonPanelProps {
  onSelect: (reason: PauseReason) => void;
}
type PauseReason = 'low_energy' | 'stuck' | 'interrupted' | 'urgent_task' | 'adjust_plan';
```

### 3.4 CompletionSummaryCard 改造

对标设计稿 `.completion-card`：
- 绿色背景（`var(--complete-bg)`）+ 圆角 2xl
- 居中弹窗式：emoji + 标题 + 实际vs预计 对比 + AI 洞察 + 下一步推荐
- 两个按钮：`[开始下一任务]` + `[稍后再说]`

### 3.5 TodayRoute 时间颜色编码

每条路由行增加语义色：
```
当前时间任务 → .route-item.current (蓝色呼吸边框)
提前完成     → .route-item.ahead (绿色呼吸边框)
未来的       → 默认灰色
逾期的       → .route-item.late (红色)
```

---

## 四、Phase C：Plan 页面重构

### 4.1 改造文件清单

| 文件 | 改造内容 |
|------|----------|
| `components/plan/PlanDashboard.tsx` | 重排组件顺序 + 新增 ProgressSnapshot 位置 |
| **新建** `components/plan/ProgressSnapshot.tsx` | 紧凑进度概览（提前/正常/落后统计） |
| `components/plan/DecisionPanel.tsx` | 改为内嵌面板（非抽屉），移到日历前 |
| `components/plan/WeekCalendar.tsx` | 时段背景色 + 呼吸动画 + 拆分（见下） |
| `components/plan/CalendarGrid.tsx` | 定位优化 |

### 4.2 PlanDashboard 重排

设计稿的顺序（从上到下）：
```
PageHero
  └── [本周] [下周] 切换按钮

ProgressSnapshot (紧凑一行)
  ├── 2 提前 · 3 正常 · 1 落后
  └── [详情 ▼] → 展开具体任务进度列表

AI Decision Panel (可折叠)
  ├── 🤖 AI 决策建议 (2 条待处理)
  ├── "准备电赛材料" 安排在什么时候？ → [周五下午] [周六上午 推荐] [推迟]
  └── "实验报告" 需要拆分吗？ → [拆为3个子任务 推荐] [暂不处理]

Week Navigator (← → 周标签)

时间表（周日历网格）
  ├── 7 天列头 + 时间纵轴
  ├── 时段背景色（上午/下午/晚上）
  ├── 任务块（scheduled/deadline/idea/done/current）
  └── Today 列高亮
```

### 4.3 ProgressSnapshot（新组件）

```tsx
// components/plan/ProgressSnapshot.tsx
interface ProgressSnapshotProps {
  ahead: number;      // 提前完成数
  normal: number;     // 正常进度数
  behind: number;     // 落后数
  details: ProgressDetail[];  // 展开详情列表
  collapsible?: boolean;
}
```

样式对标设计稿 `.progress-snapshot`：flex 行 + 分隔线 + 可折叠详情表格。

### 4.4 WeekCalendar 拆分

当前 325 行过于庞大，拆分为：
```
WeekCalendar.tsx        — 容器（周导航 + 数据协调）
CalendarGrid.tsx        — 7 天 × 小时网格（纯渲染）
CalendarTaskBlock.tsx   — 任务块（独立组件）
CalendarDayCol.tsx      — 单天列（含时段背景）
QuickCreateForm.tsx     — 点击空白格内联表单（新组件）
```

时段背景色（对标设计稿 `.cal-period-bg`）：
```
上午 08-12 → #f8fafc
下午 12-18 → #eff6ff  
晚上 18-24 → #f5f3ff
```

### 4.5 DecisionPanel 改为内嵌

当前是右侧抽屉，设计稿是日历上方的内嵌卡片 `.decision-panel.compact`：
- 紫色渐变头部（`var(--ai-card-bg)`）
- 决策行：任务名 + 操作按钮组
- 推荐按钮使用 accept 样式（`var(--ai-accent)` 实色）

---

## 五、Phase D：其余页面对标

### 5.1 Login 页面

| 文件 | 改造 |
|------|------|
| `app/(auth)/login/page.tsx` | 渐变背景 `var(--grad-login-bg)` + 品牌图标 + 卡片阴影 |
| `app/(auth)/register/page.tsx` | 同上 |

设计稿关键样式：
- 页面背景：`var(--grad-login-bg)` 渐变
- Login Card：`border-radius: var(--radius-2xl)` + `box-shadow: var(--shadow-lg)`
- Logo：品牌渐变图标（`var(--grad-brand)`）+ Task OS 标题
- 输入框 focus：`border-color: var(--color-brand-500)` + `box-shadow: 0 0 0 3px rgba(99,102,241,0.15)`

### 5.2 Inbox 页面

| 文件 | 改造 |
|------|------|
| `app/(dashboard)/inbox/page.tsx` | 对标设计稿输入区样式 |

设计稿 `.inbox-input-area`：
- 白色背景 + 圆角 2xl + 阴影
- 无边框 textarea，placeholder 颜色 token
- 底部：AI 状态指示 + 提交按钮

### 5.3 Review 页面

| 文件 | 改造 |
|------|------|
| `app/(dashboard)/review/page.tsx` | 统计卡片网格 + 效率矩阵 + AI 归因 |

设计稿关键样式：
- `.stat-grid`：3 列统计卡片（完成任务/专注时间/连续天数）
- `.eff-row`：效率矩阵横条（标签 + 进度条 + 统计）
- `.chart-bar`：柱状图（每日完成分布）

### 5.4 Settings 页面

| 文件 | 改造 |
|------|------|
| `app/(dashboard)/settings/page.tsx` | 对标设计稿分组卡片 + 主题预设卡片 |

设计稿 `.settings-section`：
- 白色卡片 + 可折叠 header/body
- 每组有图标 + 标题 + 展开箭头
- Theme Preset 改为卡片网格（3 列）：每个卡片有彩色预览 + 名称 + 描述
- 表单行使用 `.set-row` 水平布局

### 5.5 Mobile Navigation

| 文件 | 改造 |
|------|------|
| `components/mobile-nav.tsx` | 品牌色动态 + 暗色模式适配 |

当前硬编码 indigo→purple 渐变。改为引用 CSS 变量 `var(--grad-brand)`，随品牌主题切换。

---

## 六、Phase E：收尾

### 6.1 暗色模式适配

关键改造点：
- `Card` 组件：`bg-[var(--color-surface)]` 替代硬编码 `bg-white`
- `PageHero` 图标背景：深色模式下降低不透明度
- `Plan 日历`：时段背景色在深色模式下调整
- `Mobile Nav`：毛玻璃背景在深色模式下使用暗色半透明

### 6.2 表情符号 -> SVG 图标迁移

全项目 grep 所有 `emoji` 字符串，逐一替换：

| 表情符号 | 替换为 |
|----------|--------|
| 🤖 | AIIcon |
| 🔄 | RefreshIcon（或删除） |
| ☕ | 删除 |
| ▶ | PlayIcon |
| ⏸ | PauseIcon |
| 🎉 | CheckCircleIcon |
| 💡 | LightbulbIcon |
| 📊 | ChartIcon |
| ✓ | CheckIcon |
| ✕ | XIcon |

### 6.3 编译验证

```bash
npm run build  # 确保零错误
```

---

## 七、文件变更清单（完整）

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `src/components/today/PauseReasonPanel.tsx` | 暂停原因面板（5 个预设） |
| `src/components/today/CompletionSummary.tsx` | 完成庆祝卡片（从 FocusTaskCard 拆出） |
| `src/components/plan/ProgressSnapshot.tsx` | Plan 紧凑进度概览 |

### 修改文件

**基础设施：**
| 文件 | 改造 |
|------|------|
| `src/app/globals.css` | 新增 50+ CSS 变量 + 5 个 @keyframes + Tailwind 工具类 |
| `src/components/ui/icons.tsx` | 新增 20+ SVG 图标 |
| `src/components/ui/Card.tsx` | 主题感知背景 + focus/route 新变体 |
| `src/components/ui/PageHero.tsx` | 渐变背景图标 + subtitle 属性 |
| `src/components/ui/Button.tsx` | outline 变体 + iconOnly + size 枚举 |
| `src/components/ui/Modal.tsx` | 入场动画启用 |
| `src/components/ui/Input.tsx` | 确保 focus ring 使用品牌色 |

**Today 页面：**
| 文件 | 改造 |
|------|------|
| `src/components/today/FocusTaskCard.tsx` | V3 设计：badge 右上角 + AI 建议折叠 + 暂停/完成底部 |
| `src/components/today/TodayBriefCard.tsx` | 内联状态栏样式对标 |
| `src/components/today/TodayRoute.tsx` | 时间颜色编码（current/ahead/late） |
| `src/components/today/TodayAIPanel.tsx` | 表情→图标 |
| `src/components/today/MustDoList.tsx` | 表情→图标 |
| `src/app/(dashboard)/today/page.tsx` | 布局调整 |

**Plan 页面：**
| 文件 | 改造 |
|------|------|
| `src/components/plan/PlanDashboard.tsx` | 组件重排 + ProgressSnapshot 集成 |
| `src/components/plan/WeekCalendar.tsx` | 拆分 + 时段背景色 |
| `src/components/plan/DecisionPanel.tsx` | 抽屉→内嵌面板 + 紧凑模式 |
| `src/components/plan/WeeklyProgress.tsx` | 表情→图标 |
| `src/hooks/usePlan.ts` | ProgressSnapshot 数据支持 |

**其余页面：**
| 文件 | 改造 |
|------|------|
| `src/app/(auth)/login/page.tsx` | 渐变背景 + 卡片升级 |
| `src/app/(auth)/register/page.tsx` | 同上 |
| `src/app/(dashboard)/inbox/page.tsx` | 输入区样式对标 |
| `src/app/(dashboard)/review/page.tsx` | 统计网格 + 效率矩阵对标 |
| `src/app/(dashboard)/settings/page.tsx` | 分组卡片 + 预设卡片网格 + Input 组件替换 |
| `src/components/mobile-nav.tsx` | 品牌色动态引用 |
| `src/components/sidebar.tsx` | 无明显设计变更，保持 |

### 不改文件

| 文件 | 原因 |
|------|------|
| `src/styles/themes.css` | 现有 4 轴主题系统保留，globals.css 新变量在此之上叠加 |
| `src/lib/ai/*` | 业务逻辑不变 |
| `src/app/api/**` | API 接口不变 |
| `src/types/**` | 类型不变 |
| `prisma/schema.prisma` | 数据库不变 |

---

## 八、实施顺序建议

```
Day 1-2: Phase A (基础设施)
  → 扩展 globals.css 变量 + 动画
  → 扩展 icons.tsx 图标库
  → 升级 Card/PageHero/Button/Modal/Input 组件

Day 3-4: Phase B (Today 页面)
  → 拆分 FocusTaskCard → PauseReasonPanel + CompletionSummary
  → V3 布局 + 状态徽章 + 暂停流程
  → TodayRoute 时间颜色编码
  → TodayBriefCard 内联风格

Day 5-6: Phase C (Plan 页面)
  → 新建 ProgressSnapshot
  → WeekCalendar 拆分为 5 个子组件
  → DecisionPanel 改为内嵌
  → PlanDashboard 重排

Day 7-8: Phase D (其余页面)
  → Login/Register 页面升级
  → Inbox 输入区对标
  → Review 统计卡片网格
  → Settings 分组卡片
  → MobileNav 品牌色

Day 9: Phase E (收尾)
  → 暗色模式适配验证
  → 全项目表情→图标迁移
  → npm run build 验证
  → 移动端横屏/平板测试
```

---

## 九、风险与注意事项

1. **不修改 API 接口**：重构仅限 UI 层，后端接口和业务逻辑不变
2. **不破坏现有主题系统**：globals.css 新增变量是增量的，`themes.css` 中已有的 4 轴变量不作修改
3. **大型组件拆分时要保持接口兼容**：`PlanDashboard.props` 对外接口不变，但内部改为组合模式
4. **先验证再合并**：每个 Phase 完成后 `npm run build` 验证零错误
5. **移动端适配**：Phase E 中需在 390px 宽度验证所有页面
