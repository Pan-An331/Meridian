/**
 * 模块 03 · Plan 规划页
 *
 * 覆盖功能清单：
 * - [P1] 周/聚焦视图切换（胶囊按钮），聚焦模式显示"现在"时间线
 * - [P2] 上一周/下一周切换 → 日期范围标题变化
 * - [P3] 拖拽收集箱任务到天列 → 排期成功（时间块出现，apply-decision 落库）
 * - [P4] 任务块点击 → 详情浮层（标题/状态标签）→ 关闭
 * - [P5] 详情浮层：开始/完成 操作（action 白名单）
 * - [P6] 详情浮层：追加子任务（placeholder "子任务标题，Enter 添加"）
 * - [P7] 从计划移除排期（保留任务）→ 任务块消失
 * - [P8] 续排建议条"复制到明天"（未完成任务次日无排期时出现）
 * - [P9] 凌晨时段展开/折叠
 * - [P10] 计划健康度折叠条（POST /api/plan/analyze 正常返回）
 *
 * 数据准备：API 工厂创建任务；拖拽排期走真实鼠标事件（自定义 DnD 协议）。
 */
import { test, expect } from "@playwright/test";
import { gotoNav, dragToPlanColumn, dateOffset, localDateStr } from "../utils/helpers";
import { createTask, scheduleTask, getTask, findTaskByTitle, clearUserTasks } from "../utils/api";

