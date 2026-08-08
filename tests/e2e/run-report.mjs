#!/usr/bin/env node
/**
 * E2E 测试报告生成器：读取 Playwright JSON reporter 输出（e2e-results/results.json），
 * 生成 Markdown 报告（e2e-results/report.md），包含：
 *   - 汇总：总用例数 / 通过 / 失败 / 跳过 / 通过率 / 总耗时
 *   - 明细表：用例名称、状态、失败原因、耗时（按模块分组）
 *   - 失败用例详情（error 消息 + 堆栈首行）
 *
 * 用法：npm run test:e2e:report （在 test:e2e 之后运行）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const RESULTS = path.join(ROOT, "e2e-results", "results.json");
const REPORT = path.join(ROOT, "e2e-results", "report.md");

if (!fs.existsSync(RESULTS)) {
  console.error(`[report] 未找到 ${RESULTS}，请先运行 npm run test:e2e`);
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(RESULTS, "utf-8"));
const suites = Array.isArray(json) ? json : json.suites ?? [];
if (!Array.isArray(suites)) {
  console.error("[report] results.json 结构无法解析（可能为空运行）");
  process.exit(1);
}

// ── 展平所有用例（按模块/suite 分组） ──
function collectSuites(node) {
  const out = [];
  const stack = [node];
  while (stack.length) {
    const cur = stack.pop();
    out.push(cur);
    if (Array.isArray(cur.suites)) for (const s of cur.suites) stack.push(s);
  }
  return out;
}
const allSuites = collectSuites(json).filter((s) => Array.isArray(s.specs) && s.specs.length > 0);

const rows = [];
for (const suite of allSuites) {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      for (const r of t.results ?? []) {
        rows.push({
          module: suite.title ?? "",
          title: spec.title,
          status: r.status ?? "unknown",
          duration: r.duration ?? 0,
          error: r.error?.message ?? "",
        });
      }
    }
  }
}

// ── 统计 ──
const statusCount = { passed: 0, failed: 0, skipped: 0, timedOut: 0, interrupted: 0, unknown: 0 };
for (const r of rows) {
  statusCount[r.status] = (statusCount[r.status] ?? 0) + 1;
}
const total = rows.length;
const passed = statusCount.passed;
const failed = statusCount.failed + statusCount.timedOut;
const skipped = statusCount.skipped;
const rate = total - skipped > 0 ? ((passed / (total - skipped)) * 100).toFixed(1) : "100.0";
const totalMs = rows.reduce((s, r) => s + r.duration, 0);

// ── 按模块分组渲染 ──
const moduleOrder = [...new Set(rows.map((r) => r.module))];
const lines = [];
lines.push(`# Meridian E2E 自动化测试报告`);
lines.push(``);
lines.push(`> 生成时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
lines.push(``);
lines.push(`## 汇总`);
lines.push(``);
lines.push(`| 指标 | 数值 |`);
lines.push(`| --- | --- |`);
lines.push(`| 总用例数 | ${total} |`);
lines.push(`| 通过 | ✅ ${passed} |`);
lines.push(`| 失败 | ❌ ${failed} |`);
lines.push(`| 跳过 | ⏭ ${skipped} |`);
lines.push(`| 通过率（不含跳过） | **${rate}%** |`);
lines.push(`| 总耗时 | ${(totalMs / 1000).toFixed(1)}s |`);
lines.push(``);

for (const mod of moduleOrder) {
  const modRows = rows.filter((r) => r.module === mod);
  const modPass = modRows.filter((r) => r.status === "passed").length;
  const modFail = modRows.filter((r) => r.status === "failed" || r.status === "timedOut").length;
  lines.push(`## ${mod}（${modPass} 通过 / ${modFail} 失败）`);
  lines.push(``);
  lines.push(`| 用例 | 状态 | 耗时 | 失败原因 |`);
  lines.push(`| --- | --- | --- | --- |`);
  for (const r of modRows) {
    const icon = r.status === "passed" ? "✅" : r.status === "skipped" ? "⏭" : "❌";
    const err = r.error ? r.error.split("\n")[0].slice(0, 120) : "";
    lines.push(`| ${r.title} | ${icon} ${r.status} | ${(r.duration / 1000).toFixed(1)}s | ${err} |`);
  }
  lines.push(``);
}

// 失败详情
const failRows = rows.filter((r) => r.status === "failed" || r.status === "timedOut");
if (failRows.length > 0) {
  lines.push(`## 失败用例详情`);
  lines.push(``);
  for (const r of failRows) {
    lines.push(`### ❌ ${r.module} › ${r.title}`);
    lines.push(``);
    lines.push(`**耗时**：${(r.duration / 1000).toFixed(1)}s`);
    lines.push(``);
    lines.push("```");
    lines.push(r.error.split("\n").slice(0, 25).join("\n"));
    lines.push("```");
    lines.push(``);
  }
}

fs.writeFileSync(REPORT, lines.join("\n"), "utf-8");
console.log(`[report] 已生成: ${REPORT}`);
console.log(`[report] 通过 ${passed}/${total - skipped}（跳过 ${skipped}），通过率 ${rate}%`);
