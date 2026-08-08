// 加长写操作断言超时（Neon 高负载容忍）
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

// 04-today: T2/T3 完成/打卡 poll 20s → 45s
patch(
  "tests/e2e/modules/04-today.spec.ts",
  `    await expect
      .poll(async () => (await getTask(request, id)).status, { timeout: 20_000 })
      .toBe("completed");`,
  `    await expect
      .poll(async () => (await getTask(request, id)).status, { timeout: 45_000 })
      .toBe("completed");`,
  "04-today T2 poll",
);
patch(
  "tests/e2e/modules/04-today.spec.ts",
  `        return (t.accumStats as { todayChecked?: boolean } | undefined)?.todayChecked === true;
      }, { timeout: 20_000 })
      .toBeTruthy();`,
  `        return (t.accumStats as { todayChecked?: boolean } | undefined)?.todayChecked === true;
      }, { timeout: 45_000 })
      .toBeTruthy();`,
  "04-today T3 poll",
);

// 09-linkage: L1/L3/L6 poll 加长 + L2 保存反馈
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `      .poll(async () => (await getTask(request, taskId)).status, { timeout: 20_000 })
      .toBe("completed");`,
  `      .poll(async () => (await getTask(request, taskId)).status, { timeout: 45_000 })
      .toBe("completed");`,
  "09-linkage L1 poll",
);
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `        return (t.accumStats as { todayChecked?: boolean } | undefined)?.todayChecked === true;
      }, { timeout: 20_000 })
      .toBeTruthy();`,
  `        return (t.accumStats as { todayChecked?: boolean } | undefined)?.todayChecked === true;
      }, { timeout: 45_000 })
      .toBeTruthy();`,
  "09-linkage L3 poll",
);
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `        return Number(after.completedCount ?? 0);
      }, { timeout: 20_000 })
      .toBe(beforeCount + 1);`,
  `        return Number(after.completedCount ?? 0);
      }, { timeout: 45_000 })
      .toBe(beforeCount + 1);`,
  "09-linkage L6 poll",
);
patch(
  "tests/e2e/modules/09-linkage.spec.ts",
  `    await expect(page.getByText(/已保存 ✓|保存失败/).first()).toBeVisible({ timeout: 15_000 });`,
  `    await expect(page.getByText(/已保存 ✓|保存失败/).first()).toBeVisible({ timeout: 30_000 });`,
  "09-linkage L2 保存反馈",
);

// 03-plan: P8 poll 加长
patch(
  "tests/e2e/modules/03-plan.spec.ts",
  `        return schedules.some((s) => s.scheduledStart.startsWith(tomorrow));
      }, { timeout: 20_000 })
      .toBeTruthy();`,
  `        return schedules.some((s) => s.scheduledStart.startsWith(tomorrow));
      }, { timeout: 45_000 })
      .toBeTruthy();`,
  "03-plan P8 poll",
);

// 06-projects: J3 poll 加长
patch(
  "tests/e2e/modules/06-projects.spec.ts",
  `        return t.star === true;
      }, { timeout: 15_000 })
      .toBeTruthy();`,
  `        return t.star === true;
      }, { timeout: 45_000 })
      .toBeTruthy();`,
  "06-projects J3 poll",
);
