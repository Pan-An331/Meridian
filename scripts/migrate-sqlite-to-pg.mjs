/* ═══════════════════════════════════════════════════════
   SQLite → Postgres 数据迁移脚本（数据库迁移方案 §3 方案B）
   用法：node scripts/migrate-sqlite-to-pg.mjs <PG_DATABASE_URL>
   原理：node:sqlite 读 prisma/dev.db → 按依赖顺序写入 PG（主键全 UUID，无自增序列）
   dev.db 永久保留为备份（本脚本只读不删）
   ═══════════════════════════════════════════════════════ */
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// pg 包从独立安装目录加载（npm install 在 .pg-local/pgmods，绕开 safe-delete）
// 相对路径：脚本在 scripts/ 下 → ../.pg-local/pgmods/...（项目可整体搬迁，无绝对路径依赖）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pg = require(path.join(__dirname, "..", ".pg-local", "pgmods", "node_modules", "pg"));

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
// 按依赖顺序重排（DEP_ORDER 优先，而非 SQLite 创建顺序——FK 父表必须先插）
const tables = DEP_ORDER.filter(t => allTables.includes(t));

// 校验：20 张业务表全部在清单中
const missing = DEP_ORDER.filter(t => !allTables.includes(t));
if (missing.length > 0) { console.error("缺少表:", missing.join(", ")); process.exit(1); }

// ── 3. 连 PG ──
const client = new pg.Client({ connectionString: PG_URL });
await client.connect();
console.log("已连接 PG:", PG_URL.replace(/:[^:@]+@/, ":****@"));

// 时间戳归一化：SQLite 把 DateTime 存成毫秒整数（1784790508669），PG TIMESTAMPTZ 需 ISO 字符串
function toPgValue(v) {
  if (typeof v === "number" && Number.isInteger(v) && Math.abs(v) > 100000000000) {
    return new Date(v).toISOString();
  }
  return v;
}

// 批量插入一行集合（ON CONFLICT DO NOTHING 幂等；FK 失败的行跳过计数——dev.db 可能存在孤儿脏数据）
// 分批 100 行多值 INSERT（Neon 免费版对大量单行查询有限制，批量可避免连接被掐断）
// 批量遇 23503 时回退逐行插入（逐行跳过孤儿，避免整批丢失）
async function insertRows(table, rows, cols) {
  const colList = cols.map(c => `"${c}"`).join(", ");
  let ok = 0, skipped = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const phs = batch.map((_, j) => `(${cols.map((_, k) => `$${j * cols.length + k + 1}`).join(", ")})`).join(", ");
    const vals = batch.flatMap(r => cols.map(c => toPgValue(r[c])));
    try {
      await client.query(`INSERT INTO "${table}" (${colList}) VALUES ${phs} ON CONFLICT DO NOTHING`, vals);
      ok += batch.length;
    } catch (e) {
      if (e.code !== "23503") throw e;
      // FK 违反：回退逐行（逐行跳过孤儿）
      const oneSql = `INSERT INTO "${table}" (${colList}) VALUES (${cols.map((_, k) => `$${k + 1}`).join(", ")}) ON CONFLICT DO NOTHING`;
      for (const row of batch) {
        try {
          await client.query(oneSql, cols.map(c => toPgValue(row[c])));
          ok++;
        } catch (e2) {
          if (e2.code === "23503") { skipped++; continue; }
          throw e2;
        }
      }
    }
  }
  return { ok, skipped };
}

// 逐表迁移（按依赖顺序；tasks 自引用 parentId 需分层：先无父、再逐层）
let totalRows = 0;
for (const t of tables) {
  const rows = src.prepare(`SELECT * FROM "${t}"`).all();
  if (rows.length === 0) { console.log(`  ${t}: 0 行（跳过）`); continue; }
  const cols = Object.keys(rows[0]);
  if (t === "tasks" && cols.includes("parentId")) {
    // 分层：第一轮插 parentId 为 NULL（根节点），后续循环插"父已存在"的行
    let remaining = rows;
    let round = 1;
    while (remaining.length > 0) {
      const insertedIds = new Set(
        (await client.query(`SELECT id FROM "tasks"`)).rows.map(r => r.id)
      );
      const batch = remaining.filter(r => r.parentId == null || insertedIds.has(r.parentId));
      if (batch.length === 0) {
        console.error(`  tasks: 第 ${round} 轮无进展（孤立节点 ${remaining.length} 个，parentId 不存在）——跳过剩余`);
        break;
      }
      await insertRows("tasks", batch, cols);
      remaining = remaining.filter(r => !batch.includes(r));
      console.log(`  tasks: 第 ${round} 轮 ${batch.length} 行 ✅（剩 ${remaining.length}）`);
      round++;
    }
  } else {
    const { ok, skipped } = await insertRows(t, rows, cols);
    const suffix = skipped > 0 ? `（跳过孤儿 ${skipped} 行）` : "";
    console.log(`  ${t}: ${ok} 行 ✅${suffix}`);
  }
}
console.log(`\n迁移完成：${tables.length} 表，${totalRows} 行`);

await client.end();
src.close();
