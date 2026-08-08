/**
 * 全局前置：注册 + 登录测试用户，保存 storageState 供各模块复用。
 *
 * - 每次运行生成新用户（时间戳邮箱）→ 数据天然隔离，可重复运行
 * - 三个隔离用户（BUG-20260807-021 数据污染修复）：
 *   1. main（默认）：01-auth 外的通用模块（inbox/plan/review/projects/settings/search/account）
 *   2. today：04-today 模块专用——currentTask 逻辑对共享数据敏感（多个进行中任务
 *      会抢占 currentTask），独立用户保证确定性
 *   3. linkage：09-linkage 模块专用——联动场景同样依赖 currentTask/路线
 * - 凭据写入 .e2e/state/credentials.json
 */
import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const STATE_DIR = path.join(__dirname, "..", "..", ".e2e", "state");
const STATE_MAIN = path.join(STATE_DIR, "main.json");
const STATE_TODAY = path.join(STATE_DIR, "today.json");
const STATE_LINKAGE = path.join(STATE_DIR, "linkage.json");
const CRED_PATH = path.join(STATE_DIR, "credentials.json");

const E2E_PASSWORD = "E2ePassw0rd!";

async function registerAndLogin(browser: import("@playwright/test").Browser, email: string, nickname: string) {
  const page = await browser.newPage({ baseURL: BASE_URL });
  try {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("你的昵称").fill(nickname);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("至少 6 位").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "开始我的子午" }).click();
    await page.waitForURL("**/login", { timeout: 30_000 });

    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill(E2E_PASSWORD);
    await page.getByRole("button", { name: "进入子午" }).click();
    await page.waitForURL("**/today", { timeout: 30_000 });
    return page;
  } catch (err) {
    await page.close().catch(() => {});
    throw err;
  }
}

export default async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(STATE_DIR, { recursive: true });

  const ts = Date.now();
  const users = {
    main: { email: `e2e-main-${ts}@test.local`, nickname: "E2E主测试员" },
    today: { email: `e2e-today-${ts}@test.local`, nickname: "E2E今日测试员" },
    linkage: { email: `e2e-link-${ts}@test.local`, nickname: "E2E联动测试员" },
  };
  fs.writeFileSync(
    CRED_PATH,
    JSON.stringify({ ...users.main, password: E2E_PASSWORD }, null, 2),
    "utf-8",
  );

  const browser = await chromium.launch();
  try {
    // 主用户
    let page = await registerAndLogin(browser, users.main.email, users.main.nickname);
    await page.context().storageState({ path: STATE_MAIN });
    console.log(`[global-setup] 主测试用户就绪: ${users.main.email}`);
    await page.close();

    // Today 专用用户（currentTask 敏感）
    page = await registerAndLogin(browser, users.today.email, users.today.nickname);
    await page.context().storageState({ path: STATE_TODAY });
    console.log(`[global-setup] Today 隔离用户就绪: ${users.today.email}`);
    await page.close();

    // 联动专用用户（currentTask/路线敏感）
    page = await registerAndLogin(browser, users.linkage.email, users.linkage.nickname);
    await page.context().storageState({ path: STATE_LINKAGE });
    console.log(`[global-setup] 联动隔离用户就绪: ${users.linkage.email}`);
    await page.close();
  } catch (err) {
    console.error("[global-setup] 失败，请确认 dev server 与数据库正常:", err);
    throw err;
  } finally {
    await browser.close();
  }
}
