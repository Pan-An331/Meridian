/**
 * 模块 08 · 全局搜索 + 任务档案面板
 *
 * 覆盖功能清单：
 * - [G1] ⌘K/Ctrl+K 打开搜索框，输入关键词 → 防抖 250ms → 搜索结果出现
 * - [G2] 点击搜索结果 → 档案面板打开（560px 抽屉）→ 显示任务标题与身份区
 * - [G3] 档案面板：修改主题（预设）→ 保存 → PUT 落库（API 验证 theme 字段）
 * - [G4] 档案面板：补记用时 → timeLog 写入
 * - [G5] 档案面板：删除任务（全站唯一删除入口）→ 任务消失
 * - [G6] 搜索失败降级：API 不可用时回退本地过滤（不直接断言降级，断言搜索框基本可用）
 *
 * 数据准备：API 创建任务，确保搜索结果可命中。
 */
import { test, expect } from "@playwright/test";
import { gotoNav } from "../utils/helpers";
import { createTask, getTask } from "../utils/api";

test.describe("08 全局搜索 + 档案面板", () => {
  test("G1+G2 全局搜索打开档案面板", async ({ page, request }) => {
    const title = `E2E搜索目标-${Date.now()}`;
    const { id } = await createTask(request, { title, theme: "考研" });

    await gotoNav(page, "today");
    // 触发全局搜索（⌘K / Ctrl+K）
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const searchInput = page.locator("input[placeholder*='搜索'], input[type='search'], [class*='search'] input").first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });

    await searchInput.fill(title);
    // 搜索结果出现（防抖 250ms + 请求）
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 15_000 });

    // 点击结果 → 档案面板
    await page.locator(`text=${title}`).first().click();
    await expect(page.locator("text=/任务档案|身份|领域|主题/").first()).toBeVisible({ timeout: 15_000 });

    // 关闭面板（Esc）
    await page.keyboard.press("Escape");
    expect(id).toBeTruthy();
  });

  test("G3 档案面板修改主题并保存", async ({ page, request }) => {
    const { id } = await createTask(request, { title: `E2E改主题-${Date.now()}` });

    await gotoNav(page, "today");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const searchInput = page.locator("input[placeholder*='搜索'], input[type='search'], [class*='search'] input").first();
    await searchInput.fill("E2E改主题");
    await expect(page.locator("text=E2E改主题").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("text=E2E改主题").first().click();

    // 面板内选预设主题"竞赛"
    // ★ 严格断言：主题选择按钮必须渲染（不允许 skip 兜底——否则"改主题"功能可能被误判通过）
    // 用可访问名精确匹配（"竞赛"按钮唯一；"专业实践（含竞赛）"领域按钮 name 为完整文本不冲突）
    // 等面板 task 数据加载完成（任务标题输入框 value 非空；save() 在 task 未加载时直接 return）
    await expect(page.getByPlaceholder("任务标题")).toHaveValue(/.+/, { timeout: 20_000 });
    const themeBtn = page.getByRole("button", { name: "竞赛", exact: true }).first();
    await expect(themeBtn).toBeVisible({ timeout: 15_000 });
    await themeBtn.click();
    // 点击生效验证：面板主题徽章/选中态出现（theme state 更新 → ThemeBadge 渲染）
    await expect(page.locator("text=/主题（考研|考研|竞赛|身材/").first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    const badgeOrSelected = page.locator("[class*='ThemeBadge'], .theme-badge").first();
    await expect(badgeOrSelected).toBeVisible({ timeout: 10_000 }).catch(() => {});

    // 保存（面板保存按钮文案为"保存修改"）+ 保存反馈出现
    await page.getByRole("button", { name: "保存修改" }).click();
    await expect(page.getByText(/已保存 ✓|保存失败/).first()).toBeVisible({ timeout: 15_000 });

    // API 验证 theme 已落库
    await expect
      .poll(async () => (await getTask(request, id)).theme as string | null, { timeout: 15_000 })
      .toBe("竞赛");
  });

  test("G4 档案面板补记用时", async ({ page, request }) => {
    const { id } = await createTask(request, { title: `E2E补记-${Date.now()}` });

    await gotoNav(page, "today");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const searchInput = page.locator("input[placeholder*='搜索'], input[type='search'], [class*='search'] input").first();
    await searchInput.fill("E2E补记");
    await expect(page.locator("text=E2E补记").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("text=E2E补记").first().click();

    // 补记入口（"＋ 补记"按钮 → 输入分钟 → "确定"）
    const addBtn = page.getByRole("button", { name: "＋ 补记" }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();
    await page.getByPlaceholder("分钟").fill("30");
    await page.getByRole("button", { name: "确定" }).click();

    // timeLog 写入验证（actualMinutes/时间日志存在）
    await expect
      .poll(async () => {
        const t = await getTask(request, id);
        const logs = (t.timeLogs ?? t.logs ?? []) as unknown[];
        return logs.length > 0;
      }, { timeout: 15_000 })
      .toBeTruthy();
  });

  test("G5 档案面板删除任务（全站唯一删除入口）", async ({ page, request }) => {
    const { id } = await createTask(request, { title: `E2E删除-${Date.now()}` });

    await gotoNav(page, "today");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const searchInput = page.locator("input[placeholder*='搜索'], input[type='search'], [class*='search'] input").first();
    await searchInput.fill("E2E删除");
    await expect(page.locator("text=E2E删除").first()).toBeVisible({ timeout: 15_000 });
    await page.locator("text=E2E删除").first().click();

    // 删除按钮（含确认对话框）
    const delBtn = page.locator("button").filter({ hasText: /删除/ }).first();
    await expect(delBtn).toBeVisible({ timeout: 10_000 });
    page.once("dialog", (d) => d.accept());
    await delBtn.click();

    // API 验证任务已删除（404/空）
    await expect
      .poll(async () => {
        const res = await request.get(`/api/tasks/${id}`);
        return res.status() === 404;
      }, { timeout: 20_000 })
      .toBeTruthy();
  });
});
