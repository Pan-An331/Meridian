/* Project 页优化 API 冒烟：themeColor / suggestion / doneCount / star PUT */
const BASE = "http://localhost:3000";
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
  // 注册（已存在则忽略）+ 登录
  const reg = await fetch(BASE + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "pjopt@test.com", password: "smoke123", nickname: "PJ" }) });
  await reg.text();
  const cRes = await fetch(BASE + "/api/auth/csrf", { headers: { Cookie: H() } });
  const cj = await cRes.json(); extract(cRes);
  if (!cj?.csrfToken) { console.log("CSRF 获取失败:", cRes.status, JSON.stringify(cj)); return; }
  const lr = await fetch(BASE + "/api/auth/callback/credentials", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: H() }, body: new URLSearchParams({ csrfToken: cj.csrfToken, email: "pjopt@test.com", password: "smoke123" }), redirect: "manual" });
  extract(lr);
  const s = await api("/api/auth/session");
  if (!s.j?.user) { console.log("登录失败:", s.status); return; }
  console.log("登录:", s.j.user.email);

  // 建 project（无 theme，子任务带 theme）
  const p1 = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "四轴飞行器", taskType: "planned", level: "project" }) });
  const p1id = p1.j.id;
  const p2 = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "考研复习", taskType: "planned", level: "project", theme: "考研" }) });
  const p2id = p2.j.id;

  // 子任务：p1 下 2 个 theme=竞赛 + 1 个完成；p2 下 1 个
  const c1 = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "原理图设计", taskType: "planned", level: "phase", parentId: p1id, theme: "竞赛" }) });
  const c1id = c1.j.id;
  await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "PCB 布线", taskType: "planned", parentId: c1id, theme: "竞赛" }) });
  const c2 = await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "画原理图", taskType: "planned", parentId: c1id, theme: "竞赛" }) });
  await api(`/api/tasks/${c2.j.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) });
  await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "高数刷题", taskType: "planned", parentId: p2id, theme: "考研" }) });

  // 孤儿：标题含"四轴飞行器" → 应建议 p1；无主题无关键词 → null
  await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "四轴飞行器外壳选型", taskType: "planned" }) });
  await api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "买菜", taskType: "planned" }) });

  // ★ 持久化测试
  const star1 = await api(`/api/tasks/${p1id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ star: true }) });
  const starRead = await api(`/api/tasks/${p1id}`);
  console.log("★ PUT star=true →", star1.status, "| 读取 star =", starRead.j.star);

  // 树接口验证
  const tree = await api("/api/projects/tree");
  const t = tree.j;
  console.log("\n=== trees ===");
  const walk = (n, depth) => {
    const pad = "  ".repeat(depth);
    console.log(`${pad}${n.title} [${n.level}] star=${n.star} done=${n.doneCount}/${n.totalCount} theme=${n.theme ?? "-"} color=${n.themeColor ? `${n.themeColor.pcolor}/${n.themeColor.theme ?? "领域"}` : "null"}`);
    n.children.forEach(c => walk(c, depth + 1));
  };
  t.trees.forEach(r => walk(r, 0));
  console.log("\n=== orphans suggestion ===");
  t.orphans.forEach(o => console.log(`  ${o.title} → ${o.suggestion ? JSON.stringify(o.suggestion) : "null"}`));

  // 清理冒烟数据
  await api(`/api/tasks/${p2id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) });
  for (const o of t.orphans) await api(`/api/tasks/${o.id}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete" }) });
  console.log("\n冒烟数据已清理");
}
main().catch(e => { console.error("ERR", e.message); process.exit(1); });
