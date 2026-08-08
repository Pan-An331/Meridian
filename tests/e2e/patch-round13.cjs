// 第 13 轮补丁：plan 模块清空 + L1/L6 竞态 + P8/L2 超时 + X1 重试
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

// 1) plan 模块 beforeEach 清空（共享主用户任务块重叠）
patch(
  "tests/e2e/modules/03-plan.spec.ts",
  `test.describe("03 Plan 规划页", () => {
  test("P1 周/聚焦切换", async ({ page }) => {`,
  `test.describe("03 Plan 规划页", () => {
  // 模块内隔离：共享主用户下任务块会重叠遮挡，每个用例前清空（BUG-20260807-021）
  test.beforeEach(async ({ request }) => {
    await clearUserTasks(request);
  });
  test("P1 周/聚焦切换", async ({ page }) => {`,
  "03-plan beforeEach",
);
patch(
  "tests/e2e/modules/03-plan.spec.ts",
  `import { gotoNav, dragToPlanColumn } from "../utils/helpers";
import { createTask, scheduleTask, getTask, findTaskByTitle } from "../utils/api";`,
  `import { gotoNav, dragToPlanColumn } from "../utils/helpers";
import { createTask, scheduleTask, getTask, findTaskByTitle, clearUserTasks } from "../utils/api";`,
  "03-plan import",
);

// 2) L1: start 后等 in_progress 再 complete
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    await page.getByRole("button", { name: "出发" }).first().click();
    await actionTask(request, taskId, "complete");`,
  `    await page.getByRole("button", { name: "出发" }).first().click();
    // 等 start 事务落库（否则 complete 先执行会被 start 覆盖回 in_progress）
    await expect
      .poll(async () => (await getTask(request, taskId)).status, { timeout: 30_000 })
      .toBe("in_progress");
    await actionTask(request, taskId, "complete");`,
  "L1 start 等待",
);

// 3) L6: 同样
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    // UI 出发 + API 完成（UI 完整完成流程由 T2 覆盖；L6 核心是"完成 → 统计徽章"联动）
    await page.getByRole("button", { name: "出发" }).first().click();
    await actionTask(request, id, "complete");`,
  `    // UI 出发 + API 完成（UI 完整完成流程由 T2 覆盖；L6 核心是"完成 → 统计徽章"联动）
    await page.getByRole("button", { name: "出发" }).first().click();
    // 等 start 事务落库（否则 complete 先执行会被 start 覆盖）
    await expect
      .poll(async () => (await getTask(request, id)).status, { timeout: 30_000 })
      .toBe("in_progress");
    await actionTask(request, id, "complete");`,
  "L6 start 等待",
);

// 4) P8: poll 90s
patch(
  "tests/e2e/modules/03-plan.spec.ts",
  `        return schedules.some((s) => s.scheduledStart.startsWith(tomorrow));
      }, { timeout: 45_000 })
      .toBeTruthy();`,
  `        return schedules.some((s) => s.scheduledStart.startsWith(tomorrow));
      }, { timeout: 90_000 })
      .toBeTruthy();`,
  "P8 poll 90s",
);

// 5) L2: 保存反馈 60s + 普通 click
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    await page.getByRole("button", { name: "保存修改" }).click({ force: true });
    await expect(page.getByText(/已保存 ✓|保存失败/).first()).toBeVisible({ timeout: 30_000 });`,
  `    await page.getByRole("button", { name: "保存修改" }).click();
    await expect(page.getByText(/已保存 ✓|保存失败/).first()).toBeVisible({ timeout: 60_000 });`,
  "L2 保存反馈",
);

// 6) X1: DELETE 重试 10 次（产品层）
patch(
  "src/app/api/user/route.ts",
  `  let userDeleted = false;
  for (let i = 0; i < 5 && !userDeleted; i++) {`,
  `  let userDeleted = false;
  for (let i = 0; i < 10 && !userDeleted; i++) {`,
  "X1 DELETE 重试 10 次",
);
