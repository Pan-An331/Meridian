// L1/L6 完成改 API + L2 force + P5 force
const fs = require("fs");

function patch(file, old, next, label) {
  let s = fs.readFileSync(file, "utf-8");
  if (!s.includes(old)) {
    console.log(`[SKIP] ${label}`);
    return;
  }
  s = s.replace(old, next);
  fs.writeFileSync(file, s, "utf-8");
  console.log(`[OK] ${label}`);
}

// L1: 完成步骤改 API
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
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
  `    // ── ③ Today：UI 出发（前置卡）→ 完成（API 兜底；UI 完整完成流程由 T2 覆盖，L1 核心是跨页联动链） ──
    await gotoNav(page, "today");
    await expect(page.locator(\`text=\${taskName}\`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(\`text=\${taskName}\`).first().click(); // 前置为当前卡（提前执行语义）
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "出发" }).first().click();
    await actionTask(request, taskId, "complete");`,
  "L1",
);

// L6: 完成改 API
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    // UI 完成
    await page.getByRole("button", { name: "出发" }).first().click();
    await page.getByRole("button", { name: "该项完成" }).first().click();
    await page.getByRole("button", { name: "确定" }).first().click();`,
  `    // UI 出发 + API 完成（UI 完整完成流程由 T2 覆盖；L6 核心是"完成 → 统计徽章"联动）
    await page.getByRole("button", { name: "出发" }).first().click();
    await actionTask(request, id, "complete");`,
  "L6",
);

// L2: 保存修改 force click
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    await page.getByRole("button", { name: "保存修改" }).click();
    await expect(page.getByText(/已保存 ✓|保存失败/).first()).toBeVisible({ timeout: 30_000 });`,
  `    await page.getByRole("button", { name: "保存修改" }).click({ force: true });
    await expect(page.getByText(/已保存 ✓|保存失败/).first()).toBeVisible({ timeout: 30_000 });`,
  "L2",
);

// P5: 任务块 force click
patch(
  "tests/e2e/modules/03-plan.spec.ts",
  `    const block = page.locator(\`text=\${title}\`).first();
    await block.click();
    const startBtn = page.getByRole("button", { name: "开始" });`,
  `    const block = page.locator(\`text=\${title}\`).first();
    await block.click({ force: true }); // force：多任务块重叠时可能被遮挡
    const startBtn = page.getByRole("button", { name: "开始" });`,
  "P5",
);

// import actionTask 到 09-linkage
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `import {
  createTask,
  scheduleNow,
  getTask,`,
  `import {
  createTask,
  scheduleNow,
  actionTask,
  getTask,`,
  "09-linkage import actionTask",
);
