const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const u = await p.user.findUnique({ where: { email: "v3smoke@test.com" } });
  if (!u) { console.log("no smoke user"); await p.$disconnect(); return; }
  // 删除该用户的全部数据（先子任务再父任务，schedule/timeLog 级联）
  await p.task.deleteMany({ where: { userId: u.id } });
  await p.schedule.deleteMany({ where: { userId: u.id } });
  await p.timeLog.deleteMany({ where: { userId: u.id } });
  await p.taskExecutionFeedback.deleteMany({ where: { userId: u.id } });
  await p.agentFeedback.deleteMany({ where: { userId: u.id } });
  await p.agentMemory.deleteMany({ where: { userId: u.id } });
  await p.userObservation.deleteMany({ where: { userId: u.id } });
  await p.taskDraft.deleteMany({ where: { userId: u.id } });
  await p.userPattern.deleteMany({ where: { userId: u.id } });
  await p.decisionLog.deleteMany({ where: { userId: u.id } });
  await p.userState.deleteMany({ where: { userId: u.id } });
  await p.userModel.deleteMany({ where: { userId: u.id } });
  await p.dailySummary.deleteMany({ where: { userId: u.id } });
  await p.dailyNote.deleteMany({ where: { userId: u.id } });
  await p.dailyBrief.deleteMany({ where: { userId: u.id } });
  await p.todayDecision.deleteMany({ where: { userId: u.id } });
  await p.userProfile.deleteMany({ where: { userId: u.id } });
  await p.aIConfig.deleteMany({ where: { userId: u.id } });
  await p.user.delete({ where: { id: u.id } });
  console.log("smoke user cleaned:", u.email);
  await p.$disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
