#!/usr/bin/env node
/**
 * E2E 测试后台运行器（无头模式 + 中断自检 + 自动重启）
 *
 * 解决的问题（测试规范）：
 *   1. 后台执行不抢占前台焦点：Chromium 以 headless（无头）模式运行，无窗口弹跳
 *   2. 鼠标操作/外部干扰导致中断时自动重启：检测到非正常退出（无完整结果/信号终止），
 *      自动重新启动同一测试流程，直至成功产出结果或达到最大重试次数
 *
 * 用法：
 *   npm run test:e2e:bg        # 后台运行（日志见 e2e-results/run-<时间戳>.log）
 *   npm run test:e2e:stop      # 停止（杀进程）
 *
 * 环境变量（可选）：
 *   E2E_MAX_RETRY   最大重启次数（默认 3）
 *   E2E_RETRY_DELAY 重启间隔毫秒（默认 10000）
 *   E2E_HEADED=1    有头模式（调试用，默认无头）
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const require = createRequire(import.meta.url);

const MAX_RETRY = Number(process.env.E2E_MAX_RETRY ?? 3);
const RETRY_DELAY = Number(process.env.E2E_RETRY_DELAY ?? 10_000);
const HEADED = process.env.E2E_HEADED === "1";
const PID_FILE = path.join(ROOT, ".e2e", "runner.pid");
const RESULTS = path.join(ROOT, "e2e-results", "results.json");

fs.mkdirSync(path.join(ROOT, "e2e-results"), { recursive: true });
fs.mkdirSync(path.join(ROOT, ".e2e"), { recursive: true });

const logFile = path.join(ROOT, "e2e-results", `run-${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
const log = (msg) => {
  const line = `[${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}] ${msg}`;
  fs.appendFileSync(logFile, line + "\n");
  console.log(line);
};

// 记录自身 PID（供 stop-e2e.mjs 停止）
fs.writeFileSync(PID_FILE, String(process.pid), "utf-8");
log(`运行器启动 pid=${process.pid} ｜ 日志: ${logFile} ｜ 无头=${!HEADED} ｜ 最大重启=${MAX_RETRY}`);

// 找到 playwright CLI 入口（跨平台，不依赖 npx）
let cli;
try {
  cli = require.resolve("@playwright/test/cli");
} catch {
  log("✗ 未找到 @playwright/test，请先执行 npm install");
  process.exit(1);
}

/**
 * 判断本轮是否产出了完整测试结果：
 * results.json 存在、结构为 {suites:[...]} 且非空、且 mtime 在本轮启动之后。
 * （严格校验，避免把空对象/旧结果误判为正常完成）
 */
function hasCompleteResult(startTime) {
  try {
    const st = fs.statSync(RESULTS);
    if (st.mtimeMs < startTime) return false; // 旧结果
    const json = JSON.parse(fs.readFileSync(RESULTS, "utf-8"));
    return Array.isArray(json.suites) && json.suites.length > 0;
  } catch {
    return false;
  }
}

/** 启动一轮 Playwright 测试；resolve(exitCode) */
function runOnce(attempt) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    log(`── 第 ${attempt} 轮启动 ──`);

    const args = [cli, "test", "-c", "tests/e2e/playwright.config.ts"];
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env, E2E_HEADED: HEADED ? "1" : "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true, // 不弹 Windows 控制台窗口
    });

    child.stdout.on("data", (d) => {
      const s = d.toString();
      fs.appendFileSync(logFile, s);
      process.stdout.write(s);
    });
    child.stderr.on("data", (d) => {
      const s = d.toString();
      fs.appendFileSync(logFile, s);
      process.stderr.write(s);
    });
    child.on("error", (err) => {
      log(`✗ 启动失败: ${err.message}`);
      resolve(-1);
    });
    child.on("close", (code, signal) => {
      log(`第 ${attempt} 轮结束 exit=${code} signal=${signal ?? "无"}`);
      resolve({ code: code ?? (signal ? -1 : 0), startTime });
    });
  });
}

/** 判断本轮退出是否为"正常完成"（无论用例通过/失败，只要有完整结果即可） */
function isNormalCompletion(exitCode, startTime) {
  if (exitCode === 0) return true;            // 全过
  if (hasCompleteResult(startTime)) return true; // 有完整结果（含失败用例）→ 正常结束
  return false;                                // 无结果/信号终止 → 中断
}

async function main() {
  let attempt = 0;
  while (attempt <= MAX_RETRY) {
    attempt += 1;
    const { code, startTime } = await runOnce(attempt);

    if (isNormalCompletion(code, startTime)) {
      log(`✓ 测试流程正常结束（exit=${code}）`);
      if (code !== 0) {
        log(`⚠ 存在失败用例，请查看 e2e-results/report.md 与 playwright-report/`);
      }
      log(`运行器结束。生成报告: npm run test:e2e:report`);
      process.exit(code === 0 ? 0 : 1);
    }

    // ── 中断 → 自动重启 ──
    log(`⚠ 第 ${attempt} 轮中断（exit=${code}），判定为外部干扰/进程异常`);
    if (attempt > MAX_RETRY) {
      log(`✗ 已达最大重启次数（${MAX_RETRY}），放弃。请人工检查 e2e-results/run-*.log`);
      process.exit(2);
    }
    log(`  等待 ${RETRY_DELAY / 1000}s 后自动重启…（Ctrl+C 或 npm run test:e2e:stop 可终止）`);
    await new Promise((r) => setTimeout(r, RETRY_DELAY));
  }
}

// 优雅处理 SIGINT/SIGTERM（退出时不清文件，避免触发删除保护；pid 文件由下次运行覆盖）
process.on("SIGINT", () => {
  log("收到 SIGINT，运行器退出（测试子进程一并结束）");
  process.exit(130);
});
process.on("SIGTERM", () => {
  log("收到 SIGTERM，运行器退出");
  process.exit(143);
});

main().catch((err) => {
  log(`✗ 运行器异常: ${err.message}`);
  process.exit(1);
});
