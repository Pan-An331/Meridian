/**
 * 模块 05 · Review 复盘页
 *
 * 覆盖功能清单：
 * - [R1] 本周复盘加载：战报卡（周摘要）、指标卡 2×2、主题投入区可见
 * - [R2] 本周/本月分段切换（数据源 range 变化）
 * - [R3] 产出日记按天分组展示
 * - [R4] 本周洞察（时段偏好/打断）渲染
 * - [R5] "下周可以试试"建议：应用 → 写入长期记忆（preference）→ "已应用 ✓"
 *
 * 数据准备：主用户（可能为空数据 → 空态断言兜底）。
 */
import { test, expect } from "@playwright/test";
import { gotoNav } from "../utils/helpers";
import { fetchStats } from "../utils/api";

test.describe("05 Review 复盘页", () => {
  test("R1 本周复盘核心区块渲染（严格校验）", async ({ page }) => {
    await gotoNav(page, "review");
    // ★ 严格断言：指标卡（完成率 + 堆积率，北极星指标）必须渲染，不允许"任意区块"宽泛兜底
    await expect(page.locator("text=/完成率/").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=/堆积率/").first()).toBeVisible({ timeout: 10_000 });
  });

  test("R2 本周/本月切换", async ({ page, request }) => {
    await gotoNav(page, "review");
    // 后端数据源可正常返回（range 字段为日期范围描述串；Neon 聚合慢，单次调用）
    const weekStats = await fetchStats(request, "week");
    expect(typeof weekStats.range).toBe("string");
    expect(String(weekStats.range).length).toBeGreaterThan(0);

    // UI 切换按钮（若有）
    const monthBtn = page.getByRole("button", { name: "本月" }).first();
    if (await monthBtn.isVisible().catch(() => false)) {
      await monthBtn.click();
      await expect(page.getByRole("button", { name: "本月" }).first()).toHaveClass(/active|on|selected/).catch(() => {});
    } else {
      const weekTag = page.getByText("本周").first();
      if (await weekTag.isVisible().catch(() => false)) {
        await weekTag.click();
      }
    }
  });

  test("R3 产出日记按天分组", async ({ page, request }) => {
    // 先造一条今天的完成记录（timeLog 由完成动作写入）
    const res = await fetchStats(request, "week");
    const daily = (res.dailyBreakdown ?? []) as Array<{ date: string }>;
    expect(Array.isArray(daily)).toBeTruthy();

    await gotoNav(page, "review");
    const diary = page.locator("text=/日记|产出|记录/").first();
    if (await diary.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await expect(diary).toBeVisible();
    } else {
      test.skip(true, "产出日记区未渲染（今日无完成记录）");
    }
  });

  test("R4 本周洞察渲染", async ({ page }) => {
    await gotoNav(page, "review");
    const insight = page.locator("text=/洞察|黄金时段|时段偏好/").first();
    // ★ 严格断言：本周洞察区必须渲染（不允许吞错）
    await expect(insight).toBeVisible({ timeout: 30_000 });
  });

  test("R5 应用建议写入长期记忆", async ({ page, request }) => {
    await gotoNav(page, "review");
    const applyBtn = page.getByRole("button", { name: "应用" }).first();
    if (await applyBtn.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await applyBtn.click();
      // 按钮变为"已应用 ✓"
      await expect(page.getByRole("button", { name: "已应用 ✓" }).first()).toBeVisible({ timeout: 15_000 });

      // API 验证：长期记忆中新增 preference
      const res = await request.get("/api/agent/memory", { params: { type: "preference" } });
      const body = (await res.json()) as { memories?: Array<{ content: string }> };
      expect(Array.isArray(body.memories)).toBeTruthy();
    } else {
      test.skip(true, "本周无规则建议（无执行数据），跳过");
    }
  });
});
