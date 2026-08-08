// E2E UI debug 脚本（临时）：验证面板主题保存 + Projects 行结构
const { chromium } = require("@playwright/test");
const fs = require("fs");

(async () => {
  const state = JSON.parse(fs.readFileSync(".e2e/state/main.json", "utf-8"));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: state });
  const page = await ctx.newPage();
  const log = (m) => { fs.appendFileSync("e2e-results/debug-out.txt", m + "\n"); };

  // ── G3 面板主题 ──
  await page.goto("http://localhost:3000/today", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(1000);
  const si = page.locator("input[placeholder*='搜索'], input[type='search'], [class*='search'] input").first();
  const siVisible = await si.isVisible().catch(() => false);
  log("[G3] 搜索框可见:", siVisible);
  if (siVisible) {
    await si.fill("E2E改主题");
    await page.waitForTimeout(3000);
    const hits = await page.locator("text=E2E改主题").count();
    log("[G3] 搜索结果数:", hits);
    if (hits > 0) {
      await page.locator("text=E2E改主题").first().click();
      await page.waitForTimeout(2000);
      const themeBtn = page.locator("button").filter({ hasText: /^竞赛$/ });
      log("[G3] 主题按钮数:", await themeBtn.count());
      const saveBtn = page.locator("button").filter({ hasText: /保存修改/ });
      log("[G3] 保存修改按钮数:", await saveBtn.count(), "可见:", await saveBtn.first().isVisible().catch(() => false));
      if ((await themeBtn.count()) > 0) { await themeBtn.first().click(); await page.waitForTimeout(800); }
      if ((await saveBtn.count()) > 0) { await saveBtn.first().click(); await page.waitForTimeout(2000); }
      const res = await page.evaluate(async () => {
        const r = await fetch("/api/tasks");
        const list = await r.json();
        const hit = list.find((t) => t.title.includes("E2E改主题"));
        return hit ? hit.theme : "NOT_FOUND";
      });
      log("[G3] 保存后 theme =", res);
    }
  }

  // ── J2/J3 Projects 行结构 ──
  await page.goto("http://localhost:3000/projects", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(6000);
  await page.getByRole("button", { name: "＋ 新建项目" }).first().click();
  await page.waitForTimeout(500);
  const ni = page.getByPlaceholder("输入名称，回车创建（Esc 取消）");
  await ni.fill("E2E行调试项目");
  await ni.press("Enter");
  await page.waitForTimeout(2500);
  const rows = await page.locator(".pt-row").count();
  log("[J2] .pt-row 行数:", rows);
  const row = page.locator(".pt-row").filter({ hasText: "E2E行调试项目" }).first();
  log("[J2] 项目行存在:", await row.isVisible().catch(() => false));
  const addBtns = await row.locator('button[title="新建子项"]').count();
  log("[J2] 行内新建子项按钮数:", addBtns);
  const starSpan = await row.locator(".pt-star").count();
  log("[J3] 行内 .pt-star 数:", starSpan);
  // 点 ★ 看 API
  if (starSpan > 0) {
    await row.locator(".pt-star").click();
    await page.waitForTimeout(2000);
    const starRes = await page.evaluate(async () => {
      const r = await fetch("/api/tasks");
      const list = await r.json();
      const hit = list.find((t) => t.title.includes("E2E行调试项目"));
      return hit ? hit.star : "NOT_FOUND";
    });
    log("[J3] 点 ★ 后 star =", starRes);
  }
  await browser.close();
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
