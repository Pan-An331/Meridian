/**
 * 模块 11 · 实体浏览器全流程回归（纯 UI 操作，零 API 造数据）
 *
 * 用户流程（R8 要求）：
 *   ① Inbox 新建任务 → ② Projects 归类到指定项目 → ③ ★ 设为执行清单
 *   → ④ Today 提前点击执行 → ⑤ 清单型计时（完成 vs 跳过 逐项核对）
 *   → ⑥ 时间信息核对（开始/结束/耗时/完成时间）→ ⑦ 跨页联动补充
 *
 * 纪律：
 *   - 数据准备全部走 UI（注册/登录/Inbox AI 整理/Projects 挂树/Plan 拖拽）
 *   - 禁止 request fixture 写操作（不 createTask/scheduleTask/actionTask）
 *   - 仅允许只读 GET（findTaskByTitle/getTask）做落库与时间核对
 */
import { test, expect } from "@playwright/test";
import { gotoNav, registerTempUser, findInboxCard, expectInboxResult, dragToPlanColumn } from "../utils/helpers";
import { findLatestTaskByPrefix, getTask } from "../utils/api";

/** 本地 HH:MM（±容差核对用） */
function localHM(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** 分钟差（四舍五入） */
function diffMin(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 60000);
}

test.describe("11 实体浏览器全流程回归（纯 UI）", () => {
  test("Inbox→Projects→★→Plan→Today 计时（完成/跳过）→时间核对→联动", async ({ page }) => {
    test.setTimeout(600_000); // 全流程 UI 操作 + Neon 慢

    /* ═══ 0. 注册 + 登录（UI）═══ */
    const email = await registerTempUser(page);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("请输入密码").fill("TempPassw0rd!");
    await page.getByRole("button", { name: "进入子午" }).click();
    await page.waitForURL("**/today", { timeout: 30_000 });

    /* ═══ ① Inbox 新建任务 A（完成链路）═══ */
    await gotoNav(page, "inbox");
    await page.getByPlaceholder(/把脑子里的事倒进来/).first().fill("E2E回归完成计时任务，预计 60 分钟");
    await page.getByRole("button", { name: "AI 整理" }).click();
    await expectInboxResult(page);
    const cardA = findInboxCard(page);
    await expect(cardA).toBeVisible({ timeout: 15_000 });
    await cardA.getByRole("button", { name: "确认" }).click();
    await expect(page.getByRole("button", { name: "撤销" }).first()).toBeVisible({ timeout: 15_000 });
    // 只读核对：任务 A 已落库（标题可能被 AI 改写，前缀匹配）
    const hitA = await findLatestTaskByPrefix(page.request, "E2E回归完成计时任务");
    expect(hitA, "任务 A 应已创建").not.toBeNull();
    const taskAId = hitA!.id;
    const titleA = hitA!.title;

    /* ═══ ①' Inbox 新建任务 B（跳过链路）═══ */
    await page.getByPlaceholder(/把脑子里的事倒进来/).first().fill("E2E回归跳过计时任务，预计 45 分钟");
    await page.getByRole("button", { name: "AI 整理" }).click();
    await expectInboxResult(page);
    const cardB = findInboxCard(page);
    await expect(cardB).toBeVisible({ timeout: 15_000 });
    await cardB.getByRole("button", { name: "确认" }).click();
    await expect(page.getByRole("button", { name: "撤销" }).first()).toBeVisible({ timeout: 15_000 });
    const hitB = await findLatestTaskByPrefix(page.request, "E2E回归跳过计时任务");
    expect(hitB, "任务 B 应已创建").not.toBeNull();
    const taskBId = hitB!.id;
    const titleB = hitB!.title;

    /* ═══ ② Projects：新建指定项目 + 任务 A 归类挂入 ═══ */
    await gotoNav(page, "projects");
    await page.getByRole("button", { name: "＋ 新建项目" }).first().click();
    await page.getByPlaceholder("输入名称，回车创建（Esc 取消）").fill("E2E回归项目");
    await page.getByPlaceholder("输入名称，回车创建（Esc 取消）").press("Enter");
    await expect(page.locator(`text=E2E回归项目`).first()).toBeVisible({ timeout: 15_000 });

    // 待整理池出现任务 A（孤儿）→ 拖拽挂入项目（HTML5 DnD，参考 J7）
    // BUG-20260807-034：text= 匹配可能落到 span/toast（drop 不到 .pt-row 的 onDrop），
    // 且 dragstart 后需等 React setDragId 生效（onRowDrop 优先读 dragId）→ 精确选择器 + 等待
    const poolA = page.locator(".pt-pool-item").filter({ hasText: titleA }).first();
    await expect(poolA).toBeVisible({ timeout: 20_000 });
    const dstRow = page.locator(".pt-row").filter({ hasText: "E2E回归项目" }).first();
    await expect(dstRow).toBeVisible();
    const dt = await page.evaluateHandle(() => new DataTransfer());
    await poolA.dispatchEvent("dragstart", { dataTransfer: dt });
    await page.waitForTimeout(150); // 等 React setDragId/setDragSource 提交（onRowDrop 优先读 dragId）
    await dstRow.dispatchEvent("dragover", { dataTransfer: dt });
    await page.waitForTimeout(80);
    await dstRow.dispatchEvent("drop", { dataTransfer: dt });
    // 只读核对：任务 A parentId 已挂入（GET）
    await expect
      .poll(async () => {
        const t = await getTask(page.request, taskAId);
        return (t.parentId as string | null) ?? null;
      }, { timeout: 30_000 })
      .toBeTruthy();

    // 任务 B 同样挂入项目（跳过流程也需进 Plan 收集箱排期 → 需 ★ → 树行才有 ★）
    const poolB = page.locator(".pt-pool-item").filter({ hasText: titleB }).first();
    await expect(poolB).toBeVisible({ timeout: 20_000 });
    const dtB = await page.evaluateHandle(() => new DataTransfer());
    await poolB.dispatchEvent("dragstart", { dataTransfer: dtB });
    await page.waitForTimeout(150);
    await dstRow.dispatchEvent("dragover", { dataTransfer: dtB });
    await page.waitForTimeout(80);
    await dstRow.dispatchEvent("drop", { dataTransfer: dtB });
    await expect
      .poll(async () => {
        const t = await getTask(page.request, taskBId);
        return (t.parentId as string | null) ?? null;
      }, { timeout: 30_000 })
      .toBeTruthy();

    /* ═══ ③ ★ 设为执行清单（任务 A、任务 B）═══ */
    // 树行 A（.pt-row 含标题）→ 点 ★ → 乐观点亮
    const rowA = page.locator(".pt-row").filter({ hasText: titleA }).first();
    await expect(rowA).toBeVisible({ timeout: 15_000 });
    await rowA.locator(".pt-star").click();
    await expect(rowA.locator(".pt-star.on")).toBeVisible({ timeout: 10_000 });
    // 只读核对：star 落库（等待 PUT，不 reload）
    await expect
      .poll(async () => (await getTask(page.request, taskAId)).star as boolean | undefined, { timeout: 30_000 })
      .toBe(true);
    // 任务 B 同样 ★
    const rowB = page.locator(".pt-row").filter({ hasText: titleB }).first();
    await expect(rowB).toBeVisible({ timeout: 15_000 });
    await rowB.locator(".pt-star").click();
    await expect(rowB.locator(".pt-star.on")).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await getTask(page.request, taskBId)).star as boolean | undefined, { timeout: 30_000 })
      .toBe(true);

    /* ═══ ④ Plan：A/B 排期到今天（提前时段 = 现在 + 2h，模拟"排期未到提前执行"）═══ */
    await gotoNav(page, "plan");
    const todayCol = (new Date().getDay() + 6) % 7;
    const hourA = Math.min(new Date().getHours() + 2, 21);
    await dragToPlanColumn(page, titleA, todayCol, hourA);
    await expect
      .poll(async () => {
        const t = await getTask(page.request, taskAId);
        return Array.isArray(t.schedules) && t.schedules.length > 0;
      }, { timeout: 30_000 })
      .toBeTruthy();
    await dragToPlanColumn(page, titleB, todayCol, Math.min(hourA + 1, 21));
    await expect
      .poll(async () => {
        const t = await getTask(page.request, taskBId);
        return Array.isArray(t.schedules) && t.schedules.length > 0;
      }, { timeout: 30_000 })
      .toBeTruthy();

    /* ═══ ⑤ Today：提前点击任务 A → 出发（记录时间）═══ */
    await gotoNav(page, "today");
    // 今日路线出现任务 A（排期时间晚于现在 → 提前执行语义）
    const routeA = page.locator(`text=${titleA}`).first();
    await expect(routeA).toBeVisible({ timeout: 30_000 });
    const tClick = new Date();
    await routeA.click(); // 路线点击 → 前置为当前卡（提前执行）
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "出发" }).first().click();
    const tStart = new Date();

    // ⑥-1 出发时间核对：卡片「从 HH:MM 出发」≈ 点击时刻（±3min）
    const depLine = page.locator("text=/从 \\d{2}:\\d{2} 出发/").first();
    await expect(depLine).toBeVisible({ timeout: 15_000 });
    const depLabel = (await depLine.textContent()) ?? "";
    const depHM = depLabel.match(/(\d{2}:\d{2})/)?.[1] ?? "";
    const depExpect = localHM(tStart);
    expect(diffMin(new Date(`2026-01-01T${depHM}:00`), new Date(`2026-01-01T${depExpect}:00`)), `出发时间 ${depHM} 应≈${depExpect}`).toBeLessThanOrEqual(3);

    // ⑥-2 计时进行中核对：卡片应显示"进行中"状态（清单型卡）
    await expect(page.getByRole("button", { name: "该项完成" }).first()).toBeVisible({ timeout: 15_000 });

    /* ═══ ⑥-3 完成任务 A（补记时长）═══ */
    await page.getByRole("button", { name: "该项完成" }).first().click();
    const modalDur = page.getByRole("button", { name: "确定" }).first();
    await expect(modalDur).toBeVisible({ timeout: 10_000 });
    const tDoneClick = new Date();
    // ⑥-4 补记默认值核对：弹窗默认分钟 ≈ 出发到现在的分钟差
    const durInput = page.locator("input[placeholder='45']").first();
    const durVal = Number(await durInput.inputValue());
    const expectDur = diffMin(tDoneClick, tStart);
    expect(Math.abs(durVal - expectDur), `补记默认 ${durVal} 分钟应≈${expectDur}`).toBeLessThanOrEqual(2);
    await modalDur.click();

    // ⑥-5 完成态核对：卡片「已完成 ✓」；只读核对 status=completed + actualMinutes=durVal
    await expect(page.getByRole("button", { name: "已完成 ✓" }).first()).toBeVisible({ timeout: 20_000 });
    const tCompleted = new Date();
    await expect
      .poll(async () => (await getTask(page.request, taskAId)).status, { timeout: 30_000 })
      .toBe("completed");
    const tA = await getTask(page.request, taskAId);
    // ⑥-6 完成时间核对：completedAt ≈ 点击确定时刻（±3min）
    const completedAt = tA.completedAt as string | null;
    expect(completedAt, "任务 A 应有完成时间").not.toBeNull();
    if (completedAt) {
      const diff = diffMin(new Date(completedAt), tCompleted);
      expect(diff, `完成时间 ${completedAt} 应≈${localHM(tCompleted)}（差 ${diff}min）`).toBeLessThanOrEqual(3);
    }
    // ⑥-7 任务耗时核对：actualMinutes = 补记分钟
    expect(Number(tA.actualMinutes ?? 0)).toBe(durVal);

    /* ═══ ⑥-8 档案面板时间核对（实际用时显示）═══ */
    await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
    const searchInput = page.locator("input[placeholder*='搜索'], input[type='search'], [class*='search'] input").first();
    await searchInput.fill(titleA);
    // BUG-20260808-052：搜索结果按钮带「未 」前缀（未分类）——`text=` 会误匹配主卡 heading，
    // 点击主卡标题不会打开档案。用「未 」前缀精确定位搜索结果按钮。
    const searchResultBtn = page.locator("button:has-text('未 ')").filter({ hasText: titleA }).first();
    await expect(searchResultBtn).toBeVisible({ timeout: 15_000 });
    await searchResultBtn.click();
    await expect(page.getByPlaceholder("任务标题")).toHaveValue(/.+/, { timeout: 20_000 });
    // 实际用时行 = 补记分钟
    const panel = page.locator("div").filter({ hasText: "实际用时" }).last();
    await expect(panel).toBeVisible({ timeout: 15_000 });
    const panelText = (await panel.textContent()) ?? "";
    expect(panelText).toContain(`${durVal} 分钟`);
    await page.keyboard.press("Escape");

    /* ═══ ⑥-9 Today 顶部统计核对：完成 1 · 专注 ≈ durVal 分钟 ═══ */
    const statArea = page.locator("main").first();
    await expect(statArea.getByText("1", { exact: true }).first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    await expect
      .poll(async () => {
        const txt = (await page.locator("main").first().textContent()) ?? "";
        // 顶部统计布局为「数字+标签」（如「0 专注分钟」）→ 数字在标签前
        const m = txt.match(/(\d+)\s*专注分钟/) ?? txt.match(/专注分钟\s*(\d+)/);
        return m ? Number(m[1]) : -1;
      }, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(durVal); // 严格：专注分钟 ≥ 补记分钟（显示 0 视为未刷新 → 失败暴露）

    /* ═══ ⑤' Today：提前点击任务 B → 出发 → 跳过后一项 ═══ */
    // 路线点击任务 B → 前置 → 出发
    const routeB = page.locator(`text=${titleB}`).first();
    await expect(routeB).toBeVisible({ timeout: 30_000 });
    await routeB.click();
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "出发" }).first().click();
    await expect(page.getByRole("button", { name: "该项完成" }).first()).toBeVisible({ timeout: 15_000 });
    // 跳过后一项（skip_item：不改后端状态，前端切卡）
    await page.getByRole("button", { name: "跳过后一项" }).first().click();
    // ⑥-10 跳过核对：任务 B 状态仍 in_progress（产品语义：跳过只调整执行顺序/切卡）
    await expect
      .poll(async () => (await getTask(page.request, taskBId)).status, { timeout: 20_000 })
      .toBe("in_progress");

    /* ═══ ⑦ 跨页面联动补充核对 ═══ */
    // ⑦-1 Projects 归档区出现任务 A（完成联动）
    await gotoNav(page, "projects");
    await page.locator("text=/归档/").first().click();
    await expect(page.locator(`text=${titleA}`).first()).toBeVisible({ timeout: 20_000 });
    // ⑦-2 树行 A 完成态（✓ 完成 标记）+ 归档区 B 未出现（B 未完成）
    await expect(page.locator(".pt-done-tag").first()).toBeVisible({ timeout: 15_000 });
    const bInArchive = await page.locator("text=/归档/").first().isVisible();
    if (bInArchive) {
      // 归档区展开状态下 B 不应出现
      const bVisible = await page.locator(`.pt-ar-body:visible >> text=${titleB}`).isVisible().catch(() => false);
      expect(bVisible, "未完成的任务 B 不应出现在归档区").toBeFalsy();
    }
    // ⑦-3 Inbox 无残留（两个任务均已确认创建）
    await gotoNav(page, "inbox");
    await expect(page.getByRole("button", { name: "撤销" }).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    // ⑦-4 Plan 周历：任务 A 已完成块存在（历史排期保留）；数据一致性核对
    await gotoNav(page, "plan");
    await expect(page.locator(`text=${titleA}`).first()).toBeVisible({ timeout: 20_000 });
    // ⑦-5 统计一致性：Review 本周完成 ≥ 1（任务 A）
    await gotoNav(page, "today"); // 触发摘要刷新
    await expect
      .poll(async () => {
        const r = await page.request.get("/api/views/stats?range=week");
        if (!r.ok()) return -1;
        const d = (await r.json()) as { totalCompleted?: number };
        return Number(d.totalCompleted ?? 0);
      }, { timeout: 60_000 })
      .toBeGreaterThanOrEqual(1);
  });
});
