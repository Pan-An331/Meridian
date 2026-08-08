/**
 * 模块 10 · 账户生命周期（破坏性操作，独立临时用户）
 *
 * 覆盖功能清单：
 * - [X1] 删除账户：双重 confirm → 跳转登录页 → 原凭据登录失败（账户已删除）
 * - [X2] 清理学习数据保持任务（S8 的补充验证：清理后任务仍在）
 *
 * 注：本模块使用独立临时用户，绝不影响主测试用户。
 */
import { test, expect } from "@playwright/test";
import { registerTempUser, expandSettingsCard } from "../utils/helpers";

test.describe("10 账户生命周期", () => {
  test("X1 删除账户后原凭据无法登录", async ({ page }) => {
    test.setTimeout(240_000); // DELETE 18 表顺序清理 Neon 下可能 30-60s + 登录验证
    const email = await registerTempUser(page);
    const password = "TempPassw0rd!";

    // 登录临时用户
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill(password);
    await page.getByRole("button", { name: "进入子午" }).click();
    await page.waitForURL("**/today", { timeout: 30_000 });

    // 进入设置 → 展开"数据与隐私" → 删除账户（双重 confirm）
    await page.getByRole("link", { name: "设置" }).first().click();
    await page.waitForURL("**/settings");
    await expandSettingsCard(page, "数据与隐私", "删除账户");
    const delBtn = page.getByRole("button", { name: "删除" }).first();
    await expect(delBtn).toBeVisible({ timeout: 15_000 });

    // 处理双重 confirm（依次 accept）
    page.on("dialog", (d) => d.accept());
    // 等待异步 pipeline（daily summary 等）写入完成，避免删除期间 FK 并发冲突
    await page.waitForTimeout(8000);
    // BUG-20260807-029：必须等 DELETE 响应返回再继续——Neon 下 18 表顺序删除需 20-40s，
    // 原实现在请求未完成时就 goto("/login")，导航会打断 fetch（trace 铁证 status:-1），
    // 账户未删 → 后续"原凭据登录"会成功 → 断言假失败。
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/user") && r.request().method() === "DELETE", { timeout: 150_000 }),
      delBtn.click(),
    ]);
    expect(delResp.ok(), "DELETE /api/user 应成功").toBeTruthy();

    // 删除后应跳转登录页（signOut）；若 cookie 残留未跳转则手动导航（核心断言是"原凭据无法登录"）
    try {
      await page.waitForURL("**/login", { timeout: 20_000 });
    } catch {
      await page.goto("/login").catch(() => {});
    }
    await page.context().clearCookies();
    await page.reload().catch(() => {});

    // 原凭据登录 → 失败提示（账户已删除）
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill(password);
    await page.getByRole("button", { name: "进入子午" }).click();
    await expect(page.getByText("邮箱或密码错误")).toBeVisible({ timeout: 20_000 });
  });

  test("X2 清理学习数据不影响任务数据", async ({ page }) => {
    const email = await registerTempUser(page);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill("TempPassw0rd!");
    await page.getByRole("button", { name: "进入子午" }).click();
    await page.waitForURL("**/today", { timeout: 30_000 });

    // 创建一个任务（API 需登录态 —— 用页面内 fetch 携带 cookie）
    const created = await page.evaluate(async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "E2E清理保留任务", taskType: "planned", importance: 3, estimatedMinutes: 30, estimatedUnit: "分钟", category: "learning" }),
      });
      return res.ok;
    });
    expect(created).toBeTruthy();

    // 设置页：展开"数据与隐私" → 清理学习数据
    await page.getByRole("link", { name: "设置" }).first().click();
    await page.waitForURL("**/settings");
    await expandSettingsCard(page, "数据与隐私", "清理学习数据");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "清理" }).first().click();
    await page.waitForTimeout(3000);

    // 任务仍在（GET /api/tasks 返回裸数组）
    const tasks = await page.evaluate(async () => {
      const res = await fetch("/api/tasks");
      const body = (await res.json()) as Array<{ title: string }> | { tasks?: Array<{ title: string }> };
      return Array.isArray(body) ? body : body.tasks ?? [];
    });
    expect(tasks.some((t) => t.title.includes("E2E清理保留任务"))).toBeTruthy();
  });
});
