@echo off
chcp 65001 >nul
title Meridian 本地启动器
setlocal

REM ══════════════ 配置区（按需修改） ══════════════
set "PROJECT_DIR=F:\Meridian"
set "APP_URL=http://localhost:3000"
set "PORT=3000"
REM ═══════════════════════════════════════════════

REM 防重复：端口已被监听 → 直接开浏览器
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [INFO] 检测到端口 %PORT% 已监听，直接打开浏览器（不重复启动）
    start "" "%APP_URL%"
    exit /b 0
)

echo [INFO] 端口 %PORT% 空闲，正在启动 Meridian dev server...
cd /d "%PROJECT_DIR%"

REM 关键：清理 safe-delete shim 注入的环境变量（否则 Turbopack CSS 子进程崩溃）
set "NODE_OPTIONS="
set "CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR="
set "CODEBUDDY_TOOL_CALL_ID="
set "CODEBUDDY_SAFE_DELETE_BULK_GUARD="

REM 后台启动 dev（独立窗口，日志落盘 meridian-dev.log）
start "Meridian Dev" cmd /k "npm run dev >> meridian-dev.log 2>&1"

echo [INFO] 等待服务就绪（首次编译约 30~120 秒）...
set /a tries=0
:wait_loop
timeout /t 5 /nobreak >nul
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 goto ready
set /a tries+=1
if %tries% geq 60 (
    echo [ERROR] 等待超时（5 分钟），dev server 未就绪。请查看 meridian-dev.log 或尝试删除 .next 目录后重试。
    pause
    exit /b 1
)
echo [INFO] 仍在启动中...（%tries%0/60 轮）
goto wait_loop

:ready
echo [INFO] ✅ dev server 已就绪，正在打开浏览器...
start "" "%APP_URL%"
echo [INFO] 完成。关闭本窗口不影响服务运行（日志：meridian-dev.log）
timeout /t 5 /nobreak >nul
exit /b 0
