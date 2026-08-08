#!/usr/bin/env node
/**
 * 停止后台 E2E 运行器（含其派生的 Playwright 测试进程树）。
 * 用法：npm run test:e2e:stop
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const PID_FILE = path.join(ROOT, ".e2e", "runner.pid");

if (!fs.existsSync(PID_FILE)) {
  console.log("[stop] 运行器未在运行（无 pid 文件）");
  process.exit(0);
}

const pid = Number(fs.readFileSync(PID_FILE, "utf-8").trim());
if (!Number.isInteger(pid) || pid <= 0) {
  console.log(`[stop] pid 文件内容无效（${pid}），忽略（下次运行自动覆盖）`);
  process.exit(0);
}

try {
  if (process.platform === "win32") {
    // Windows：杀掉进程树（含子进程 Playwright）
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "pipe" });
  } else {
    try {
      process.kill(-pid, "SIGTERM"); // 进程组
    } catch {
      process.kill(pid, "SIGTERM");
    }
  }
  console.log(`[stop] 已发送终止信号 pid=${pid}（含子进程树）`);
} catch (err) {
  // 进程可能已不在
  console.log(`[stop] 进程可能已退出（${err.message.split("\n")[0]}）`);
}

// 不清除 pid 文件（避免触发删除保护），下次运行自动覆盖
console.log("[stop] 完成（pid 文件由下次运行自动覆盖）");