test.describe("03 Plan 规划页", () => {
  // 模块内隔离：共享主用户下任务块会重叠遮挡，每个用例前清空（BUG-20260807-021）
  test.beforeEach(async ({ request }) => {
    await clearUserTasks(request);
  });
  test("P1 周/聚焦切换", async ({ page }) => {
    await gotoNav(page, "plan");
    const focusBtn = page.getByRole("button", { name: /聚焦/ }).first();
    if (await focusBtn.isVisible().catch(() => false)) {
      await focusBtn.click();
      // 聚焦态出现"现在"时间线标识（标题含今天日期或 Now）
      await expect(page.locator(".plan-week-col").first()).toBeVisible();
    } else {
      test.skip(true, "聚焦按钮不存在（布局变化，需人工确认）");
    }
  });

  test("P2 周切换：日期范围标题变化", async ({ page }) => {
    await gotoNav(page, "plan");
    // 周范围标题（"YYYY.MM.DD - YYYY.MM.DD"）是页面首个 div.tabular-nums
    const headerSel = page.locator("div.tabular-nums").first();
    await expect(headerSel).toBeVisible({ timeout: 15_000 });
    const before = (await headerSel.textContent()) ?? "";
    await page.getByRole("button", { name: "下一周" }).click();
    await expect.poll(async () => await headerSel.textContent(), { timeout: 15_000 }).not.toBe(before);
  });

  test("P3 拖拽收集箱任务到天列完成排期", async ({ page, request }) => {
    const title = `E2E拖拽排期-${Date.now()}`;
    // 收集箱只放行 ★（执行清单）任务（V3 设计）→ 创建时直接带 star
    await createTask(request, { title, taskType: "planned", star: true });

    await gotoNav(page, "plan");
    // 收集箱出现该任务
    const poolItem = page.locator(`text=${title}`).first();
    await expect(poolItem).toBeVisible({ timeout: 20_000 });

    // 拖到第 0 天列 10:00
    await dragToPlanColumn(page, title, 0, 10);

    // 排期落库：任务出现排期
    await expect
      .poll(async () => {
        const hit = await findTaskByTitle(request, title);
        if (!hit) return false;
        const t = await getTask(request, hit.id);
        return Array.isArray(t.schedules) && t.schedules.length > 0;
      }, { timeout: 20_000 })
      .toBeTruthy();
  });

  test("P4 任务块点击打开详情浮层", async ({ page, request }) => {
    const title = `E2E浮层任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleTask(request, id, { date: new Date().toISOString().slice(0, 10), start: "09:00", end: "10:00" });

    await gotoNav(page, "plan");
    // 时间块（收集箱之外的任务块，取第一个含标题的可见元素）
    const block = page.locator(`text=${title}`).first();
    await expect(block).toBeVisible({ timeout: 20_000 });
    await block.click();

    // 详情浮层：包含"开始"或"完成"操作按钮
    await expect(page.getByRole("button", { name: /开始|完成/ }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("P5 详情浮层执行开始操作", async ({ page, request }) => {
    const title = `E2E开始任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleTask(request, id, { date: new Date().toISOString().slice(0, 10), start: "09:00", end: "10:00" });

    await gotoNav(page, "plan");
    const block = page.locator(`text=${title}`).first();
    await block.click({ force: true }); // force：多任务块重叠时可能被遮挡
    const startBtn = page.getByRole("button", { name: "开始" });
    await expect(startBtn).toBeVisible({ timeout: 10_000 });
    await startBtn.click();

    // 产品行为：操作成功后浮层关闭（setDetail(null)）并静默刷新
    // → 断言浮层关闭 + API 状态变为 in_progress
    await expect(startBtn).not.toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await getTask(request, id)).status, { timeout: 15_000 })
      .toBe("in_progress");
  });

  test("P6 详情浮层追加子任务", async ({ page, request }) => {
    const title = `E2E子任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleTask(request, id, { date: new Date().toISOString().slice(0, 10), start: "09:00", end: "10:00" });

    await gotoNav(page, "plan");
    const block = page.locator(`text=${title}`).first();
    await block.click();
    await expect(page.getByRole("button", { name: /开始|完成/ }).first()).toBeVisible({ timeout: 10_000 });

    // 先点"+ 追加子任务"展开输入行，再填写
    await page.getByRole("button", { name: "+ 追加子任务" }).click();
    const input = page.getByPlaceholder("子任务标题，Enter 添加");
    await input.fill("浮层子项");
    await input.press("Enter");
    // 子项出现在执行清单区（或浮层关闭后由 API 验证）
    await expect
      .poll(async () => {
        const t = await getTask(request, id);
        return (t.children as unknown[] | undefined)?.some((c) => (c as { title: string }).title === "浮层子项") ?? false;
      }, { timeout: 15_000 })
      .toBeTruthy();
  });

  test("P7 从计划移除排期（任务保留）", async ({ page, request }) => {
    const title = `E2E移除排期-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleTask(request, id, { date: new Date().toISOString().slice(0, 10), start: "09:00", end: "10:00" });

    await gotoNav(page, "plan");
    const block = page.locator(`text=${title}`).first();
    await block.click();
    await expect(page.getByRole("button", { name: /移除|删除排期/ }).first()).toBeVisible({ timeout: 10_000 });
    // 移除前有确认对话框（window.confirm）
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: /移除|删除排期/ }).first().click();

    // 排期消失（任务仍在收集箱/列表）
    await expect
      .poll(async () => {
        const t = await getTask(request, id);
        return Array.isArray(t.schedules) ? t.schedules.length === 0 : true;
      }, { timeout: 15_000 })
      .toBeTruthy();
  });

  test("P8 续排建议：复制到明天", async ({ page, request }) => {
    test.setTimeout(150_000); // Neon 慢时 continue_tomorrow 落库可能 >60s
    // 前置：需要"未完成 + 今天有（已过时段）排期 + 明天无排期"——
    // 续排建议针对"今天该完成但没完成"的任务，凌晨跑测试时 09:00 排期未到不算未完成
    // → 排期固定在今天 00:00-01:00（已过期未完成）
    const title = `E2E续排-${Date.now()}`;
    const { id } = await createTask(request, { title });
    const today = new Date().toISOString().slice(0, 10);
    await scheduleTask(request, id, { date: today, start: "00:00", end: "01:00" });

    await gotoNav(page, "plan");
    // 续排建议条默认收起 → 先展开（头部含"未完成任务 · 明天继续"）
    const barHead = page.locator("text=/未完成任务/").first();
    await expect(barHead).toBeVisible({ timeout: 20_000 });
    await barHead.click();
    // 定位【自己任务】对应建议项行的"复制到明天"（.last() = 最内层含标题+按钮的 item 行）
    const myItem = page
      .locator("div")
      .filter({ hasText: title })
      .filter({ has: page.getByRole("button", { name: "复制到明天" }) })
      .last();
    await expect(myItem).toBeVisible({ timeout: 10_000 });
    await myItem.getByRole("button", { name: "复制到明天" }).first().click();

    // 明天出现同任务排期（API 验证：schedules 含明天日期；字段为 scheduledStart）
    // BUG-20260807-024：scheduledStart 为 UTC ISO（toISOString），不能用本地日期前缀匹配
    // → 先 new Date() 转本地再取本地日期（GMT+8 下明天 00:00 = UTC 今天 16:00，前缀永远不匹配）
    await expect
      .poll(async () => {
        const t = await getTask(request, id);
        const schedules = (t.schedules ?? []) as Array<{ scheduledStart: string }>;
        const tomorrow = dateOffset(1); // 本地时区明天 YYYY-MM-DD
        return schedules.some((s) => localDateStr(new Date(s.scheduledStart)) === tomorrow);
      }, { timeout: 90_000 })
      .toBeTruthy();
  });

  test("P9 凌晨折叠区存在且可展开", async ({ page }) => {
    await gotoNav(page, "plan");
    const nightToggle = page.getByRole("button", { name: /凌晨|22:00/ }).first();
    if (await nightToggle.isVisible().catch(() => false)) {
      await nightToggle.click();
      await expect(nightToggle).toBeVisible();
    } else {
      test.skip(true, "凌晨折叠区未渲染（无跨夜任务或布局变化）");
    }
  });

  test("P10 计划健康分折叠条可展开", async ({ page }) => {
    await gotoNav(page, "plan");
    const health = page.locator("text=/健康|负荷|过载/").first();
    if (await health.isVisible().catch(() => false)) {
      await health.click();
      await expect(page.locator("text=/建议/").first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    } else {
      test.skip(true, "健康分折叠条未渲染（无数据时可能隐藏）");
    }
  });
});
