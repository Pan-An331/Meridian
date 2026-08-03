/* 20 表行数对比（SQLite vs PG）——迁移验证 §4 */
import { DatabaseSync } from "node:sqlite";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require("G:\\Agent_Project\\task-manage-sys\\.pg-local\\pgmods\\node_modules\\pg");

const src = new DatabaseSync("prisma/dev.db", { readOnly: true });
const tables = src.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%' ORDER BY name").all().map(r => r.name);

const client = new pg.Client({ connectionString: process.argv[2] });
await client.connect();

let allMatch = true;
console.log("表名                      SQLite   PG      一致");
for (const t of tables) {
  const sqliteCount = src.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n;
  const pgRes = await client.query(`SELECT COUNT(*) n FROM "${t}"`);
  const pgCount = Number(pgRes.rows[0].n);
  const ok = sqliteCount === pgCount ? "✅" : "❌";
  if (!ok) allMatch = false;
  console.log(`  ${t.padEnd(24)} ${String(sqliteCount).padEnd(7)} ${String(pgCount).padEnd(7)} ${ok}`);
}
console.log(allMatch ? "\n全部 20 表行数一致 ✅" : "\n存在不一致 ❌");
await client.end();
src.close();
