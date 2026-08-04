# -*- coding: utf-8 -*-
"""调试：注册/登录流程，打印页面错误文本"""
import asyncio, time
from playwright.async_api import async_playwright

BASE = "http://localhost:3000"
EMAIL = f"dbg{int(time.time())}@test.com"
PWD = "dbgtest123"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 375, "height": 812})
        page = await ctx.new_page()

        await page.goto(f"{BASE}/register", wait_until="networkidle", timeout=60000)
        print("== register inputs ==")
        print(await page.eval_on_selector_all("input", "els => els.map(e => e.placeholder)"))
        await page.get_by_placeholder("你的昵称").fill("移动端测试")
        await page.get_by_placeholder("you@example.com").fill(EMAIL)
        await page.get_by_placeholder("至少 6 位").fill(PWD)
        btns = await page.eval_on_selector_all("button", "els => els.map(b => b.textContent)")
        print("buttons:", btns)
        await page.get_by_role("button", name="开始我的子午").click()
        await page.wait_for_timeout(4000)
        print("url after reg:", page.url)
        err = await page.eval_on_selector_all("div", "els => els.filter(e => /失败|错误|Error/.test(e.textContent)).map(e => e.textContent.trim()).slice(0,5)")
        print("register errors:", err)

        await page.goto(f"{BASE}/login", wait_until="networkidle", timeout=60000)
        print("== login inputs ==")
        print(await page.eval_on_selector_all("input", "els => els.map(e => e.placeholder)"))
        await page.get_by_placeholder("you@example.com").fill(EMAIL)
        await page.get_by_placeholder("请输入密码").fill(PWD)
        await page.get_by_role("button", name="进入子午").click()
        await page.wait_for_timeout(5000)
        print("url after login:", page.url)
        err2 = await page.eval_on_selector_all("div", "els => els.filter(e => /失败|错误|Error/.test(e.textContent)).map(e => e.textContent.trim()).slice(0,5)")
        print("login errors:", err2)
        print("cookies:", await ctx.cookies())
        await browser.close()

asyncio.run(main())
