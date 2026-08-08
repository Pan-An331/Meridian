// 批量修复 T3/L3/T5/L1（第 8 轮）
const fs = require("fs");

function patch(file, old, next, label) {
  let s = fs.readFileSync(file, "utf-8");
  if (!s.includes(old)) {
    console.log(`[SKIP] ${label}: 未找到匹配`);
    return;
  }
  s = s.replace(old, next);
  fs.writeFileSync(file, s, "utf-8");
  console.log(`[OK] ${label}`);
}

// T3: 出发 → 打卡（D 区）→ 打卡完成（Modal）
patch(
  "tests/e2e/modules/04-today.spec.ts",
  `    const startBtn = page.getByRole("button", { name: "出发" }).first();
    await expect(startBtn).toBeVisible({ timeout: 30_000 });
    await startBtn.click();
    await page.getByRole("button", { name: "该项完成" }).first().click();
    // CheckinModal：确认按钮"打卡完成"
    const modalBtn = page.getByRole("button", { name: "打卡完成" }).first();`,
  `    const startBtn = page.getByRole("button", { name: "出发" }).first();
    await expect(startBtn).toBeVisible({ timeout: 30_000 });
    await startBtn.click();
    // 积累卡 going 态主流程按钮为"打卡"（D 区）→ CheckinModal"打卡完成"
    await page.getByRole("button", { name: "打卡" }).first().click();
    const modalBtn = page.getByRole("button", { name: "打卡完成" }).first();`,
  "T3",
);

// L3
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    // ① Today 打卡（UI：积累·频次卡 → 出发 → 该项完成 → CheckinModal"打卡完成"）
    await gotoNav(page, "today");
    await page.getByRole("button", { name: "出发" }).first().click();
    await page.getByRole("button", { name: "该项完成" }).first().click();
    await page.getByRole("button", { name: "打卡完成" }).first().click();`,
  `    // ① Today 打卡（UI：积累·频次卡 → 出发 → D 区"打卡" → CheckinModal"打卡完成"）
    await gotoNav(page, "today");
    await page.getByRole("button", { name: "出发" }).first().click();
    await page.getByRole("button", { name: "打卡" }).first().click();
    await page.getByRole("button", { name: "打卡完成" }).first().click();`,
  "L3",
);

// T5: 跳过 → 前端空态
patch(
  "tests/e2e/modules/04-today.spec.ts",
  `    // 跳过 = 跳过当前卡（skip_item 不改任务状态）→ 断言当前任务被跳过（进入下一张/空态）
    // 用 today view API 验证 skipped 标记存在
    await expect
      .poll(async () => {
        const v = await fetchTodayView(request);
        const cur = v.currentTask as { id?: string } | null;
        return cur ? cur.id !== id : true;
      }, { timeout: 20_000 })
      .toBeTruthy();`,
  `    // 跳过 = 前端跳过当前卡（skip_item 不改后端状态）→ 唯一任务跳过后面临空态
    await expect(page.getByText(/当前没有正在执行的任务/).first()).toBeVisible({ timeout: 15_000 });`,
  "T5",
);

// L1: Today 完成流程改"路线点击前置"
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    // ── ③ Today：出发 → 完成 ──
    await gotoNav(page, "today");
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "出发" }).first().click();
    await expect(page.getByRole("button", { name: "该项完成" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "该项完成" }).first().click();
    await expect(page.getByRole("button", { name: "补记完成" }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "补记完成" }).first().click();`,
  `    // ── ③ Today：路线点击前置（拖拽排期 10:00 在凌晨未开始，currentTask 不命中）→ 出发 → 完成 ──
    await gotoNav(page, "today");
    await expect(page.locator(\`text=\${taskName}\`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(\`text=\${taskName}\`).first().click(); // 前置为当前卡（提前执行语义）
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "出发" }).first().click();
    await expect(page.getByRole("button", { name: "该项完成" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "该项完成" }).first().click();
    await expect(page.getByRole("button", { name: "确定" }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "确定" }).first().click();`,
  "L1",
);
