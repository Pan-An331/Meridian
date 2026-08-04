# -*- coding: utf-8 -*-
"""375px 布局检查：横向溢出 + 关键元素可见性"""
import asyncio, time
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
EMAIL = f"chk{int(time.time())}@test.com"
PWD = "chktest123"

async def check(page, name):
    await page.goto(f"{BASE}/{name}", wait_until="networkidle", timeout=90000)
    await page.wait_for_timeout(4000)
    r = await page.evaluate("""() => {
      const de = document.documentElement;
      return {
        sw: de.scrollWidth, iw: de.clientWidth, sh: de.scrollHeight,
        overflowX: de.scrollWidth > de.clientWidth + 2,
        buttons: [...document.querySelectorAll('button')].filter(b => {
          const r = b.getBoundingClientRect();
          return r.height > 0 && r.height < 40 && r.width > 30;
        }).length
      };
    }""")
    print(f"[{name}] scrollWidth={r['sw']} clientWidth={r['iw']} overflowX={r['overflowX']} 小按钮(<40px)={r['buttons']}")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 375, "height": 812})
        page = await ctx.new_page()

        # 注册登录（复用上轮账号不行，重新注册）
        await page.goto(f"{BASE}/register", wait_until="networkidle", timeout=60000)
        await page.get_by_placeholder("你的昵称").fill("布局检查")
        await page.get_by_placeholder("you@example.com").fill(EMAIL)
        await page.get_by_placeholder("至少 6 位").fill(PWD)
        await page.get_by_role("button", name="开始我的子午").click()
        await page.wait_for_timeout(2500)
        await page.goto(f"{BASE}/login", wait_until="networkidle", timeout=60000)
        await page.get_by_placeholder("you@example.com").fill(EMAIL)
        await page.get_by_placeholder("请输入密码").fill(PWD)
        await page.get_by_role("button", name="进入子午").click()
        await page.wait_for_timeout(4000)
        print("登录后:", page.url)

        for name in ["today", "plan", "review", "projects", "inbox"]:
            await check(page, name)

        # Plan 周历聚焦验证：移动端应自动聚焦（周胶囊「周」非激活）
        await page.goto(f"{BASE}/plan", wait_until="networkidle", timeout=90000)
        await page.wait_for_timeout(4000)
        focusInfo = await page.evaluate("""() => {
          const btns = [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => t === '周' || t === '聚焦');
          const focusBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '聚焦');
          return { btns, focusActive: focusBtn ? focusBtn.className.includes('bg-[var(--v2-brand)]') : null,
                   cols: [...document.querySelectorAll('.plan-week-col')].length };
        }""")
        print("Plan 聚焦状态:", focusInfo)

        await browser.close()
        print("DONE")

asyncio.run(main())
