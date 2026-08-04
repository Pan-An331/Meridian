# -*- coding: utf-8 -*-
"""几何断言：任务块内标题/时间/时长无重叠"""
import asyncio, time, datetime, json
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
EMAIL = f"ov{int(time.time())}@t.com"
PWD = "ovtest123"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1280, "height": 900})
        pg = await ctx.new_page()
        await pg.goto(f"{BASE}/register", wait_until="networkidle", timeout=60000)
        await pg.get_by_placeholder("你的昵称").fill("ov")
        await pg.get_by_placeholder("you@example.com").fill(EMAIL)
        await pg.get_by_placeholder("至少 6 位").fill(PWD)
        await pg.get_by_role("button", name="开始我的子午").click()
        await pg.wait_for_timeout(2500)
        await pg.goto(f"{BASE}/login", wait_until="networkidle", timeout=60000)
        await pg.get_by_placeholder("you@example.com").fill(EMAIL)
        await pg.get_by_placeholder("请输入密码").fill(PWD)
        await pg.get_by_role("button", name="进入子午").click()
        await pg.wait_for_timeout(4000)

        req = ctx.request
        def at(h, m):
            d = datetime.date.today()
            return datetime.datetime(d.year, d.month, d.day, h, m).strftime("%Y-%m-%dT%H:%M:%S")

        ids = []
        for title, est in [("背单词 · 考研英语", 45), ("画原理图 STM32", 120), ("提交实验报告", 40)]:
            r = await req.post(f"{BASE}/api/tasks", data=json.dumps({"title": title, "level": "task", "taskType": "task", "category": "learning", "estimatedMinutes": est}), headers={"Content-Type": "application/json"})
            ids.append((await r.json())["id"])
        await req.post(f"{BASE}/api/plan/apply-decision", data=json.dumps({"changes": [
            {"taskId": ids[0], "newStart": at(9, 0), "newEnd": at(9, 45)},
            {"taskId": ids[1], "newStart": at(10, 0), "newEnd": at(12, 0)},
            {"taskId": ids[2], "newStart": at(14, 0), "newEnd": at(14, 40)},
        ]}), headers={"Content-Type": "application/json"})

        await pg.goto(f"{BASE}/plan", wait_until="networkidle", timeout=90000)
        await pg.wait_for_timeout(5000)
        info = await pg.evaluate("""() => {
          const out = [];
          document.querySelectorAll('.plan-tsk').forEach(blk => {
            const br = blk.getBoundingClientRect();
            let titleEl=null, timeEl=null, durEl=null;
            blk.querySelectorAll('div,span').forEach(el => {
              const r = el.getBoundingClientRect();
              if (r.height <= 0 || r.width <= 0) return;
              if (el.classList && el.classList.contains('plan-tsk-title')) titleEl = r;
              else if (el.closest && el.closest('[class*="tabular-nums"]')) timeEl = r;
              else if (el.parentElement === blk) durEl = r; // 直接子元素的绝对定位时长
            });
            // 重叠检测：两矩形相交面积 > 0
            const overlap = (a, b) => {
              if (!a || !b) return false;
              const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
              const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
              return x > 2 && y > 2;
            };
            out.push({
              h: Math.round(br.height),
              title: (blk.textContent || '').trim().slice(0, 14),
              tOverTime: overlap(titleEl, timeEl),
              tOverDur: overlap(titleEl, durEl),
              timeOverDur: overlap(timeEl, durEl),
              hasTime: !!timeEl, hasDur: !!durEl,
            });
          });
          return out;
        }""")
        for r in info:
            print(r)
        await b.close()

asyncio.run(main())
