/**
 * Cleanup historical duplicate Schedule records.
 *
 * Design rule: one active Task → one valid Schedule.
 * Historical duplicates existed before transaction-safe moveSchedule was implemented.
 *
 * Usage:
 *   npx tsx scripts/cleanup-schedules.ts          # execute cleanup
 *   npx tsx scripts/cleanup-schedules.ts --dry-run # preview only
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("🔍 DRY RUN MODE — no data will be deleted\n");

  const tasks = await prisma.task.findMany({
    select: { id: true, title: true, status: true },
  });

  let cleaned = 0;
  let skipped = 0;

  for (const task of tasks) {
    const schedules = await prisma.schedule.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: "desc" },
    });

    if (schedules.length <= 1) {
      skipped++;
      continue;
    }

    console.log(`\n📋 Task: ${task.title} (${task.id.slice(0, 8)}...)`);
    console.log(`   Before: ${schedules.length} schedules`);

    const keep = schedules[0];
    const remove = schedules.slice(1);

    console.log(`   Keep:  ${keep.id.slice(0, 8)}... start=${keep.scheduledStart.toISOString().slice(0, 16)} source=${keep.source}`);
    for (const r of remove) {
      console.log(`   Delete: ${r.id.slice(0, 8)}... start=${r.scheduledStart.toISOString().slice(0, 16)} source=${r.source}`);
    }

    if (!dryRun) {
      for (const r of remove) {
        await prisma.schedule.delete({ where: { id: r.id } });
      }
    }

    cleaned++;
  }

  if (dryRun) {
    console.log(`\n🔄 Would clean ${cleaned} tasks, skip ${skipped} tasks`);
  } else {
    console.log(`\n✅ Cleaned ${cleaned} tasks, skipped ${skipped} tasks`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
