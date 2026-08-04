/* 完整登录冒烟 v2：手动跟随重定向收集每一步 set-cookie */
const BASE = "http://localhost:3000";

async function fetchFollow(url, opts = {}) {
  let currentUrl = url;
  let method = opts.method || "GET";
  let headers = { ...(opts.headers || {}) };
  let body = opts.body;
  let jar = opts.jar || new Map();

  const extract = (res) => {
    const sc = res.headers.get("set-cookie");
    if (!sc) return;
    for (const seg of sc.split(/,(?=\s*[^;,=]+=[^;,=]+)/)) {
      const s = seg.trim();
      const eq = s.indexOf("=");
      if (eq <= 0) continue;
      const name = s.slice(0, eq).trim();
      const val = s.slice(eq + 1).split(";")[0].trim();
      if (val && val !== "deleted") jar.set(name, val);
    }
  };
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  let res = await fetch(currentUrl, {
    method, headers: { ...headers, Cookie: cookieHeader() }, body, redirect: "manual",
  });
  extract(res);
  let depth = 0;
  while (res.status >= 300 && res.status < 400 && res.headers.get("location") && depth < 8) {
    const loc = res.headers.get("location");
    currentUrl = new URL(loc, BASE).toString();
    res = await fetch(currentUrl, { method: "GET", headers: { Cookie: cookieHeader() }, redirect: "manual" });
    extract(res);
    depth++;
  }
  return { res, jar, cookieHeader: () => cookieHeader() };
}

async function main() {
  // 1. CSRF
  const c1 = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await c1.json();
  const jar = new Map();
  const extract = (res) => {
    const sc = res.headers.get("set-cookie");
    if (!sc) return;
    for (const seg of sc.split(/,(?=\s*[^;,=]+=[^;,=]+)/)) {
      const s = seg.trim(); const eq = s.indexOf("=");
      if (eq <= 0) continue;
      const name = s.slice(0, eq).trim(); const val = s.slice(eq + 1).split(";")[0].trim();
      if (val && val !== "deleted") jar.set(name, val);
    }
  };
  extract(c1);
  console.log("after csrf cookies:", [...jar.keys()].join(","));

  // 2. 登录 + 跟随重定向
  const r2 = await fetchFollow(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: "pgmigrate@test.com", password: "smoke123" }),
    jar,
  });
  console.log("login final:", r2.res.status, "| cookies:", [...r2.jar.keys()].join(","));

  // 3. session
  const r3 = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: r2.cookieHeader() } });
  const sess = await r3.json();
  console.log("session user:", sess?.user?.email ?? "NULL");

  if (!sess?.user) return;

  // 4. 页面 + API
  for (const p of ["/today", "/plan", "/review", "/inbox"]) {
    const r = await fetch(`${BASE}${p}`, { headers: { Cookie: r2.cookieHeader() }, redirect: "manual" });
    console.log(`  ${p}: ${r.status}`);
  }
  for (const a of ["/api/views/today", "/api/views/stats"]) {
    const r = await fetch(`${BASE}${a}`, { headers: { Cookie: r2.cookieHeader() } });
    const txt = await r.text();
    console.log(`  ${a}: ${r.status} | ${txt.slice(0, 80)}`);
  }
}
main().catch(e => { console.error("ERR", e.message); process.exit(1); });
