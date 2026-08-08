/**
 * 模块 09 · 跨页面信息联动（重点模块）
 *
 * 覆盖联动场景（对应《项目结构与信息联动梳理》第二部分）：
 * - [L1] ★核心场景★ Projects 添加"执行清单" → Plan 拖拽排期 → Today 出发/完成 →
 *         Projects 归档区出现 → Review 完成统计变化（五页联动全链路）
 * - [L2] 档案面板修改主题（GlobalSearch 打开）→ meridian-task-changed 广播 →
 *         Plan 页收集箱/时间块主题徽章同步更新（联动 1 + 联动 6）
 * - [L3] Today 积累型打卡 → Projects 习惯区"已打卡 ✓" + 树行今日已打卡（联动 4）
 * - [L4] Plan 拖拽排期 → Today 今日路线出现该任务（联动 3 → 联动 2）
 * - [L5] Inbox 确认创建任务 → Plan 收集箱可见 → Projects 待整理池可见（三页单向链）
 * - [L6] Today 完成动作 → 统计徽章（completedCount/totalMinutes）即时更新（联动 2 页内）
 *
 * 数据传递方式在每条用例头部注明。
 */
import { test, expect } from "@playwright/test";
import path from "node:path";
import { gotoNav, dragToPlanColumn, findInboxCard, expectInboxResult } from "../utils/helpers";
import {
  createTask,
  scheduleNow,
  actionTask,
  getTask,
  findTaskByTitle,
  findLatestTaskByPrefix,
  fetchTodayView,
  fetchStats,
  checkinTask,
  clearUserTasks,
} from "../utils/api";

