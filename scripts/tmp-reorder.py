import io
p = "tests/e2e/modules/12-daily-flow.spec.ts"
s = io.open(p, encoding="utf-8").read()

start = s.index("    /* ═══ 环节 6：学习型卡 D")
end = s.index("    /* ═══ 环节 10a：Review 复盘统计 ═══ */")

new_block = '''    /* ═══ 环节 6：积累型卡 C（路线点击 → 出发 → 打卡 → 内容 → 完成） ═══ */
    step(testInfo, "环节6 Today 积累型卡 C 打卡+完成");
    await gotoNav(page, "today");
    await page.reload();
    await expect(page.locator(`text=${tasks.C.title}`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`text=${tasks.C.title}`).first().click();
    await expect(page.getByRole("button", { name: "出发" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "出发" }).first().click();
    await page.getByRole("button", { name: "打卡" }).first().click();
    await expect(page.getByRole("button", { name: "打卡完成" }).first()).toBeVisible({ timeout: 10_000 });
    await page.locator("input[placeholder*='可空']").first().fill("卧推 5 组 + 跑步 3km");
    await page.getByRole("button", { name: "打卡完成" }).first().click();
    // 断言：timeLogs checkin + detail
    await expect
      .poll(async () => {
        const t = await getTask(page.request, tasks.C.id);
        const logs = (t.timeLogs ?? []) as Array<{ type?: string; detail?: string | null }>;
        return logs.some((l) => l.type === "checkin" && l.detail?.includes("卧推"));
      }, { timeout: 45_000 })
      .toBeTruthy();
    // Projects 习惯区「已打卡 ✓」+ 树行「今日已打卡」
    await gotoNav(page, "projects");
    await expect(page.getByRole("button", { name: "已打卡 ✓" }).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.locator(`[title="今日已打卡"]`).first()).toBeVisible({ timeout: 10_000 });
    // 该项完成 → 补记 → C 完成（BUG-047：complete 删决策 → 后续 D 可达）
    await gotoNav(page, "today");
    await page.reload();
    await expect(page.locator(`text=${tasks.C.title}`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`text=${tasks.C.title}`).first().click();
    await expect(page.getByRole("button", { name: "该项完成" }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "该项完成" }).first().click();
    await expect(page.getByRole("button", { name: "确定" }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "确定" }).first().click();
    await expect.poll(async () => (await getTask(page.request, tasks.C.id)).status, { timeout: 30_000 }).toBe("completed");

    /* ═══ 环节 7：学习型卡 D（C 完成删决策 → mustDo[0]=D → ＋知识点 → 可逆勾选 → 完成） ═══ */
    step(testInfo, "环节7 Today 学习型卡 D（mustDo 兜底）");
    await page.reload();
    await expect(page.locator(`text=${tasks.D.title}`).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=/学习型/").first()).toBeVisible({ timeout: 15_000 });
    // ＋ 添加 2 个知识点
    for (const kp of ["高频词 20 个", "长难句 5 句"]) {
      await page.getByRole("button", { name: "＋" }).first().click();
      const kpInput = page.getByPlaceholder(/新增一项/).first();
      await expect(kpInput).toBeVisible({ timeout: 10_000 });
      await kpInput.fill(kp);
      await kpInput.press("Enter");
      await expect(page.getByText(kp)).toBeVisible({ timeout: 15_000 });
    }
    // 出发 → 勾选 → 取消（可逆）→ 再勾
    await page.getByRole("button", { name: "出发" }).first().click();
    const kpRow = page.locator("li").filter({ hasText: "高频词 20 个" }).first();
    await expect(kpRow).toBeVisible({ timeout: 15_000 });
    await kpRow.locator("button").first().click();
    await expect
      .poll(async () => {
        const t = await getTask(page.request, tasks.D.id);
        const kids = (t.children ?? []) as Array<{ title: string; status: string }>;
        return kids.find((c) => c.title.includes("高频词"))?.status === "completed";
      }, { timeout: 20_000 })
      .toBeTruthy();
    await kpRow.locator("button").first().click(); // 可逆：取消勾选
    await expect
      .poll(async () => {
        const t = await getTask(page.request, tasks.D.id);
        const kids = (t.children ?? []) as Array<{ title: string; status: string }>;
        return kids.find((c) => c.title.includes("高频词"))?.status !== "completed";
      }, { timeout: 20_000 })
      .toBeTruthy();
    await kpRow.locator("button").first().click(); // 再勾
    await expect
      .poll(async () => {
        const t = await getTask(page.request, tasks.D.id);
        const kids = (t.children ?? []) as Array<{ title: string; status: string }>;
        return kids.find((c) => c.title.includes("高频词"))?.status === "completed";
      }, { timeout: 20_000 })
      .toBeTruthy();
    // 该项完成 → 确定
    await page.getByRole("button", { name: "该项完成" }).first().click();
    await expect(page.getByRole("button", { name: "确定" }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "确定" }).first().click();
    await expect.poll(async () => (await getTask(page.request, tasks.D.id)).status, { timeout: 30_000 }).toBe("completed");

    /* ═══ 环节 8：时间型卡 E（路线点击 → timer「完成」→ 补记） ═══ */
    step(testInfo, "环节8 Today 时间型卡 E（路线点击前置）");
    await page.reload();
    await expect(page.locator(`text=${tasks.E.title}`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`text=${tasks.E.title}`).first().click();
    await expect(page.locator("text=/固定时间/").first()).toBeVisible({ timeout: 15_000 });
    // timer 主按钮即「完成」（无需出发）
    await page.getByRole("button", { name: "完成" }).first().click();
    await expect(page.getByRole("button", { name: "确定" }).first()).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "确定" }).first().click();
    await expect.poll(async () => (await getTask(page.request, tasks.E.id)).status, { timeout: 30_000 }).toBe("completed");
    const tE = await getTask(page.request, tasks.E.id);
    expect(Number(tE.actualMinutes ?? 0), "E 补记时长应落库").toBeGreaterThanOrEqual(1);

    /* ═══ 环节 9：惰性结算 F2（scheduled 过期 → 打开 Today 自动完成） ═══ */
    step(testInfo, "环节9 惰性结算验证（F2 今早 08:00 已过期 scheduled）");
    await gotoNav(page, "today");
    await page.reload();
    await expect
      .poll(async () => (await getTask(page.request, tasks.F2.id)).status, { timeout: 60_000 })
      .toBe("completed");

'''
s = s[:start] + new_block + s[end:]
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("done")
