/**
 * Meridian · 前端 E2E 自动化测试配置（Playwright）
 *
 * 运行方式（统一入口）：
 *   npm run test:e2e            # 全量按序执行（workers=1，01→10 模块串行）
 *   npm run test:e2e:open       # 打开 HTML 报告
 *   npm run test:e2e:report     # 生成 Markdown 测试报告（e2e-results/report.md）
 *
 * 环境前提：
 *   - 本地 dev server 已在 3000 端口运行（reuseExistingServer 自动复用），
 *     或由 webServer 自动启动 `npm run dev`
 *   - 数据库为本地 PostgreSQL（.env 的 DATABASE_URL），测试使用真实业务 API
 *
 * 设计要点：
 *   - workers=1 + fullyParallel=false：保证 01→10 模块按序执行、数据互不干扰
 *   - global-setup：注册并登录"主测试用户"，storageState 全局复用；
 *     每次运行生成新用户（时间戳邮箱），数据天然隔离、可重复运行
 *   - 01-auth / 10-account 使用独立临时用户，不污染主用户
 */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import "dotenv/config"; // 加载 .env（DEEPSEEK_API_KEY 等，供 global-setup 使用）

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./modules",
  globalSetup: "./global-setup.ts",
  globalTeardown: undefined,

  // 串行执行（模块间有数据先后依赖）
  fullyParallel: false,
  workers: 1,

  timeout: 60_000,
  expect: { timeout: 15_000 },
  // 全量环境下 Neon 网络偶发波动（ECONNRESET/写操作超时）→ 失败自动重试 1 次
  retries: 1,

  // 产物目录：动态时间戳子目录（避免 Playwright 清空固定目录触发文件批量删除保护）
  outputDir: path.join(__dirname, "..", "..", "e2e-results", `run-${Date.now()}`),

  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(__dirname, "..", "..", "playwright-report"), open: "never" }],
    ["json", { outputFile: path.join(__dirname, "..", "..", "e2e-results", "results.json") }],
  ],

  use: {
    baseURL: BASE_URL,
    // 主测试用户登录态（global-setup 生成）
    storageState: path.join(__dirname, "..", "..", ".e2e", "state", "main.json"),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
