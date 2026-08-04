# -*- coding: utf-8 -*-
"""Plan 任务卡显示排查：造数据（任务+排期）→ 桌面/375 截图 + 任务块布局数据"""
import asyncio, os, time, json
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
OUT = os.path.join(os.path.dirname(__file__), "..", "UI示例", "Plan任务卡排查-2026-08-04")
os.makedirs(OUT, exist_ok=True)
EMAIL = f"tk{int(time.time())}@t.com"
PWD = "tktest123"

async def login(page):
    await page.goto(f"{BASE}/register", wait_until="networkidle", timeout=60000)
    await page.get_by_placeholder("你的昵称").fill("排查")
    await page.get_by_placeholder("you@example.com").fill(EMAIL)
    await page.get_by_placeholder("至少 6 位").fill(PWD)
    await page.get_by_role("button", name="开始我的子午").click()
    await page.wait_for_timeout(2500)
    await page.goto(f"{BASE}/login", wait_until="networkidle", timeout=60000)
    await page.get_by_placeholder("you@example.com").fill(EMAIL)
    await page.get_by_placeholder("请输入密码").fill(PWD)
    await page.get_by_role("button", name="进入子午").click()
    await page.wait_for_timeout(4000)

async def seed(ctx, pg):
    """通过 API 造任务 + 排期（含重叠、截止、AI 源）"""
    req = ctx.request
    now = int(time.time())
    tasks = []
    specs = [
        ("背单词 · 考研英语", "learning", 45),
        ("画原理图 · STM32", "practice", 120),
        ("PCB 布线", "practice", 90),
        ("考研数学第三章", "learning", 60),
        ("健身 力量训练", "health", 50),
        ("提交实验报告", "course", 40),
    ]
    for i, (title, cat, est) in enumerate(specs):
        r = await req.post(f"{BASE}/api/tasks", data=json.dumps({
            "title": title, "level": "task", "taskType": "task",
            "category": cat, "estimatedMinutes": est,
        }), headers={"Content-Type": "application/json"})
        d = await r.json()
        tasks.append(d if isinstance(d, dict) and d.get("id") else (d.get("task") or d))
    print("created:", len(tasks))
    # 排期：今天 09:00、今天 10:30（重叠）、今天 14:00、明天 09:00、明天 15:00
    day = 86400000
    t0 = time.time() * 1000
    import datetime
    def at(dow_offset, h, m):
        d = datetime.date.today() + datetime.timedelta(days=dow_offset)
        return datetime.datetime(d.year, d.month, d.day, h, m).timestamp() * 1000
    scheds = [
        (tasks[0]["id"], at(0, 9, 0), at(0, 9, 45)),
        (tasks[1]["id"], at(0, 9, 30), at(0, 11, 30)),  # 与背单词重叠
        (tasks[2]["id"], at(0, 14, 0), at(0, 15, 30)),
        (tasks[3]["id"], at(1, 9, 0), at(1, 10, 0)),
        (tasks[4]["id"], at(1, 18, 0), at(1, 19, 0)),
        (tasks[5]["id"], at(0, 8, 0), at(0, 8, 40)),    # 更早时段
    ]
    r = await req.post(f"{BASE}/api/plan/apply-decision", data=json.dumps({
        "changes": [{"taskId": s[0], "newStart": datetime.datetime.fromtimestamp(s[1]/1000).strftime("%Y-%m-%dT%H:%M:%S"), "newEnd": datetime.datetime.fromtimestamp(s[2]/1000).strftime("%Y-%m-%dT%H:%M:%S")} for s in scheds]
    }), headers={"Content-Type": "application/json"})
    print("schedule resp:", r.status)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 桌面
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page()
        await login(pg)
        await seed(ctx, pg)
        await pg.goto(f"{BASE}/plan", wait_until="networkidle", timeout=90000)
        await pg.wait_for_timeout(5000)
        await pg.screenshot(path=os.path.join(OUT, "plan-desktop-top.png"))
        blocks = await pg.evaluate("""() => {
          const out = [];
          document.querySelectorAll('*').forEach(d => {
            const s = getComputedStyle(d); const r = d.getBoundingClientRect();
            if (s.position === 'absolute' && r.height >= 20 && r.width >= 80 && r.height <= 300 && d.children.length <= 6 && d.textContent.trim().length > 2) {
              out.push({t: d.textContent.trim().replace(/\\s+/g,' ').slice(0,60), w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y)});
            }
          });
          return out.slice(0, 12);
        }""")
        print("desktop blocks:")
        for b2 in blocks: print(" ", b2)
        await ctx.close()

        # 375
        ctx2 = await b.new_context(viewport={"width": 375, "height": 812})
        pg2 = await ctx2.new_page()
        await login(pg2)
        await seed(ctx2, pg2)
        await pg2.goto(f"{BASE}/plan", wait_until="networkidle", timeout=90000)
        await pg2.wait_for_timeout(5000)
        await pg2.screenshot(path=os.path.join(OUT, "plan-375-cal.png"))
        await pg2.evaluate("window.scrollTo(0, 480)")
        await pg2.wait_for_timeout(800)
        await pg2.screenshot(path=os.path.join(OUT, "plan-375-mid.png"))
        print("375 done")
        await b.close()

asyncio.run(main())
