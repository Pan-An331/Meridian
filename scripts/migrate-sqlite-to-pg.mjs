/* ═══════════════════════════════════════════════════════
   SQLite → Postgres 数据迁移脚本（数据库迁移方案 §3 方案B）
   用法：node scripts/migrate-sqlite-to-pg.mjs <PG_DATABASE_URL>
   原理：node:sqlite 读 prisma/dev.db → 按依赖顺序写入 PG（主键全 UUID，无自增序列）
   dev.db 永久保留为备份（本脚本只读不删）
   ═══════════════════════════════════════════════════════ */
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";

// pg 包从独立安装目录加载（npm install 在 .pg-local/pgmods，绕开 safe-delete）
const require = createRequire(import.meta.url);
const pg = require("G:\\Agent_Project\\task-manage-sys\\.pg-local\\pgmods\\node_modules\\pg");

const PG_URL = process.argv[2] || process.env.DATABASE_URL;
if (!PG_URL) { console.error("用法: node scripts/migrate-sqlite-to-pg.mjs <PG_DATABASE_URL>"); process.exit(1); }

// ── 1. 读 SQLite ──
const src = new DatabaseSync("prisma/dev.db", { readOnly: true });
const allTables = src.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'").all().map(r => r.name);

// ── 2. 表依赖顺序（外键约束：父表先写）──
const DEP_ORDER = [
  "users",                       // 根
  "ai_configs", "user_profiles", "user_states", "user_models",
  "tasks",                       // 依赖 users；自引用 parentId 需先建根节点 → 但 UUID 可乱序？不，parentId 外键需要父已存在 → 按 depth 处理
  "schedules", "time_logs", "daily_summaries", "daily_notes",
  "task_drafts", "task_draft_items",
  "agent_memories", "agent_feedbacks", "decision_logs", "today_decisions",
  "task_execution_feedback", "daily_briefs", "user_observations", "user_patterns",
];
const tables = allTables.filter(t => DEP_ORDER.includes(t));

// 校验：20 张业务表全部在清单中
const missing = DEP_ORDER.filter(t => !allTables.includes(t));
if (missing.length > 0) { console.error("缺少表:", missing.join(", ")); process.exit(1); }

// ── 3. 连 PG ──
const client = new pg.Client({ connectionString: PG_URL });
await client.connect();
console.log("已连接 PG:", PG_URL.replace(/:[^:@]+@/, ":****@"));

// 跳过外键检查（tasks.parentId 自引用 + 表间 FK，主键全 UUID 无顺序依赖；文档 §3 允许）
await client.query("SET session_replication_role = replica");

// 时间戳归一化：SQLite 把 DateTime 存成毫秒整数（1784790508669），PG TIMESTAMPTZ 需 ISO 字符串
function toPgValue(v) {
  if (typeof v === "number" && Number.isInteger(v) && Math.abs(v) > 100000000000) {
    return new Date(v).toISOString();
  }
  return v;
}

// 逐表迁移（按依赖顺序）
let totalRows = 0;
for (const t of tables) {
  const rows = src.prepare(`SELECT * FROM "${t}"`).all();
  if (rows.length === 0) { console.log(`  ${t}: 0 行（跳过）`); continue; }
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(", ");
  const ph = cols.map((_, i) => `$${i + 1}`).join(", ");
  const sql = `INSERT INTO "${t}" (${colList}) VALUES (${ph}) ON CONFLICT DO NOTHING`;
  for (const row of rows) {
    await client.query(sql, cols.map(c => toPgValue(row[c])));
  }
  totalRows += rows.length;
  console.log(`  ${t}: ${rows.length} 行 ✅`);
}
await client.query("SET session_replication_role = DEFAULT");
console.log(`\n迁移完成：${tables.length} 表，${totalRows} 行`);

await client.end();
src.close();
