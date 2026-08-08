/**
 * 通用辅助：时间工具 + UI 操作辅助（供各模块 spec 复用）
 */
import { expect, type Page } from "@playwright/test";

/* ─────────────── 时间工具（本地时区，与页面一致） ─────────────── */

const pad = (n: number) => String(n).padStart(2, "0");

/** 本地日期 YYYY-MM-DD */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 相对今天偏移 offset 天的日期字符串（offset 可为负） */
export function dateOffset(offset: number, base: Date = new Date()): string {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return localDateStr(d);
}

/** 今天 HH:MM（可偏移分钟） */
export function nowHM(offsetMinutes = 0): string {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 本周一 0 点 Date */
export function thisMonday(): Date {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 给本地日期字符串加 N 天 */
export function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return localDateStr(dt);
}

/** 组合日期+时间 → ISO（本地时区） */
export function toLocalISO(dateStr: string, hm: string): string {
  const d = new Date(`${dateStr}T${hm}:00`);
  return d.toISOString();
}

/* ─────────────── 用户凭据 ─────────────── */

export interface Credentials {
  email: string;
  password: string;
  nickname: string;
}

export function readMainCredentials(): Credentials {
  const fs = require("node:fs");
  const path = require("node:path");
  const p = path.join(process.cwd(), ".e2e", "state", "credentials.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Credentials;
}

/* ─────────────── UI 操作辅助 ─────────────── */

/** 通过侧栏导航进入指定页面（工作流五页 + 设置） */
export async function gotoNav(page: Page, key: "inbox" | "plan" | "today" | "review" | "projects" | "settings") {
  const LABEL: Record<string, string> = {
    inbox: "收纳",
    plan: "蓝图",
    today: "此刻",
    review: "复盘",
    projects: "项目",
    settings: "设置",
  };
  // Playwright 每个用例是全新 context（起始 about:blank），必须先进入 Dashboard 壳
  // 否则侧栏不存在，getByRole('link') 会等到超时
  const url = page.url();
  const isInShell = !url.startsWith("about:") && !/\/login|\/register/.test(url);
  if (!isInShell) {
    await page.goto("/today", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/today", { timeout: 30_000 });
  }
  await page.getByRole("link", { name: LABEL[key] }).first().click();
  await page.waitForURL(`**/${key}`);
  // 注意：不要等 networkidle —— Next.js dev 的 HMR websocket 长连接使 networkidle 永不满足，
  // 会白白消耗 30s。改用 DOM ready 即可（页面数据断言交给各用例的 expect 轮询）。
  await page.waitForLoadState("domcontentloaded");
}

/** 等待 toast 出现（含指定文本） */
export async function expectToast(page: Page, text: string) {
  await expect(page.locator("[class*='toast'], [class*='Toast']").filter({ hasText: text }).first()).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * 定位 Inbox 整理卡片：
 * - 传 title：同时包含标题文本与操作按钮的最外层 div（卡片本体）
 * - 不传 title：结果区内最后一张"简单卡"（含精确"确认"按钮的 div）
 * 用 .first()（标题模式）取最外层容器；.last()（无标题模式）取最后一张卡。
 * 说明：AI 解析（LLM）可能改写标题，无标题模式用于无法按原标题匹配的场景。
 */
export function findInboxCard(page: Page, title?: string) {
  let loc = page
    .locator("div")
    .filter({ has: page.getByRole("button", { name: "确认", exact: true }) });
  if (title) loc = loc.filter({ hasText: title });
  return title ? loc.first() : loc.last();
}

/** 定位 Inbox 复杂卡（含"确认创建 N 个子任务"按钮的 div） */
export function findComplexCard(page: Page, title?: string) {
  let loc = page.locator("div").filter({ has: page.getByRole("button", { name: /确认创建 \d+ 个子任务/ }) });
  if (title) loc = loc.filter({ hasText: title });
  return title ? loc.first() : loc.last();
}

/** 等待 Inbox AI 整理结果出现（AI 慢/超时降级双路径，最长 60s） */
export async function expectInboxResult(page: Page) {
  await expect(
    page.locator("text=/AI 整理结果|根据关键词降级解析|关键词降级/").first(),
  ).toBeVisible({ timeout: 60_000 });
}

/**
 * 展开设置页折叠卡（默认只开第一组"账户与资料"，其余折叠）。
 * probeText 为卡内特有内容，用于判断是否已展开；未展开则点击卡头按钮。
 * 卡头按钮 = 可访问名包含卡片标题的 button（Card 组件头部标题+描述在一个 button 内）。
 */
export async function expandSettingsCard(page: Page, title: string, probeText: string) {
  const headBtn = page.getByRole("button", { name: title }).first();
  const probe = page.locator(`text=${probeText}`).first();
  if (!(await probe.isVisible({ timeout: 3_000 }).catch(() => false))) {
    await headBtn.click();
  }
  await expect(probe).toBeVisible({ timeout: 10_000 });
}

/** 注册一个一次性用户（返回邮箱），已在注册页之外调用时自动导航 */
export async function registerTempUser(page: Page): Promise<string> {
  const email = `e2e-tmp-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.local`;
  await page.goto("/register");
  await page.getByPlaceholder("你的昵称").fill("E2E临时用户");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("至少 6 位").fill("TempPassw0rd!");
  await page.getByRole("button", { name: "开始我的子午" }).click();
  await page.waitForURL("**/login");
  return email;
}

/**
 * 拖拽到 Plan 天列（HTML5 DnD 协议）：
 * - sourceText: 收集箱/任务块的标题文本（用于定位可拖拽元素）
 * - colIndex: 天列序号（0 = 周起始列；聚焦模式 0 = 今天）
 * - hour: 目标小时（支持 .5 半小时）
 *
 * 实现说明（BUG-20260807-015/018/019/020）：
 * 1. mouse 模拟不触发 HTML5 drag；Playwright dragTo 的 DataTransfer 在 React
 *    合成事件下不可靠（apply-decision 未发出）。
 * 2. 关键：`.plan-week-col` 前 7 个是【周标题头】（plan-week-hd，无 onDrop），
 *    真正天列从第 8 个起 → 选择器必须排除 plan-week-hd。
 * 3. 最终方案：page.evaluate 内用原生 DragEvent 构造事件链（dragstart 时
 *    React onDragStart 向 DataTransfer 写入 task-id；drop 的 clientY 计算小时）。
 */
export async function dragToPlanColumn(page: Page, sourceText: string, colIndex: number, hour: number, { columnSel = ".plan-week-col:not(.plan-week-hd)" } = {}) {
  await expect(page.locator(`text=${sourceText}`).first()).toBeVisible();

  const cols = page.locator(columnSel);
  const n = await cols.count();
  if (colIndex >= n) throw new Error(`天列不存在: index=${colIndex}, count=${n}`);
  const cb = await cols.nth(colIndex).boundingBox();
  if (!cb) throw new Error("天列无 boundingBox");

  // 时间轴起点 8:00（S=8），每小时高度 = 列高/16h 近似
  const S = 8;
  const H = cb.height / 16;
  const clientY = Math.round(cb.y + Math.max(0, Math.min(16, hour - S)) * H + 4);
  const clientX = Math.round(cb.x + cb.width / 2);

  const result = await page.evaluate(
    async ({ text, colSel, colIndex, clientX, clientY }) => {
      // 定位含该文本的可拖拽元素（收集箱项 draggable）
      const all = Array.from(document.querySelectorAll<HTMLElement>("[draggable='true'], [draggable]"));
      const src = all.find((el) => el.textContent?.includes(text) && el.offsetParent !== null);
      const col = document.querySelectorAll<HTMLElement>(colSel)[colIndex];
      if (!src || !col) return { ok: false, reason: "source-or-col-not-found" };
      const dt = new DataTransfer();
      src.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }));
      const taskId = dt.getData("text/task-id");
      if (!taskId) return { ok: false, reason: "dragstart-setData-empty" };
      col.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true, clientX, clientY }));
      await new Promise((r) => setTimeout(r, 40)); // 等 React setDragOverDay re-render（验证用）
      const ringSet = col.className.includes("ring-2");
      col.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX, clientY }));
      return { ok: true, ringSet };
    },
    { text: sourceText, colSel: columnSel, colIndex, clientX, clientY },
  );
  if (!result?.ok) {
    throw new Error(`拖拽事件链未完整执行（${result?.reason ?? "未知"}）: ${sourceText}`);
  }
  if (result.ringSet === false) {
    throw new Error(`拖拽 dragover 未生效（React 事件未到达天列）: ${sourceText}`);
  }
}