test.describe("09 跨页面信息联动", () => {
  // 独立用户：联动场景依赖 currentTask/今日路线
  test.use({ storageState: path.join(__dirname, "..", "..", "..", ".e2e", "state", "linkage.json") });
  // 模块内隔离：每个用例开始前清空未完成任务，保证 currentTask/路线唯一（BUG-20260807-021）
  test.beforeEach(async ({ request }) => {
    await clearUserTasks(request);
  });
  test("L1 五页全链路：执行清单 → 排期 → 执行完成 → 归档 → 复盘统计", async ({ page, request }) => {
    test.setTimeout(180_000); // 五页全链路 + Neon 慢
    const projName = `E2E联动项目-${Date.now()}`;
    const taskName = `E2E联动任务-${Date.now()}`;

    // ── ① Projects：新建项目 + 子任务 + ★ 执行清单（全 UI 操作） ──
    await gotoNav(page, "projects");
    await page.getByRole("button", { name: "＋ 新建项目" }).first().click();
    const newInput = page.getByPlaceholder("输入名称，回车创建（Esc 取消）");
    await newInput.fill(projName);
    await newInput.press("Enter");
    await expect(page.locator(`text=${projName}`).first()).toBeVisible({ timeout: 15_000 });

    // 行尾 ＋ 新建子任务（行 = .pt-row 且含项目名；按钮 title="新建子项"，pt-opts 需 hover 显示）
    const projRow = page.locator(".pt-row").filter({ hasText: projName }).first();
    await projRow.hover();
    await projRow.locator('button[title="新建子项"]').click();
    await page.getByPlaceholder("输入名称，回车创建（Esc 取消）").fill(taskName);
    await page.getByPlaceholder("输入名称，回车创建（Esc 取消）").press("Enter");
    await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 15_000 });

    // ★ 设为执行清单（乐观更新立即生效 → 严格断言 .pt-star.on）
    const taskRow = page.locator(".pt-row").filter({ hasText: taskName }).first();
    await taskRow.locator(".pt-star").click();
    await expect(taskRow.locator(".pt-star.on")).toBeVisible({ timeout: 10_000 });

    // 拿到真实 taskId（供后续 API 断言）
    const hit = await findTaskByTitle(request, taskName);
    expect(hit, "联动任务应已创建").not.toBeNull();
    const taskId = hit!.id;

    // ★ 已落库（PUT 2-5s，Neon 慢）
    await expect
      .poll(async () => (await getTask(request, taskId)).star as boolean | undefined, { timeout: 20_000 })
      .toBe(true);

    // ── ② Plan：拖拽排期（真实鼠标拖拽；目标 = 今天所在列，Focus Card 只认今天） ──
    await gotoNav(page, "plan");
    const poolItem = page.locator(`text=${taskName}`).first();
    await expect(poolItem).toBeVisible({ timeout: 20_000 });
    const todayCol = (new Date().getDay() + 6) % 7;
    await dragToPlanColumn(page, taskName, todayCol, 10);

    // 排期落库（apply-decision）
    await expect
      .poll(async () => {
        const t = await getTask(request, taskId);
        return Array.isArray(t.schedules) && t.schedules.length > 0;
      }, { timeout: 20_000 })
      .toBeTruthy();

    // ── ③ Today：UI 出发（前置卡）→ 完成（API 兜底；UI 完整完成流程由 T2 覆盖，L1 核心是跨页联动链） ──
    await gotoNav(page, "today");
    await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`text=${taskName}`).first().click(); // 前置为当前卡（提前执行语义）
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "出发" }).first().click();
    // 等 start 事务落库（否则 complete 先执行会被 start 覆盖回 in_progress）
    await expect
      .poll(async () => (await getTask(request, taskId)).status, { timeout: 30_000 })
      .toBe("in_progress");
    await actionTask(request, taskId, "complete");

    // 任务 completed（API）
    await expect
      .poll(async () => (await getTask(request, taskId)).status, { timeout: 45_000 })
      .toBe("completed");

    // ── ④ Projects：归档区出现已完成任务 ──
    await gotoNav(page, "projects");
    await page.locator("text=/归档/").first().click();
    await expect(page.locator(`text=${taskName}`).first()).toBeVisible({ timeout: 20_000 });

    // ── ⑤ Review：本周完成统计 ≥ 1（totalCompleted 依赖 daily_summaries，
    //    由打开 Today 触发生成 → 打开 Today 后 poll） ──
    await gotoNav(page, "today");
    await expect
      .poll(async () => {
        const st = await fetchStats(request, "week");
        return Number(st.totalCompleted ?? 0);
      }, { timeout: 60_000 })
      .toBeGreaterThanOrEqual(1);
  });

  test("L2 档案面板改主题 → Plan 页主题徽章同步（meridian-task-changed 广播）", async ({ page, request }) => {
    test.setTimeout(180_000); // 保存 PUT 慢时可能超 60s
    const title = `E2E主题联动-${Date.now()}`;
    // 收集箱只放行 ★ 任务（V3 设计）→ 必须带 star，否则 Plan 页收集箱看不到（BUG-20260807-030）
    const { id } = await createTask(request, { title, star: true });

    // ① Today 页打开全局搜索 → 档案面板 → 改主题"身材" → 保存
    await gotoNav(page, "today");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const searchInput = page.locator("input[placeholder*='搜索'], input[type='search'], [class*='search'] input").first();
    await searchInput.fill(title);
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 15_000 });
    await page.locator(`text=${title}`).first().click();

    // 等面板 task 数据加载完成（任务标题输入框 value 非空；save() 在 task 未加载时直接 return）
    await expect(page.getByPlaceholder("任务标题")).toHaveValue(/.+/, { timeout: 20_000 });
    const themeBtn = page.getByRole("button", { name: "身材", exact: true }).first();
    await expect(themeBtn).toBeVisible({ timeout: 15_000 });
    await themeBtn.click();
    // 保存（Neon 慢时反馈渲染可能延迟 → 直接以 theme 落库为 PUT 完成信号）
    await page.getByRole("button", { name: "保存修改" }).click();
    await page.keyboard.press("Escape");

    // 落库（PUT 完成信号；Neon 慢放宽到 90s）
    await expect
      .poll(async () => (await getTask(request, id)).theme as string | null, { timeout: 90_000 })
      .toBe("身材");

    // ② Plan 页：收集箱任务旁出现主题徽章"身材"
    await gotoNav(page, "plan");
    const item = page.locator(`text=${title}`).first();
    await expect(item).toBeVisible({ timeout: 20_000 });
    const badge = page.locator("text=身材").first();
    await expect(badge).toBeVisible({ timeout: 15_000 });
  });

  test("L3 Today 打卡 → Projects 习惯区与树行状态同步", async ({ page, request }) => {
    test.setTimeout(180_000);
    const title = `E2E打卡联动-${Date.now()}`;
    // 树行状态点只渲染在【树内节点】（孤儿积累任务只进习惯区，待整理池排除积累 → 无树行）。
    // BUG-20260807-032：必须把积累任务挂到项目下，树行"今日已打卡"状态点才会出现。
    const proj = await createTask(request, { title: `E2E打卡项目-${Date.now()}`, level: "project" });
    const { id } = await createTask(request, { title, taskType: "accumulate", accumulate: true, level: "task", parentId: proj.id });
    // 积累排期默认从明天开始 → 补今日排期确保打卡卡出现在 Focus Card
    await scheduleNow(request, id, -30, 45);

    // ① Today 打卡（UI：积累·频次卡 → 出发 → D 区"打卡" → CheckinModal"打卡完成"）
    await gotoNav(page, "today");
    await page.getByRole("button", { name: "出发" }).first().click();
    await page.getByRole("button", { name: "打卡" }).first().click();
    await page.getByRole("button", { name: "打卡完成" }).first().click();
    await expect
      .poll(async () => {
        const t = await getTask(request, id);
        const logs = (t.timeLogs ?? []) as Array<{ type?: string }>;
        return logs.some((l) => l.type === "checkin");
      }, { timeout: 45_000 })
      .toBeTruthy();

    // ② Projects：习惯区"已打卡 ✓" + 树行金色状态点（今日已打卡）
    await gotoNav(page, "projects");
    const doneBtn = page.getByRole("button", { name: "已打卡 ✓" }).first();
    await expect(doneBtn).toBeVisible({ timeout: 45_000 });
    // ★ 严格断言：树行必须出现"今日已打卡"状态点（不允许兜底吞错）
    const treeDot = page.locator(`[title="今日已打卡"]`).first();
    await expect(treeDot).toBeVisible({ timeout: 10_000 });
  });

  test("L4 Plan 排期 → Today 今日路线出现该任务", async ({ page, request }) => {
    const title = `E2E路线联动-${Date.now()}`;
    // 收集箱只放行 ★ 任务 → 创建带 star
    const { id } = await createTask(request, { title, star: true });

    // ① Plan UI 拖拽排期（今天列；Focus Card 只认今天的排期）
    await gotoNav(page, "plan");
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 20_000 });
    const todayCol = (new Date().getDay() + 6) % 7;
    await dragToPlanColumn(page, title, todayCol, 10);
    await expect
      .poll(async () => {
        const t = await getTask(request, id);
        return Array.isArray(t.schedules) && t.schedules.length > 0;
      }, { timeout: 20_000 })
      .toBeTruthy();

    // ② Today：今日路线时间线出现该任务标题
    await gotoNav(page, "today");
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 30_000 });
  });

  test("L5 Inbox 创建 → Projects 待整理池（单向链）", async ({ page, request }) => {
    const title = `E2E单向链-${Date.now()}`;

    // ① Inbox UI 创建（AI 整理 + 确认）
    await gotoNav(page, "inbox");
    await page.getByPlaceholder(/把脑子里的事倒进来/).first().fill(title);
    await page.getByRole("button", { name: "AI 整理" }).click();
    await expectInboxResult(page);
    await findInboxCard(page).getByRole("button", { name: "确认" }).click();
    await expect(page.getByRole("button", { name: "撤销" }).first()).toBeVisible({ timeout: 15_000 });

    // ② Projects 待整理池可见（无父级任务 → 孤儿 → 待整理池）
    // 注：Plan 收集箱只放行 ★ 任务（V3 设计），非 ★ 的 Inbox 任务不出现在收集箱——
    // "Inbox → 收集箱"链路已由 P3（★ + 拖拽）覆盖，此处验证"创建 → 待整理池"单向链
    await gotoNav(page, "projects");
    await expect(page.locator("text=/待整理|今天要归位的/").first()).toBeVisible({ timeout: 20_000 });
    // 任务标题可能被 LLM 改写：用"含 E2E 前缀的最近任务"兜底断言其出现在池中
    const hit = await findLatestTaskByPrefix(request, "E2E单向链");
    expect(hit, "任务应已创建").not.toBeNull();
    const poolHasTask = await page.locator("div").filter({ hasText: hit!.title }).count();
    expect(poolHasTask).toBeGreaterThan(0);
  });

  test("L6 Today 完成动作 → 统计徽章即时更新（页内联动）", async ({ page, request }) => {
    test.setTimeout(150_000);
    const title = `E2E徽章联动-${Date.now()}`;
    const { id } = await createTask(request, { title });
    await scheduleNow(request, id);

    await gotoNav(page, "today");
    // 共享主用户下 currentTask 可能被其他任务占据 → 通过今日路线点击前置本任务卡片
    await expect(page.locator(`text=${title}`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`text=${title}`).first().click();
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 15_000 });

    // 完成前：todayStats.completedCount（基线）
    const before = (await fetchTodayView(request)).todayStats as { completedCount?: number };
    const beforeCount = Number(before.completedCount ?? 0);

    // UI 出发 + API 完成（UI 完整完成流程由 T2 覆盖；L6 核心是"完成 → 统计徽章"联动）
    await page.getByRole("button", { name: "出发" }).first().click();
    // 等 start 事务落库（否则 complete 先执行会被 start 覆盖）
    await expect
      .poll(async () => (await getTask(request, id)).status, { timeout: 30_000 })
      .toBe("in_progress");
    await actionTask(request, id, "complete");

    // 完成后：completedCount = before + 1（页内 load() 重取驱动徽章）
    await expect
      .poll(async () => {
        const after = (await fetchTodayView(request)).todayStats as { completedCount?: number };
        return Number(after.completedCount ?? 0);
      }, { timeout: 45_000 })
      .toBe(beforeCount + 1);
  });
});
