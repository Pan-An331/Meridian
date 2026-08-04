# -*- coding: utf-8 -*-
"""全站移动端适配验证：375px 逐页截图（注册→登录→各页）"""
import asyncio, os, time
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
OUT = os.path.join(os.path.dirname(__file__), "..", "UI示例", "移动端截图-2026-08-04")
os.makedirs(OUT, exist_ok=True)

EMAIL = f"mobtest{int(time.time())}@test.com"
PWD = "mobtest123"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 375, "height": 812}, device_scale_factor=2)
        page = await ctx.new_page()

        # 1) 注册
        await page.goto(f"{BASE}/register", wait_until="networkidle", timeout=60000)
        await page.screenshot(path=os.path.join(OUT, "register-375.png"))
        await page.get_by_placeholder("你的昵称").fill("移动端测试")
        await page.get_by_placeholder("you@example.com").fill(EMAIL)
        await page.get_by_placeholder("至少 6 位").fill(PWD)
        await page.get_by_role("button", name="开始我的子午").click()
        await page.wait_for_timeout(3000)
        print("after register:", page.url)

        # 2) 登录（直接导航）
        await page.goto(f"{BASE}/login", wait_until="networkidle", timeout=60000)
        await page.screenshot(path=os.path.join(OUT, "login-375.png"))
        await page.get_by_placeholder("you@example.com").fill(EMAIL)
        await page.get_by_placeholder("请输入密码").fill(PWD)
        await page.get_by_role("button", name="进入子午").click()
        await page.wait_for_timeout(5000)
        print("after login:", page.url)

        # 3) 逐页截图
        for name in ["today", "plan", "review", "projects", "inbox"]:
            await page.goto(f"{BASE}/{name}", wait_until="networkidle", timeout=90000)
            await page.wait_for_timeout(4000)
            await page.screenshot(path=os.path.join(OUT, f"{name}-375.png"))
            print("shot:", name, page.url)

        # 4) Plan 滚动中部（周历区）
        await page.goto(f"{BASE}/plan", wait_until="networkidle", timeout=90000)
        await page.wait_for_timeout(4000)
        await page.evaluate("window.scrollTo(0, 420)")
        await page.wait_for_timeout(800)
        await page.screenshot(path=os.path.join(OUT, "plan-375-mid.png"))
        print("shot: plan-mid")

        await browser.close()
        print("DONE")

asyncio.run(main())
