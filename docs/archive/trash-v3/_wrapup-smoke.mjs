/* 收尾批次 API 冒烟：views/today currentTask.accumStats.monthDates
   直接用 pg 插入指定日期的 checkin TimeLog（checkin API 用当前时间，无法指定日期） */
const BASE = "http://localhost:3000";
const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
const pgmod = require("G:\\Agent_Project\\task-manage-sys\\.pg-local\\pgmods\\node_modules\\pg");
const PG_URL = "postgresql://meridian:meridian@localhost:5432/meridian";

const jar = new Map();
function extract(res) {
  const sc = res.headers.get("set-cookie");
  if (!sc) return;
  for (const seg of sc.split(/,(?=\s*[^;,=]+=[^;,=]+)/)) {
    const s = seg.trim(); const eq = s.indexOf("=");
    if (eq <= 0) continue;
    const n = s.slice(0, eq).trim(); const v = s.slice(eq + 1).split(";")[0].trim();
    if (v && v !== "deleted") jar.set(n, v);
  }
}
const H = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
async function api(path, opts = {}) {
  const r = await fetch(BASE + path, { ...opts, headers: { ...(opts.headers || {}), Cookie: H() } });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch {}
  return { status: r.status, j };
}

async function main() {
  // 登录
  await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "wrapup@test.com", password: "smoke123", nickname: "WrapUp" }) }).then(r => r.text());
  const cRes = await fetch(BASE + "/api/auth/csrf", { headers: { Cookie: H() } });
  const cj = await cRes.json(); extract(cRes);
  const lr = await fetch(BASE + "/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: H() }, body: new URLSearchParams({ csrfToken: cj.csrfToken, email: "wrapup@test.com", password: "smoke123" }), redirect: "manual" });
  extract(lr); // ← 关键：登录 302 响应带 session-token cookie
  const s = await api("/api/auth/session");
  if (!s.j?.user) { console.log("登录失败"); return; }
  console.log("登录:", s.j.user.email);

  // 造积累型任务
  const t = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "背单词", taskType: "planned", accumulate: true }) });
  const taskId = t.j.id;
  const session = s.j.user;
  console.log("积累任务:", taskId.slice(0, 8));

  // 查 userId
  const pg = new pgmod.Client({ connectionString: PG_URL });
  await pg.connect();
  const u = await pg.query(`SELECT id FROM users WHERE email='wrapup@test.com'`);
  const userId = u.rows[0].id;

  // 直接插入 checkin TimeLog：上月 2 + 当月 2（含重复日期验证去重）
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const dates = [
    new Date(y, m - 1, 20, 9, 0), new Date(y, m - 1, 25, 9, 0), // 上月
    new Date(y, m, 2, 9, 0), new Date(y, m, 5, 9, 0), new Date(y, m, 5, 10, 30), // 当月（5 日重复）
  ];
  for (const d of dates) {
    await pg.query(`INSERT INTO time_logs (id, "userId", "taskId", type, "startedAt", "durationSeconds", "createdAt") VALUES (gen_random_uuid(), $1, $2, 'checkin', $3, 1800, NOW())`, [userId, taskId, d.toISOString()]);
  }
  console.log("插入 TimeLog:", dates.length, "条");

  // 排期到今天（currentTask 判定：scheduledStart ≤ now ≤ scheduledEnd）——直接 pg 插入 schedule
  const start = new Date(Date.now() - 30 * 60000);
  const end = new Date(Date.now() + 60 * 60000);
  await pg.query(`INSERT INTO schedules (id, "userId", "taskId", "scheduledStart", "scheduledEnd", source, "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, 'user', NOW(), NOW())`, [userId, taskId, start.toISOString(), end.toISOString()]);
  console.log("排期插入:", start.toISOString(), "~", end.toISOString());

  // 读 views/today
  const today = await api("/api/views/today");
  const ct = today.j?.currentTask;
  if (!ct) { console.log("currentTask 为空"); await pg.end(); return; }
  console.log("\ncurrentTask:", ct.title);
  const md = ct.accumStats?.monthDates ?? null;
  console.log("accumStats.monthDates:", JSON.stringify(md));
  if (Array.isArray(md)) {
    const l = new Date();
    const monthPrefix = `${l.getFullYear()}-${String(l.getMonth() + 1).padStart(2, "0")}`;
    const allThisMonth = md.every(d => d.startsWith(monthPrefix));
    const sorted = md.every((d, i) => i === 0 || md[i - 1] < d);
    const unique = new Set(md).size === md.length;
    const hasPrev = md.length === 2;
    console.log(`\n✅ 只含当月(${monthPrefix}): ${allThisMonth} | 升序: ${sorted} | 去重: ${unique} | 当月 2 条: ${hasPrev}`);
    if (allThisMonth && sorted && unique && hasPrev) console.log("=== 冒烟通过 ✅ ===");
    else console.log("=== 冒烟失败 ❌ ===");
  } else {
    console.log("monthDates 缺失 ❌");
  }
  await pg.end();
}
main().catch(e => { console.error("ERR", e.message); process.exit(1); });
