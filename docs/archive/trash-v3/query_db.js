const { PrismaClient } = require('./node_modules/@prisma/client');
const path = require('path');
const p = new PrismaClient({ datasources: { db: { url: 'file:' + path.join(__dirname, '..', 'prisma', 'dev.db') } } });

async function main() {
  const logs = await p.decisionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log('=== DECISION LOGS ===');
  for (const l of logs) {
    console.log('\n[' + l.createdAt.toISOString() + '] action=' + l.action);
    console.log('reasoning: ' + (l.reasoning || '(none)'));
    try {
      const d = JSON.parse(l.actionDetail);
      if (d.toolCalls && d.toolCalls.length > 0) {
        console.log('toolCalls:');
        for (const tc of d.toolCalls) {
          const info = tc.data ? JSON.stringify(tc.data).slice(0, 250) : tc.error;
          console.log('  ' + tc.tool + ': success=' + tc.success + ' ' + info);
        }
      }
      if (d.stateUpdates && d.stateUpdates.length > 0) {
        console.log('stateUpdates:', JSON.stringify(d.stateUpdates).slice(0, 200));
      }
      if (d.memorySaves && d.memorySaves.length > 0) {
        console.log('memorySaves:', JSON.stringify(d.memorySaves).slice(0, 200));
      }
    } catch(e) {
      console.log('detail:', l.actionDetail.slice(0, 300));
    }
  }

  const tasks = await p.task.findMany({ orderBy: { createdAt: 'desc' } });
  console.log('\n=== ALL TASKS (' + tasks.length + ') ===');
  for (const t of tasks) {
    console.log('[' + t.id.slice(0, 8) + '] "' + t.title + '" type=' + t.taskType + ' status=' + t.status + ' imp=' + t.importance + ' start=' + (t.startTime ? t.startTime.toISOString() : 'null') + ' end=' + (t.endTime ? t.endTime.toISOString() : 'null') + ' deadline=' + (t.deadline ? t.deadline.toISOString() : 'null') + ' est=' + (t.estimatedMinutes || 'null') + 'm parent=' + (t.parentId ? t.parentId.slice(0, 8) : 'null'));
  }

  const scheds = await p.schedule.findMany({ orderBy: { createdAt: 'desc' } });
  console.log('\n=== ALL SCHEDULES (' + scheds.length + ') ===');
  for (const s of scheds) {
    console.log('[sched ' + s.id.slice(0, 8) + '] taskId=' + s.taskId.slice(0, 8) + ' start=' + s.scheduledStart.toISOString() + ' end=' + (s.scheduledEnd ? s.scheduledEnd.toISOString() : 'null') + ' source=' + s.source);
  }

  const sIds = new Set(scheds.map(function(s) { return s.taskId; }));
  const orphans = tasks.filter(function(t) { return !sIds.has(t.id) && t.status !== 'completed' && t.status !== 'cancelled'; });
  console.log('\n=== TASKS WITHOUT SCHEDULE (' + orphans.length + ') ===');
  for (const t of orphans) {
    console.log('[ORPHAN] "' + t.title + '" type=' + t.taskType + ' status=' + t.status);
  }

  const scheduledTypeNoEntry = tasks.filter(function(t) { return t.taskType === 'scheduled' && !sIds.has(t.id) && t.status !== 'completed' && t.status !== 'cancelled'; });
  console.log('\n=== SCHEDULED TYPE BUT NO SCHEDULE ENTRY (' + scheduledTypeNoEntry.length + ') ===');
  for (const t of scheduledTypeNoEntry) {
    console.log('[INCONSISTENT] "' + t.title + '"');
  }

  const dup = {};
  for (const s of scheds) {
    if (!dup[s.taskId]) dup[s.taskId] = [];
    dup[s.taskId].push(s);
  }
  const dups = Object.entries(dup).filter(function(e) { return e[1].length > 1; });
  console.log('\n=== MULTIPLE SCHEDULES PER TASK: ' + dups.length + ' ===');
  for (const entry of dups) {
    const tid = entry[0];
    const arr = entry[1];
    const tk = tasks.find(function(t) { return t.id === tid; });
    console.log('Task "' + (tk ? tk.title : tid.slice(0, 8)) + '" has ' + arr.length + ' schedules:');
    for (const s of arr) {
      console.log('  ' + s.scheduledStart.toISOString() + ' - ' + (s.scheduledEnd ? s.scheduledEnd.toISOString() : '?') + ' (source=' + s.source + ')');
    }
  }

  const tl = await p.timeLog.count();
  const ds = await p.dailySummary.count();
  const dn = await p.dailyNote.count();
  const us = await p.userState.count();
  const am = await p.agentMemory.count();
  console.log('\n=== COUNTS ===');
  console.log('TimeLogs:' + tl + ' DailySummaries:' + ds + ' DailyNotes:' + dn + ' UserStates:' + us + ' AgentMemories:' + am);

  await p.$disconnect();
}
main().catch(function(e) { console.error(e); process.exit(1); });
