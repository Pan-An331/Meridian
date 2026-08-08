#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Meridian（Task OS）本地一键启动器 · Windows
================================================
功能：
  1. 检测 localhost:3000 开发服务器：
     - 已在运行 → 直接打开浏览器，不做重复启动（防重复：端口检测 + 页面特征校验）
     - 未运行   → 清理环境变量 → 启动 dev → 等待就绪（含首次 Turbopack 编译）→ 打开浏览器
  2. 数据库无需本地服务：项目直连云端 Neon 库（.env 的 DATABASE_URL），
     数据库连通性由应用运行时验证（页面 API 报错时日志可查）。
  3. 健壮性：端口被其他程序占用 → 明确提示；dev 启动失败 → 清 .next 缓存自动重试；
     全部过程写入 <项目目录>/meridian-launcher.log。

依赖：Python 3.8+（仅标准库，零第三方依赖）+ Node.js/npm（项目自带）
用法：双击本文件（.pyw 无黑色控制台窗口）；命令行加 --no-browser 可跳过打开浏览器（调试用）

使用前请核对下方「配置区」的 PROJECT_DIR 是否指向你的项目目录。
"""
import os
import sys
import socket
import subprocess
import time
import urllib.request
import webbrowser
import ctypes
from pathlib import Path

# ══════════════ 配置区（按需修改） ══════════════
PROJECT_DIR = r"F:\Meridian"           # 项目根目录（脚本所在桌面时务必核对此路径）
APP_URL = "http://localhost:3000"      # 本地访问地址
PORT = 3000                            # dev server 端口
MAX_WAIT_SEC = 300                     # 首次编译最久等待（秒）；清缓存后可能更慢
CLEAR_CACHE_RETRY = 1                  # 启动失败后清 .next 缓存的重试次数
LOG_FILE = os.path.join(PROJECT_DIR, "meridian-launcher.log")
PID_FILE = os.path.join(PROJECT_DIR, "meridian-dev.pid")
# ════════════════════════════════════════════════

CREATE_NO_WINDOW = 0x08000000  # Windows：子进程不弹控制台窗口
NO_BROWSER = "--no-browser" in sys.argv

# 本地访问禁用代理（系统代理变量可能导致 localhost 请求超时误判）
_NO_PROXY_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def log(msg: str):
    """写日志（控制台可见 + 落盘）"""
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


def notify(title: str, msg: str):
    """Windows 弹窗提示（双击 .pyw 无控制台时也能看到结果）"""
    try:
        ctypes.windll.user32.MessageBoxW(0, msg, title, 0x40)  # MB_OK | MB_ICONINFORMATION
    except Exception:
        pass


def port_open(port: int) -> bool:
    """端口是否已被监听"""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=2):
            return True
    except OSError:
        return False


def is_meridian_server() -> bool:
    """端口有服务，但确认是不是 Meridian（防误判其他程序占用 3000）"""
    try:
        with _NO_PROXY_OPENER.open(APP_URL + "/login", timeout=15) as r:
            if r.status != 200:
                return False
            body = r.read(5000).decode("utf-8", "ignore")
            # 登录页特征（标题/品牌/中文文案任一项）
            return any(k in body for k in ("Meridian", "子午", "登录", "进入子午"))
    except Exception as e:
        log(f"页面特征校验首次失败：{type(e).__name__}: {e}（30s 内重试，dev 可能正在编译）")
        # dev server（Turbopack）首次编译/间歇卡顿时会瞬时超时——重试 5 次共 30s
        for i in range(5):
            time.sleep(5)
            try:
                with _NO_PROXY_OPENER.open(APP_URL + "/login", timeout=8) as r:
                    if r.status == 200:
                        body = r.read(5000).decode("utf-8", "ignore")
                        if any(k in body for k in ("Meridian", "子午", "登录", "进入子午")):
                            return True
            except Exception:
                pass
        return False


def server_ready() -> bool:
    """dev server 是否就绪（能返回登录页即可，数据库由应用运行时验证）"""
    try:
        with _NO_PROXY_OPENER.open(APP_URL + "/login", timeout=15) as r:
            return r.status == 200
    except Exception:
        return False


def clear_next_cache():
    """清 .next 构建缓存（Turbopack 缓存损坏时 dev 会反复崩溃）"""
    cache = os.path.join(PROJECT_DIR, ".next")
    try:
        if os.path.isdir(cache):
            import shutil
            shutil.rmtree(cache, ignore_errors=True)
            log("已清理 .next 构建缓存（Turbopack 损坏恢复）")
    except Exception as e:
        log(f"清理 .next 失败：{e}")


def launch_dev() -> subprocess.Popen:
    """
    启动 dev server（后台、无窗口、日志落盘）。
    关键：清理 safe-delete shim 注入的环境变量——
    NODE_OPTIONS 携带 shim 时 Turbopack 的 CSS 子进程会崩溃（本项目已知坑）。
    """
    env = os.environ.copy()
    for var in ("NODE_OPTIONS",
                "CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR",
                "CODEBUDDY_TOOL_CALL_ID",
                "CODEBUDDY_SAFE_DELETE_BULK_GUARD"):
        env.pop(var, None)

    logfile = open(os.path.join(PROJECT_DIR, "meridian-dev.log"), "a", encoding="utf-8")
    # npm 是 .cmd（Windows），用 cmd /c 执行以继承系统 PATH
    proc = subprocess.Popen(
        ["cmd", "/c", "npm run dev"],
        cwd=PROJECT_DIR,
        env=env,
        stdout=logfile,
        stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW,
    )
    # PID 文件（防重复的辅助手段；主判断仍是端口检测）
    try:
        with open(PID_FILE, "w", encoding="utf-8") as f:
            f.write(str(proc.pid))
    except OSError:
        pass
    return proc


def wait_ready(proc: subprocess.Popen) -> bool:
    """轮询就绪：页面 200 即成功；进程提前退出即失败。返回是否就绪"""
    deadline = time.time() + MAX_WAIT_SEC
    while time.time() < deadline:
        if server_ready():
            return True
        if proc.poll() is not None:  # dev 进程已退出 = 启动失败
            log(f"dev 进程提前退出（exit={proc.poll()}），启动失败")
            return False
        time.sleep(3)
    log(f"等待超时（{MAX_WAIT_SEC}s）——页面仍未就绪")
    return False


def read_log_tail(n: int = 15) -> str:
    """读取 dev 日志尾部（用于失败诊断）"""
    try:
        with open(os.path.join(PROJECT_DIR, "meridian-dev.log"), "r", encoding="utf-8") as f:
            lines = f.readlines()
        return "".join(lines[-n:])
    except OSError:
        return "(无法读取 dev 日志)"


def main():
    log("========== Meridian 启动器 ==========")
    log(f"项目目录：{PROJECT_DIR}  访问地址：{APP_URL}")
    if not os.path.isfile(os.path.join(PROJECT_DIR, "package.json")):
        msg = f"未找到项目文件 package.json，请核对启动器中的 PROJECT_DIR（当前：{PROJECT_DIR}）"
        log("错误：" + msg)
        notify("Meridian 启动失败", msg)
        return

    # ── 场景 1：端口已占用 ──
    if port_open(PORT):
        if is_meridian_server():
            log("检测到 Meridian dev server 已在运行 → 直接打开浏览器（不重复启动）")
            if not NO_BROWSER:
                webbrowser.open(APP_URL)
            notify("Meridian 已在运行", f"开发服务器已就绪，浏览器已打开：\n{APP_URL}")
            return
        log("端口 3000 被其他程序占用（非 Meridian）")
        notify("Meridian 启动失败",
               f"端口 {PORT} 已被其他程序占用，无法启动。\n请先关闭占用程序（详见日志 {LOG_FILE}）")
        return

    # ── 场景 2：端口空闲 → 启动 dev ──
    log("端口空闲 → 启动 dev server（首次编译约 30~120 秒，日志见 meridian-dev.log）")
    proc = launch_dev()

    for attempt in range(CLEAR_CACHE_RETRY + 1):
        if wait_ready(proc):
            log("✅ dev server 就绪")
            if not NO_BROWSER:
                webbrowser.open(APP_URL)
            notify("Meridian 已启动",
                   f"开发服务器就绪，浏览器已打开：\n{APP_URL}\n\n（数据库为云端 Neon，无需本地启动）")
            return
        # 启动失败：诊断 + 清缓存重试
        tail = read_log_tail()
        log(f"启动失败诊断（第 {attempt + 1} 轮）：\n{tail}")
        if attempt < CLEAR_CACHE_RETRY:
            clear_next_cache()
            log("清缓存后重新启动…")
            proc = launch_dev()
        else:
            break

    msg = ("dev server 启动失败，请查看日志：\n"
           f"  服务日志：{os.path.join(PROJECT_DIR, 'meridian-dev.log')}\n"
           f"  启动器日志：{LOG_FILE}")
    log("最终失败：" + msg)
    notify("Meridian 启动失败", msg)


if __name__ == "__main__":
    main()
