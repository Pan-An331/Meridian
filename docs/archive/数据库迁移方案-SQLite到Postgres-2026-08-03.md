# 数据库迁移方案：SQLite → Postgres + Vercel 上线

> 版本：2026-08-03 · 产品经理签发 · 供高级工程师执行
> 目标：把项目从本地 SQLite 迁移到云 Postgres，并完成 Vercel 免费部署（¥0/月）
> 配套文档：`docs/Meridian-云端部署方案-2026-08-03.md`（v2 免费版）

---

## 1. 前置检查结论（PM 已核查，迁移风险低）

| 检查项 | 结果 | 影响 |
|--------|------|------|
| enum / dbgenerated / 特殊类型 | **无**（仅 `dataJson String` 普通字符串） | 无类型转换风险 |
| 主键 | **全部 `String @id @default(uuid())`** | 无需处理自增序列，JSON 直搬 |
| 关系 | 23 个 @relation | PG 完全支持，Prisma 抽象 |
| 索引 | 大量 @@index（含复合） | PG 完全支持 |
| 硬编码 | 仅 `scripts/query_db.js` 引用 dev.db | 调试脚本，删或忽略 |
| git | **未初始化** | 需 `git init` + 推 GitHub |
| 模型数 | 20 张表 | 全量迁移 |

---

## 2. 代码改动清单（迁移前必改，共 4 处）

### 2.1 `prisma/schema.prisma`

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }

 generator client {
   provider = "prisma-client-js"
+  binaryTargets = ["native", "linux-openssl-3.0.x"]  // Vercel 构建环境保险
 }
```

> 其余模型定义**零改动**。

### 2.2 `.env` 与 `.env.example`

```env
# 本地开发指向本地 PG（或 Neon 免费库）
DATABASE_URL="postgresql://meridian:密码@localhost:5432/meridian"
AUTH_SECRET="（生成一个）"
AUTH_TRUST_HOST="true"   # 已有
```

### 2.3 `next.config.ts`（Vercel 部署关键）

```diff
 const nextConfig: NextConfig = {
   devIndicators: false,
   allowedDevOrigins: ["192.168.10.9"],   // 保留无碍（仅 dev 生效）
-  distDir: ".next-prod",                 // ⚠️ Vercel 构建默认找 .next
 };
```

> **Vercel 部署时必须注释 `distDir: ".next-prod"`**（或改为 `.next`）——Vercel 的构建输出约定是 `.next`，自定义 distDir 会导致部署产物找不到。本地开发保留 .next-prod 可以，但**推 GitHub 前必须改回默认**。

### 2.4 其他

- 删除或忽略 `scripts/query_db.js`（硬编码 dev.db）
- `package.json` scripts 可选加：`"db:migrate": "prisma migrate deploy"`

---

## 3. 数据迁移（SQLite → Postgres）

### 方案 A（推荐）：pgloader 一键迁移

```bash
# 安装 pgloader（macOS: brew install pgloader / Linux: apt install pgloader）
pgloader prisma/dev.db "postgresql://meridian:密码@localhost:5432/meridian"
```

- pgloader 自动建表 + 转类型 + 搬数据，一条命令
- 迁移后以 **Prisma 为准核对**（见 §4 验证）

### 方案 B（备选）：Node 脚本（手动导出/导入）

```ts
// scripts/migrate-sqlite-to-pg.ts（骨架，工程师补全）
// 步骤1：读 SQLite（Node 22 内置 node:sqlite 或 better-sqlite3）
import { DatabaseSync } from "node:sqlite";  // Node 22+（实验性，需 --experimental-sqlite）
const db = new DatabaseSync("prisma/dev.db");
const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
).all().map((r: any) => r.name);

// 步骤2：逐表读出 → JSON 数组（按依赖顺序：User 最先）
for (const t of tables) {
  const rows = db.prepare(`SELECT * FROM "${t}"`).all();
  fs.writeFileSync(`scripts/dump/${t}.json`, JSON.stringify(rows));
}

