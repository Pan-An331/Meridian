# Meridian · 子午（Task OS）

> **你的时间，自有中轴。** — 个人成长系统（个人时间操作系统）

Meridian 是面向学生/备考者的**个人成长系统**：收纳 → 规划 → 执行 → 复盘 的成长闭环，AI 辅助理解与建议，用户始终拥有最终控制权。

技术栈：**Next.js 16（App Router）+ TypeScript + Prisma + PostgreSQL**（本地开发为 SQLite 迁移前的 PG 便携版）。

---

## 📁 目录结构（2026-08-04 整理后）

```
├── Task OS 项目总控文档 V2.0.md   ← 产品宪法（定位/理念/红线/决策记录）【必读第 1】
├── docs/                          ← 文档中心（当前有效文档）
│   ├── 任务信息架构规范-V3.md      ← 开发 SSOT（信息架构/后端契约/前端契约）【必读第 2】
│   ├── API接口清单.md              ← API 全景（零件手册）【必读第 3】
│   ├── 用户使用手册.md             ← 面向真实用户的产品手册
│   ├── 五页面布局重排方案-2026-08-03.md  ← 页面布局规范（Today/Plan/Review）
│   ├── FocusCard-V2-UI设计规格.html     ← Focus Card 设计规格
│   ├── Meridian-云端部署方案-2026-08-03.md       ← 部署架构（Vercel+Neon 免费版）
│   ├── Meridian-云端部署-用户操作指南-2026-08-04.md ← 部署操作（用户账号操作）
│   ├── Meridian-登录页品牌文案规格-2026-08-03.md  ← 品牌文案（slogan 三层）
│   ├── Project页优化-使用文档-2026-08-04.md       ← Project 页使用说明
│   ├── 项目开发地图.html           ← 开发路线图（已完成/Next/Later/问题清单）
│   └── archive/                   ← 开发过程文档归档（实施报告/审查报告/旧方案，git 历史可恢复）
├── UI示例/                        ← 视觉基准（定稿稿，UI 修改时对照）
│   ├── FocusCard-V2-UI副本.html           ← Focus Card 视觉定稿
│   ├── Today-弹性方案-类型全览-2026-08-03.html ← Today 弹性布局定稿
│   ├── Project-优化副本-2026-08-04.html   ← Project 页视觉定稿（v3.1）
│   ├── Meridian-登录页视觉稿-2026-08-03.html ← 登录页视觉定稿
│   └── archive/                   ← 历史设计稿归档
├── src/                           ← 应用代码
│   ├── app/(dashboard)/           ← 五页面（inbox/plan/today/review/projects）
│   ├── app/api/                   ← API 路由
│   ├── components/                ← 组件（today/FocusCardV2、task/档案面板、search/全局搜索…）
│   └── lib/                       ← 服务层（plan/ai/inbox/project/task…）
├── prisma/                        ← schema.prisma + 迁移
├── scripts/                       ← 工具脚本（migrate-sqlite-to-pg、v3-theme-migration…；archive/ 为一次性脚本）
├── tests/                         ← vitest 测试（95 用例）
├── public/                        ← 品牌资源（meridian-icon.svg、PWA manifest/sw.js）
└── .workbuddy/memory/             ← 项目工作记忆（开发历史，新工作台读取）
```

---

## 🚀 快速开始

```bash
npm install        # 装依赖
npm run dev        # 启动开发服务器 → http://localhost:3000
npm test           # vitest 测试（95 用例）
npx tsc --noEmit   # 类型检查
npm run build      # 生产构建
```

环境变量（`.env`，参照 `.env.example`）：
- `DATABASE_URL` — PostgreSQL 连接串（本地便携 PG：`postgresql://postgres:postgres@localhost:5432/meridian`）
- `AUTH_SECRET` / `AUTH_TRUST_HOST` — 登录鉴权

> ⚠️ **Next.js 版本注意**：本项目 Next.js 16 有破坏性变更，写代码前先读 `node_modules/next/dist/docs/` 相关指南（见 AGENTS.md）。

---

## 📚 开发必读（顺序）

1. `Task OS 项目总控文档 V2.0.md` — 产品宪法（为什么做）
2. `docs/任务信息架构规范-V3.md` — 开发 SSOT（怎么做：信息架构/后端契约/前端契约/决策记录 D1-D17）
3. `docs/API接口清单.md` — API 全景
4. `AGENTS.md` — 开发纪律

> **SSOT 纪律**：本文档 > 总控文档 > API 清单 > 代码。冲突时改代码不改文档。

---

## 🏗️ 部署状态（2026-08-04）

- ✅ 数据库已迁移 PostgreSQL（20 表 1717 行，dev.db 本地备份保留）
- ✅ git 仓库已初始化（commit 6a1c4a4 起）
- ⏳ **待用户操作**（约 30 分钟，按 `docs/Meridian-云端部署-用户操作指南-2026-08-04.md`）：
  1. 推送 GitHub（私有仓库）
  2. Neon 建免费 Postgres 库 + 导数据
  3. Vercel 导入部署 + 环境变量（DATABASE_URL/AUTH_SECRET/AUTH_TRUST_HOST）
- 📱 移动端：已做全站适配（375px 实测），PWA manifest/sw.js 就绪，手机挂梯子访问

---

## 🔄 项目交接（移动位置 / 新工作台）

本项目设计为**可整体搬迁**，搬迁后在新工作台无缝接手：

1. **移动方式**：整个文件夹（含 `.git`、`.workbuddy/`、`prisma/dev.db` 备份）一起移动即可，无绝对路径依赖
2. **新工作台接手步骤**：
   - 打开新工作台指向项目根目录
   - 读本 README → 总控文档 → 信息架构 V3 → API 清单（开发必读顺序）
   - `.workbuddy/memory/` 有完整开发记忆（MEMORY.md 长期 + 每日日志），可直接查询历史决策
3. **接手后验证**：`npm install && npm test`（95 用例全过）→ `npm run dev` 冒烟
4. **git 状态**：整理后的变更已 commit；如移动端适配有未提交改动，先 commit 再移动

**文档约定**：本文档与 docs/ 使用**相对路径引用**（如 `docs/任务信息架构规范-V3.md`），移动文件夹不破坏链接。

---

## 📜 历史沿革

- 2026-07-31：Stage 0-4 + Phase 1/2/3（AI 深度闭环）
- 2026-08-02：V5 任务层级重构、产品定位（个人成长系统）、信息架构 V1/V2
- 2026-08-03：V3 全链路（主题机制/档案面板/全局搜索/指标卡）、Focus Card V2、品牌 Meridian 定名、数据库迁移
- 2026-08-04：五页面布局重排、Project 页优化、品牌实施、收尾批次、全站移动端适配、**项目目录整理 + 交接准备**

---

*Meridian · 子午 — 你的时间，自有中轴*
