# Today · Focus Card V2 实施简报（2026-08-03）

> 依据：《docs/FocusCard-V2-UI设计规格.html》（§0 设计原则 / §1 共性五区 / §2 状态机 / §3 五卡分案 / 视觉定稿补充 4 条）+《UI示例/FocusCard-V2-UI副本.html》（最终视觉基准）
> 范围：前端 UI 落地（mock purpose/departureAt）· **本轮不动后端** · 状态：落地完成，含两轮布局修正

---

## 1. 交付内容

### 新组件 `src/components/today/FocusCardV2.tsx`
| 维度 | 实现 |
|------|------|
| **5 区结构** | A 动机行（紫底，purpose 或类型提示）→ B 行动区（标题 + 主按钮）→ C 执行工具（类型专属）→ D 回来确认 → E 元信息行（归属·预计/已用·＋备注） |
| **4 态状态机** | 未出发 →（点「出发」记 departureAt）→ 出发中（暂停出现）→（回来点完成/打卡）→ 回来确认（弹补记时长/打卡输入）→ 已完成✓（绿闪 + 置灰） |
| **5 类型** | 固定时间（到点自动完成）/ 清单 / 学习 / 积累·每日 / 积累·频次 |
| **v2-memo 清单** | 底 #fff9e6 / 左边条 #f5a623 / 标题字 #8b6914 / 勾选框 #d4a853 + **小标题**（执行清单/知识点/今日动作）虚线分隔；高亮下一项（左 4px 品牌条 + 浅底） |
| **宽度策略** | 卡片全宽与页面其他卡片对齐；min-width `min(420px,100%)`（timer/learning `min(360px,100%)`）防窄屏溢出；**视口 ≥860px 自动两栏**（globals.css `.fcv2-*` 媒体查询） |
| **弹窗** | 暂停原因（5 单选）/ 补记时长（30分/1h/自定义，默认=现在−出发）/ 打卡内容输入（积累型） |

### 两栏内容分配（对照副本 col2-left / col2-right，第二轮修正）
- **左栏（数据区 · 灰底 0.72）**：所属项目 → **项目阶段列表**（done 划线 / current 高亮蓝条 / future 灰）+ 项目进度条 → 分隔线 → 时段/地点/预计/已用 → 积累统计三格 + 周目标 + 频率 → AI 执行/提醒条
- **右栏（执行区 · 白底 1.28）**：**任务名称** + 类型标签 + 暂停/主按钮 → **执行清单（v2-memo）/ 时间块大字号 / 今日动作清单** + 进度 → 回来确认区
- 单栏（<860px）：flex-column + order（执行区在上、数据区沉底），B 行动区始终在 C 工具之前

### Today 页面集成 `src/app/(dashboard)/today/page.tsx`
- 主卡 = FocusCardV2（`toCardV2` 映射真实 currentTask；完成/勾选/打卡走真实 API，出发/暂停为本地模拟）
- 底部「🧪 Focus Card V2 · 全状态演示」折叠区：4 张 mock 清单型卡（未出发/出发中/回来确认/已完成）可交互体验全状态机 + 弹窗

---

## 2. 两轮 Bug 修复记录（用户验收驱动）

| 轮次 | 问题 | 根因 | 修复 |
|------|------|------|------|
| 1 | 卡片与页面其他卡片错位（歪） | wrapper `w-full` + `maxWidth:640` 且无 `mx-auto` → 640px 靠左；`minWidth:420` 窄屏溢出 | 去 maxWidth 全宽对齐；minWidth 改 `min(420/360px,100%)` |
| 1 | 单栏时标题跑到统计下面 | 左栏 JSX 在右栏之前，折叠后顺序错 | `.fcv2-grid` 单栏 flex-column + order（数据区 order:3 沉底、执行区 order:1 置顶） |
| 2 | 两栏内容分配与副本相反 | 清单塞进左栏、右栏空 | 左右栏内容整体对调：左=归属+项目阶段，右=任务名称+执行清单；MemoList 单份在右栏 |

---

## 3. 验证

| 项 | 结果 |
|----|------|
| `tsc --noEmit` | ✅ |
| `next build` | ✅ |
| dev 冒烟 /today | ✅ 200 |

---

## 4. 后端衔接（2026-08-03 后端四阶段完成后已对接 ✅）

> 后端：docs/FocusCardV2-后端实施报告-2026-08-03.md（schema +Task.purpose/departureAt +TimeLog.detail，API 全就绪）

| 字段 | 对接结果 |
|------|-----------|
| `Task.purpose` | ✅ toCardV2 直读后端（含父级继承后值）；Inbox 确认表单 + 档案面板加动机输入框（≤50 字，可编辑） |
| `Task.departureAt` | ✅ 出发按钮 → action `start`（后端写出发时刻）；补记时长默认值 = 现在 − 真实出发 |
| `TimeLog.detail` | ✅ 打卡弹窗内容 → checkin `detail`（≤200 字）落库 |
| 回来补记 | ✅ 非积累型完成 → action `complete` 带 `durationMinutes`（后端写 TimeLog） |
| 暂停原因 | ✅ 暂停弹窗 → action `pause` + reason（UserObservation 落库） |
| 惰性结算 | ✅ 固定时间型到点自动完成由后端 views/today 打开时补算（detail='auto'，无 cron） |
| 项目树阶段数据 | 左栏 `stages`/`projectProgress` 仍为 mock（待项目树 API，独立后续项） |

**对接改动**：FocusCardV2.tsx 动作钩子带数据（onStart/onComplete(min)/onCheckin(detail)/onPause(reason)）；today/page.tsx 接线真实 API；CurrentTask 接口 +purpose/departureAt；toCardV2 phase 状态机由后端数据推导（departureAt→going，completed→done）。

---

## 5. 遗留
- 积累·每日的 mini-cal（规格 §3.3「小日历保留现有设计」）暂未迁入 V2 右栏（V1 AccumPanel 已有，V2 未复用）
- Focus Card 左栏项目阶段 stages/projectProgress 为 mock（项目树 API 就绪后可直读）
- 忘记确认提示条（出发后未确认 → 提示补记/继续）为前端 UI，可基于 departureAt 后续补

*阶段简报 · 前端 UI + 后端四阶段 + 前端对接全部完成，V2 全链路闭环。*
