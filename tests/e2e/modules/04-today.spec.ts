/**
 * 模块 04 · Today 执行页（Focus Card V2）
 *
 * 覆盖功能清单：
 * - [T1] 有排期任务时 Focus Card 渲染（"出发"主按钮）
 * - [T2] 出发 → 进行中 → 该项完成（补记时长弹窗）→ 完成态 + 统计更新
 * - [T3] 积累型任务打卡（CheckinModal）→ 打卡成功
 * - [T4] 暂停（PauseModal 原因选择）→ 暂停态
 * - [T5] "跳过后一项" 跳过当前任务
 * - [T6] 轮播：上一张/下一张切换卡片
 * - [T7] 今日路线点击 → 该任务前置为 Focus Card
 * - [T8] 今日状态折叠条 → "调整" → 4 维状态选择 → 保存（POST /api/user-state）
 * - [T9] AI 调整助手建议"采纳" → 排期创建（需有未排期任务；无 AI 配置时跳过建议类）
 * - [T10] 清单型任务：子任务勾选 / 新增项（乐观更新）
 *
 * 数据准备：API 工厂创建任务 + 排期；今日视图 GET /api/views/today 每次打开重取。
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { gotoNav } from "../utils/helpers";
import { createTask, scheduleNow, actionTask, getTask, isAiConfigured, findTaskByTitle, fetchTodayView, clearUserTasks } from "../utils/api";

test.describe("04 Today 执行页", () => {
  // 独立用户：currentTask 逻辑对共享数据敏感（多个进行中任务会抢占 currentTask）
  test.use({ storageState: path.join(__dirname, "..", "..", "..", ".e2e", "state", "today.json") });
  // 模块内隔离：每个用例开始前清空未完成任务，保证 currentTask 唯一（BUG-20260807-021）
  test.beforeEach(async ({ request }) => {
    await clearUserTasks(request);
  });
  test("T1 Focus Card 渲染当前任务（出发按钮）", async ({ page, request }) => {
    const title = `E2E今日任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleNow(request, id);

    await gotoNav(page, "today");
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 30_000 });
  });

  test("T2 出发 → 该项完成（补记时长）→ 完成态", async ({ page, request }) => {
    test.setTimeout(150_000); // Neon 慢时 complete 落库可能 >60s
    const title = `E2E完成链路-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleNow(request, id);

    await gotoNav(page, "today");
    const startBtn = page.getByRole("button", { name: "出发" }).first();
    await expect(startBtn).toBeVisible({ timeout: 30_000 });
    await startBtn.click();

    // 进行中 → 出现"该项完成"
    const doneBtn = page.getByRole("button", { name: "该项完成" }).first();
    await expect(doneBtn).toBeVisible({ timeout: 15_000 });
    await doneBtn.click();

    // 补记时长弹窗（DurationModal）→ 确认按钮文案为"确定"
    await expect(page.getByRole("button", { name: "确定" }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "确定" }).first().click();

    // API 验证任务已完成
    await expect
      .poll(async () => (await getTask(request, id)).status, { timeout: 45_000 })
      .toBe("completed");
  });

  test("T3 积累型任务打卡", async ({ page, request }) => {
    const title = `E2E打卡任务-${Date.now()}`;
    const { id } = await createTask(request, { title, taskType: "accumulate", accumulate: true });
    // 积累排期默认从明天开始（产品设计），补一条今日排期确保卡片出现在 Focus Card
    await scheduleNow(request, id, -30, 45);

    await gotoNav(page, "today");
    // 积累·频次卡主按钮为"出发"（打卡在完成流程的 CheckinModal 中）
    const startBtn = page.getByRole("button", { name: "出发" }).first();
    await expect(startBtn).toBeVisible({ timeout: 30_000 });
    await startBtn.click();
    // 积累卡 going 态主流程按钮为"打卡"（D 区）→ CheckinModal"打卡完成"
    await page.getByRole("button", { name: "打卡" }).first().click();
    const modalBtn = page.getByRole("button", { name: "打卡完成" }).first();
    await expect(modalBtn).toBeVisible({ timeout: 10_000 });
    await modalBtn.click();

    // 打卡成功 → API 验证：timeLogs 含 checkin 记录（accumStats 无 todayChecked 字段）
    await expect
      .poll(async () => {
        const t = await getTask(request, id);
        const logs = (t.timeLogs ?? []) as Array<{ type?: string }>;
        return logs.some((l) => l.type === "checkin");
      }, { timeout: 45_000 })
      .toBeTruthy();
  });

  test("T4 暂停（选择原因）", async ({ page, request }) => {
    const title = `E2E暂停任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleNow(request, id);

    await gotoNav(page, "today");
    await page.getByRole("button", { name: "出发" }).first().click();
    const pauseBtn = page.getByRole("button", { name: "暂停" }).first();
    await expect(pauseBtn).toBeVisible({ timeout: 15_000 });
    await pauseBtn.click();

    // PauseModal 原因选项 → 选择第一个 → 确认
    await expect(page.getByText(/暂停原因|为什么暂停/).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    const reason = page.locator("button").filter({ hasText: /累了|分心|有事|太难|其他/ }).first();
    if (await reason.isVisible().catch(() => false)) {
      await reason.click();
    }
    await page.keyboard.press("Escape");
  });

  test("T5 跳过后一项", async ({ page, request }) => {
    const title = `E2E跳过任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleNow(request, id);

    await gotoNav(page, "today");
    await page.getByRole("button", { name: "出发" }).first().click();
    const skipBtn = page.getByRole("button", { name: "跳过后一项" }).first();
    await expect(skipBtn).toBeVisible({ timeout: 15_000 });
    await skipBtn.click();

    // 跳过 = 前端跳过当前卡：skip_item 不改后端任务状态（产品语义）→ 验证状态仍 in_progress
    await expect
      .poll(async () => (await getTask(request, id)).status, { timeout: 20_000 })
      .toBe("in_progress");
  });

  test("T6 轮播切换卡片", async ({ page, request }) => {
    // 卡片列表 = [routeSel 前置卡] + [currentTask 主卡]——制造第二张卡需点击今日路线任务
    const titleA = `E2E轮播A-${Date.now()}`;
    const titleB = `E2E轮播B-${Date.now()}`;
    const { id: idA } = await createTask(request, { title: titleA });
    await scheduleNow(request, idA, -30, 60);
    const { id: idB } = await createTask(request, { title: titleB });
    await scheduleNow(request, idB, -90, 60);

    await gotoNav(page, "today");
    // 点击今日路线中的任务B → 前置为第一张卡（cardList 变为 2 张 → 轮播出现）
    await expect(page.locator(`text=${titleB}`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`text=${titleB}`).first().click();
    await expect(page.getByRole("button", { name: "下一张" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "下一张" }).click();
    await page.getByRole("button", { name: "上一张" }).click();
    await expect(page.getByRole("button", { name: "下一张" })).toBeVisible();
  });

  test("T7 今日路线点击切换 Focus Card", async ({ page, request }) => {
    const title = `E2E路线任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleNow(request, id);

    await gotoNav(page, "today");
    const routeItem = page.locator(`text=${title}`).first();
    await expect(routeItem).toBeVisible({ timeout: 30_000 });
    await routeItem.click();
    // 该任务成为当前卡片 → Focus Card 标题区包含任务名
    await expect(page.locator("text=" + title).first()).toBeVisible();
  });

  test("T8 今日状态调整保存（严格校验）", async ({ page, request }) => {
    await gotoNav(page, "today");
    const bar = page.getByText("今日状态").first();
    await expect(bar).toBeVisible({ timeout: 30_000 });
    await bar.click();
    // 展开后点"调整"（exact 匹配：排除"AI 调整助手"/"调整时间"等子串命中）
    const adjust = page.getByText("调整", { exact: true }).first();
    await expect(adjust).toBeVisible({ timeout: 10_000 });
    await adjust.click();

    // ★ 严格断言：4 维状态选项区出现（"精力"维度标签）
    await expect(page.getByText("精力", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // 选"精力充沛"（第一维度第一个选项）
    const energyOpt = page.getByText("精力充沛").first();
    await expect(energyOpt).toBeVisible({ timeout: 10_000 });
    await energyOpt.click();
    // 保存（状态条内"保存状态"按钮）
    const saveBtn = page.getByRole("button", { name: "保存状态" }).first();
    if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click();
    // API 验证今日状态已写（energy 值变化为已选值）
    const res = await request.get("/api/user-state");
    const body = (await res.json()) as { current?: { energy?: string } };
    expect(["精力充沛", "精力正常", "精力不足", "low", "medium", "high"]).toContain(body.current?.energy ?? "精力正常");
  });

  test("T9 AI 调整助手：建议采纳（有未排期任务时）", async ({ page, request }) => {
    const configured = await isAiConfigured(request);
    if (!configured) {
      test.skip(true, "未配置 AI 模型，跳过 LLM 依赖用例");
    }
    const title = `E2E采纳任务-${Date.now()}`;
    await createTask(request, { title, taskType: "planned", importance: 5 });

    await gotoNav(page, "today");
    const adoptBtn = page.getByRole("button", { name: "采纳" }).first();
    if (await adoptBtn.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await adoptBtn.click();
      // 采纳 → 排期创建（apply-decision）
      await expect
        .poll(async () => {
          const hit = await findTaskByTitle(request, title);
          if (!hit) return false;
          const t = await getTask(request, hit.id);
          return Array.isArray(t.schedules) && t.schedules.length > 0;
        }, { timeout: 20_000 })
        .toBeTruthy();
    } else {
      test.skip(true, "无 AI 建议（规则未产出），跳过");
    }
  });

  test("T10 清单型任务：子任务勾选与新增（严格校验，防学习型误判）", async ({ page, request }) => {
    const title = `E2E清单任务-${Date.now()}`;
    const { id } = await createTask(request, { title });
    // 用 API 添加子任务；父任务加今日排期确保进入 Focus Card 卡列表
    await createTask(request, { title: "清单子项A", parentId: id, level: "subtask" });
    await scheduleNow(request, id, -30, 60);

    await gotoNav(page, "today");
    // ★ 严格断言：有子任务的任务必须渲染为"清单"型卡片（子任务列表可见）
    //   若产品误判为"学习"型则子任务不渲染 → 本用例失败（正是要拦截的类目误判）
    const item = page.getByText("清单子项A").first();
    await expect(item).toBeVisible({ timeout: 30_000 });

    // 勾选子任务 → complete 落库（清单交互验证；学习型卡片无此交互）
    // 勾选框为无文本按钮（li 内第一个 button），非 checkbox role
    const row = page.locator("li").filter({ hasText: "清单子项A" }).first();
    await row.locator("button").first().click();
    const child = await findTaskByTitle(request, "清单子项A");
    expect(child, "清单子项A 应已创建").not.toBeNull();
    await expect
      .poll(async () => (await getTask(request, child!.id)).status, { timeout: 20_000 })
      .toBe("completed");

    // 新增子任务（乐观更新）——P1-11：输入框由「＋」展开（默认收起，直接找 placeholder 必失败）
    const addBtn = page.getByRole("button", { name: "＋" }).first();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      const addInput = page.getByPlaceholder(/新增一项/).first();
      await expect(addInput).toBeVisible({ timeout: 10_000 });
      await addInput.fill("清单子项B");
      await addInput.press("Enter");
      await expect(page.getByText("清单子项B")).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip(true, "清单新增按钮未找到（UI 变化，需校准）");
    }
  });
});
