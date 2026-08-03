/**
 * V3 信息架构一次性迁移脚本（任务信息架构规范 V3 §4.2）
 *
 * 5 步：
 *   1. category='competition' → category='practice' + theme='竞赛'（决策 D8）
 *   2. 标题含明确「考研」语义的 learning 任务 → theme='考研'
 *      ※ 保守规则（对齐审查结论 §1.5.5 + 产品红线「AI 不强猜」）：
 *        仅匹配标题明确出现「考研」；「数学/英语/政治/专业课」单独出现不判
 *        （那些多半是课程任务，误判会污染主题统计）
 *   3. 剥离 tags 中 domain:* / theme:* / important:* 系统前缀；
 *      theme:* 的值回填 theme 字段（若为空）——旧标签迁移到新字段
 *   4. 校验：无 competition 残留、无系统前缀残留
 *   5. （校验无死字段写入 —— schema 已删字段，由 migrate 保证）
 *
 * Usage:
 *   npx tsx scripts/v3-theme-migration.ts          # 执行
 *   npx tsx scripts/v3-theme-migration.ts --dry-run # 预览不改
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const SYSTEM_TAG_PREFIXES = ["domain:", "theme:", "important:"];
const KAOYAN_RE = /考研/;

interface Counters {
  competitionMigrated: number;
  kaoyanTheme: number;
  tagsStripped: number;
  themeFromTag: number;
}

async function main() {
  if (dryRun) console.log("🔍 DRY RUN — 只预览，不写入\n");
  else console.log("🚀 V3 迁移执行中…\n");

  const counters: Counters = { competitionMigrated: 0, kaoyanTheme: 0, tagsStripped: 0, themeFromTag: 0 };

  // ── Step 1: competition → practice + theme:竞赛（决策 D8） ──
  const compTasks = await prisma.task.findMany({
    where: { category: "competition" },
    select: { id: true, title: true, theme: true },
  });
  for (const t of compTasks) {
    counters.competitionMigrated++;
    if (dryRun) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: { category: "practice", ...(t.theme ? {} : { theme: "竞赛" }) },
    });
  }

  // ── Step 2: 明确「考研」语义 → theme:考研（保守规则，仅限 learning） ──
  const learningTasks = await prisma.task.findMany({
    where: { category: "learning", theme: null },
    select: { id: true, title: true },
  });
  for (const t of learningTasks) {
    if (KAOYAN_RE.test(t.title)) {
      counters.kaoyanTheme++;
      if (!dryRun) await prisma.task.update({ where: { id: t.id }, data: { theme: "考研" } });
    }
  }

  // ── Step 3: 剥离 tags 系统前缀；theme:* 回填 theme 字段 ──
  const taggedTasks = await prisma.task.findMany({
    where: { tags: { not: null } },
    select: { id: true, tags: true, theme: true, category: true },
  });
  for (const t of taggedTasks) {
    const parts = (t.tags || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) continue;

    const kept: string[] = [];
    let themeFromTag: string | null = null;
    let stripped = false;
    for (const tag of parts) {
      if (SYSTEM_TAG_PREFIXES.some((p) => tag.startsWith(p))) {
        stripped = true;
        if (tag.startsWith("theme:") && tag.length > 6) themeFromTag = tag.slice(6).trim() || null;
        continue;
      }
      kept.push(tag);
    }
    if (!stripped) continue; // 无系统前缀，跳过

    counters.tagsStripped++;
    if (dryRun) continue;

    const data: Record<string, unknown> = { tags: kept.join(",") || null };
    if (themeFromTag && !t.theme) {
      data.theme = themeFromTag;
      counters.themeFromTag++;
    }
    await prisma.task.update({ where: { id: t.id }, data });
  }

  // ── Step 4: 校验 ──
  const [compLeft, prefixLeft] = await Promise.all([
    prisma.task.count({ where: { category: "competition" } }),
    prisma.task.count({ where: { tags: { contains: "domain:" } } }),
  ]);
  const themeCount = await prisma.task.count({ where: { theme: { not: null } } });

  console.log("── 迁移结果 ──");
  console.log(`competition → practice+主题竞赛 : ${counters.competitionMigrated} 条`);
  console.log(`learning 标题含「考研」→ 主题考研 : ${counters.kaoyanTheme} 条`);
  console.log(`剥离系统前缀标签 : ${counters.tagsStripped} 条（theme:* 回填 ${counters.themeFromTag} 条）`);
  console.log(`校验：competition 残留 ${compLeft} 条 · domain: 前缀残留 ${prefixLeft} 条`);
  console.log(`当前有主题的任务共 ${themeCount} 条`);
  if (!dryRun && (compLeft > 0 || prefixLeft > 0)) {
    console.error("⚠️ 校验未通过：仍有残留，请人工检查！");
    process.exitCode = 1;
  }
  if (dryRun) console.log("\n（dry-run 结束，未写入任何数据）");
}

main()
  .catch((e) => { console.error("迁移失败:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
