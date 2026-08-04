# Project 页面 · API 缺口清单（待后续解决）

> 记录时间：2026-08-02 · 依据：Project 的 UI 设计（V5 任务层级重构）
> 状态：**待解决** —— UI 已按现有 API 组态，以下能力因缺少数据支撑暂以近似实现

---

## P1 · 影响核心交互（建议优先）

### 1. ★ anchor（锚点任务）无独立字段
- **设计稿语义**：`anchor: true` 独立标记（Today 以此任务为中心）；project/phase/task 任意层级都可标
- **现状**：数据库只有 `level`（"task"），前端用 `level === "task"` 近似 ★，"标为锚点"菜单实际改的是 level（task ↔ phase）——语义被偷换
- **需要的 API**：Task 表加 `anchor Boolean @default(false)`；`PUT /api/tasks/:id` 支持更新 anchor；today 决策引擎读 anchor 选焦点

### 2. 清单项 tag（phase 阶段项 / note 备注项）
- **设计稿语义**：执行清单每条带 `tag: 'phase' | 'note'`（阶段项 = 该任务的关键步骤，备注项 = 附加说明），树内以不同样式区分
- **现状**：清单项 = 子任务（children），无 tag 字段
- **需要的 API**：Task 表加 `checkTag String?`（"phase"/"note"）；tree API 返回；前端树/详情区分样式

### 3. streak 批量查询
- **设计稿语义**：一次加载全部积累任务的连续天数/点阵（树 + 详情同时展示）
- **现状**：前端对每个积累任务单独 `GET /api/tasks/:id/streak`（N 个请求）
- **需要的 API**：`GET /api/tasks/streaks?ids=a,b,c` → `{ [taskId]: StreakInfo }` 一次返回

## P2 · 体验增强（有空再做）

### 4. 拖到两节点之间 = 插序（调顺序）
- **设计稿语义**：拖到节点上 = 成为子级（已实现 ✓）；拖到两节点之间 = 同级插序
- **现状**：move API 已支持 `sortOrder`，但前端只实现了"成为子级"
- **需要的 API**：无（纯前端：drop 时计算目标 index → 批量写 sortOrder，moveNode 已支持）

### 5. 项目/节点颜色（project 彩色圆点 + 文件夹着色）
- **设计稿语义**：每个 project 有 `color`（#7c3aed 等），树中文件夹/圆点着色，行背景 5% 淡染
- **现状**：Task 无 color 字段，全部用品牌色
- **需要的 API**：Task 表加 `color String?`（或前端按 title hash 生成稳定色）

### 6. 树展开状态持久化
- **现状**：刷新后展开状态丢失
- **需要的 API**：无（前端 localStorage 即可）

---

## 已就绪的 API（无需改动）

| API | 用途 |
|---|---|
| `GET /api/projects/tree` | 树 + orphans（含 level/status/accumulate/importance） |
| `POST /api/projects/move` | 拖拽改父子（循环防护 ✓）+ sortOrder 插序 |
| `POST /api/tasks` / `PUT /api/tasks/:id` | 新建（自动推断类型）/ 更新（积累开关等） |
| `POST /api/tasks/:id/action` | 完成 / 重开（勾选清单项） |
| `GET /api/tasks/:id/streak` | 连续天数 / 最长 / 30 天点阵 / 今日是否打卡 |
| `POST /api/tasks/:id/checkin` | 打卡（写 checkin TimeLog） |