// 步骤3：连 Postgres（npm i pg），按依赖顺序批量 INSERT（或用 Prisma createMany）
// 依赖顺序建议：
// User → AIConfig/UserProfile/UserState
//      → Task → Schedule/TimeLog/DailySummary/DailyNote/TaskDraft/TaskDraftItem
//      → AgentMemory/AgentFeedback/DecisionLog/TodayDecision/TaskExecutionFeedback
//      → DailyBrief/UserObservation/UserPattern/UserModel
```

> 因为主键全是 UUID，导出 JSON 后**按表顺序直接插入即可**，无自增/序列问题。也可 `SET session_replication_role = replica` 临时跳过外键检查后乱序插入。

---

## 4. 迁移后验证（必做）

```bash
# 1. 建表 + 生成 client
npx prisma migrate dev --name init_pg   # 或 db push（无历史迁移时）
npx prisma generate

# 2. 数据核对：20 张表行数对比（sqlite vs pg）
#    User / Task / Schedule / TimeLog 为关键表，数量必须一致

# 3. 测试用例（DATABASE_URL 指向本地 PG）
npm test          # 预期 79 用例全过（原 SQLite 通过数）

# 4. 接口冒烟（本地 next dev 连 PG）
#    登录 / Today / Plan / Review / stats 均正常
```

---

## 5. Vercel 部署衔接（迁移后 → GitHub → Vercel）

```
① 本地迁移 + 验证通过
② 修改 .env.example + next.config（§2.3 改回默认 distDir）+ .gitignore 确认
   （.gitignore 必须含：node_modules/ .next/ .next-prod/ .env prisma/dev.db）
③ git init → git add → commit → 推 GitHub（新建私有仓库）
④ Vercel 导入仓库（vercel.com → Add New Project → Import）
   - Framework 自动识别 Next.js
   - 环境变量：DATABASE_URL（Neon 连接串）、AUTH_SECRET、AUTH_TRUST_HOST=true
⑤ 部署完成 → https://xxx.vercel.app
⑥ 手机（挂梯子）访问验证 → PWA 添加到主屏幕（后续补）
⑦ 可选：绑自定义域名 + Cloudflare 尝试免梯子
```

### Neon 免费库准备（5 分钟）

1. neon.tech 注册 → 新建 Project（免费 0.5GB）
2. 拿到连接串：`postgresql://user:pass@ep-xxx.region.aws.neon.tech/meridian?sslmode=require`
3. 本地迁移脚本把连接串的 host 换成 Neon 再跑一次（或本地 PG 验证后，用 pg_dump 导入 Neon）
4. Vercel 环境变量 DATABASE_URL 填 Neon 连接串

---

## 6. 风险与回滚

| 风险 | 应对 |
|------|------|
| 迁移数据丢失 | **dev.db 永久保留**为备份（Git 外 / 本地存档） |
| 回滚 | 改回 `provider = "sqlite"` + DATABASE_URL 指回 dev.db，重启即回滚 |
| Neon 免费版休眠 | 闲置自动暂停，唤醒 1-2 秒；用户已接受（数据持久放宽） |
| Vercel 构建失败 | 大概率是 distDir（§2.3）或 Prisma engine 二进制 → binaryTargets 已加保险 |
| 时区/日期 | PG 存 TIMESTAMPTZ，Prisma DateTime 自动处理；验证 Today/Plan 显示无偏移 |
| SQLite→PG 类型差异 | schema 无特殊类型（§1），风险极低 |

---

## 7. 交付物清单

- [ ] `prisma/schema.prisma`：provider=postgresql + binaryTargets（§2.1）
- [ ] `.env.example`：DATABASE_URL PG 格式（§2.2）
- [ ] `next.config.ts`：distDir 注释/改回（§2.3）
- [ ] 数据迁移完成（pgloader 或脚本，§3）
- [ ] 20 表行数核对 + 79 测试过 + 接口冒烟（§4）
- [ ] GitHub 仓库 + Vercel 部署 + 环境变量（§5）
- [ ] 手机（挂梯子）访问验证

---

*工程师完成后按项目惯例写实施报告，交产品验收（抽查 + 测试 + 手机实测）。*
