/**
 * 模块 01 · 认证（登录/注册/路由守卫）
 *
 * 覆盖功能清单：
 * - [A1] 未登录访问 Dashboard 路由 → 重定向 /login（鉴权闸门）
 * - [A2] 注册页：表单提交 → 创建用户 → 跳转登录页
 * - [A3] 登录页：正确凭据 → 跳转 /today（默认落地页）
 * - [A4] 登录页：错误密码 → 错误提示"邮箱或密码错误"
 * - [A5] 登录后：根路径 / → 重定向 /today；侧栏展示工作流 5 导航项
 * - [A6] 退出登录 → 回到登录页，再访问受保护路由被重定向
 *
 * 注：本模块使用独立临时用户（storageState 置空），不依赖主测试用户。
 */
import { test, expect } from "@playwright/test";

// 本模块全部用例使用"未登录"状态
test.use({ storageState: { cookies: [], origins: [] } });

const PASSWORD = "AuthPassw0rd!";

test.describe("01 认证模块", () => {
  test("A1 未登录访问 /plan 被重定向到 /login", async ({ page }) => {
    await page.goto("/plan");
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("A2 注册新用户成功并跳转登录页", async ({ page }) => {
    const email = `e2e-auth-${Date.now()}@test.local`;
    await page.goto("/register");
    await page.getByPlaceholder("你的昵称").fill("认证测试员");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("至少 6 位").fill(PASSWORD);
    await page.getByRole("button", { name: "开始我的子午" }).click();
    await page.waitForURL("**/login", { timeout: 30_000 });
    // 登录页出现"进入子午"按钮 = 注册成功已跳转
    await expect(page.getByRole("button", { name: "进入子午" })).toBeVisible();
  });

  test("A3 正确凭据登录成功，落地 /today", async ({ page }) => {
    // 先注册
    const email = `e2e-auth2-${Date.now()}@test.local`;
    await page.goto("/register");
    await page.getByPlaceholder("你的昵称").fill("认证测试员2");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("至少 6 位").fill(PASSWORD);
    await page.getByRole("button", { name: "开始我的子午" }).click();
    await page.waitForURL("**/login");
    // 再登录
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill(PASSWORD);
    await page.getByRole("button", { name: "进入子午" }).click();
    await page.waitForURL("**/today", { timeout: 30_000 });
    await expect(page).toHaveURL(/\/today/);
  });

  test("A4 错误密码登录显示错误提示", async ({ page }) => {
    const email = `e2e-auth3-${Date.now()}@test.local`;
    await page.goto("/register");
    await page.getByPlaceholder("你的昵称").fill("认证测试员3");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("至少 6 位").fill(PASSWORD);
    await page.getByRole("button", { name: "开始我的子午" }).click();
    await page.waitForURL("**/login");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill("WrongPass123!");
    await page.getByRole("button", { name: "进入子午" }).click();
    await expect(page.getByText("邮箱或密码错误")).toBeVisible({ timeout: 15_000 });
  });

  test("A5 登录后根路径重定向 Today，侧栏含工作流 5 导航", async ({ page }) => {
    const email = `e2e-auth4-${Date.now()}@test.local`;
    await page.goto("/register");
    await page.getByPlaceholder("你的昵称").fill("认证测试员4");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("至少 6 位").fill(PASSWORD);
    await page.getByRole("button", { name: "开始我的子午" }).click();
    await page.waitForURL("**/login");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill(PASSWORD);
    await page.getByRole("button", { name: "进入子午" }).click();
    await page.waitForURL("**/today");

    await page.goto("/");
    await page.waitForURL("**/today");

    // 侧栏 5 导航项（工作流链）
    for (const label of ["收纳", "蓝图", "此刻", "复盘", "项目"]) {
      await expect(page.getByRole("link", { name: label }).first()).toBeVisible();
    }
    // 设置入口
    await expect(page.getByRole("link", { name: "设置" }).first()).toBeVisible();
  });

  test("A6 退出登录后回到登录页，受保护路由被重定向", async ({ page }) => {
    // 注册并登录
    const email = `e2e-auth5-${Date.now()}@test.local`;
    await page.goto("/register");
    await page.getByPlaceholder("你的昵称").fill("认证测试员5");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("至少 6 位").fill(PASSWORD);
    await page.getByRole("button", { name: "开始我的子午" }).click();
    await page.waitForURL("**/login");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill(PASSWORD);
    await page.getByRole("button", { name: "进入子午" }).click();
    await page.waitForURL("**/today");

    // 侧栏底部"退出"按钮
    await page.getByRole("button", { name: /退出/ }).first().click();
    await page.waitForURL("**/login", { timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);

    // 再次访问受保护页 → 重定向登录
    await page.goto("/today");
    await page.waitForURL("**/login");
  });
});
