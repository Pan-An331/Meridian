const { createRequire } = require("node:module");
const req = createRequire(process.cwd() + "/");
const pgmod = req("G:\\Agent_Project\\task-manage-sys\\.pg-local\\pgmods\\node_modules\\pg");
(async () => {
  const pg = new pgmod.Client({ connectionString: "postgresql://meridian:meridian@localhost:5432/meridian" });
  await pg.connect();
  const r = await pg.query(`SELECT s.id, s."scheduledStart", s."scheduledEnd", t.title, t.status FROM schedules s JOIN tasks t ON t.id = s."taskId" WHERE t."userId" IN (SELECT id FROM users WHERE email='wrapup@test.com')`);
  console.log("schedules:", JSON.stringify(r.rows, null, 1));
  const t = await pg.query(`SELECT title, status, "taskType" FROM tasks WHERE "userId" IN (SELECT id FROM users WHERE email='wrapup@test.com')`);
  console.log("tasks:", JSON.stringify(t.rows));
  await pg.end();
})();
