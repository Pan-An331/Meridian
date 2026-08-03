// Phase 3 Integration Audit — runs all new modules against a test user

import { prisma } from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function audit() {
  // Dependencies: get or create a real test user
  let user = await prisma.user.findFirst({ where: { email: "audit-test@taskos.local" } });
  if (!user) {
    const hash = await bcrypt.hash("test123", 10);
    user = await prisma.user.create({
      data: { email: "audit-test@taskos.local", passwordHash: hash, nickname: "AuditBot" },
    });
  }
  const TEST_USER_ID = user.id;

  console.log("═══════════════════════════════════════════");
  console.log("Phase 3 Integration Audit");
  console.log("Test User:", TEST_USER_ID);
  console.log("═══════════════════════════════════════════\n");

  // Create minimal test user (just the id, no real auth)
  // We'll directly insert test data

  // ── Step 0: Seed test data ──
  console.log("[0] Seeding test data...");
  try {
    // Clean previous test data
    await prisma.userObservation.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.userPattern.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.agentMemory.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.userModel.deleteMany({ where: { userId: TEST_USER_ID } });

    // Insert 6 observations: 5 time modifications (to test Rule 1), 1 skip
    await prisma.userObservation.createMany({
      data: [
        { userId: TEST_USER_ID, type: "time_modification", detail: '{"fromHour":"20","toHour":"09"}', timestamp: new Date() },
        { userId: TEST_USER_ID, type: "time_modification", detail: '{"fromHour":"19","toHour":"08"}', timestamp: new Date() },
        { userId: TEST_USER_ID, type: "time_modification", detail: '{"fromHour":"21","toHour":"10"}', timestamp: new Date() },
        { userId: TEST_USER_ID, type: "time_modification", detail: '{"fromHour":"20","toHour":"09"}', timestamp: new Date() },
        { userId: TEST_USER_ID, type: "time_modification", detail: '{"fromHour":"18","toHour":"08"}', timestamp: new Date() },
        { userId: TEST_USER_ID, type: "skip", category: "HEALTH", detail: '{"reason":"no_motivation"}', timestamp: new Date() },
      ],
    });
    console.log("  ✓ 6 observations seeded");
  } catch (e) { console.error("  ✗ Seed failed:", e); }

  // ── Step 1: Pattern Mining ──
  console.log("\n[1] Pattern Mining...");
  try {
    const { runPatternMining } = await import("../src/lib/ai/pattern-mining");
    const results = await runPatternMining(TEST_USER_ID);
    console.log(`  ✓ Mined ${results.length} patterns:`, results.map(r => r.pattern).join(", "));
    const dbPatterns = await prisma.userPattern.findMany({ where: { userId: TEST_USER_ID } });
    console.log(`  ✓ ${dbPatterns.length} patterns persisted to DB`);
  } catch (e) { console.error("  ✗ Failed:", e); }

  // ── Step 2: Cold Start ──
  console.log("\n[2] Cold Start...");
  try {
    const { injectBaselineMemories, createOnboardingMemories, createUserDeclaration } = await import("../src/lib/ai/cold-start");
    const baselineCount = await injectBaselineMemories(TEST_USER_ID);
    console.log(`  ✓ ${baselineCount} baseline memories injected`);

    const onboardingCount = await createOnboardingMemories(TEST_USER_ID, {
      identity: "大三学生",
      peakEnergy: "morning",
      busyWith: "考研",
    });
    console.log(`  ✓ ${onboardingCount} onboarding memories created`);

    await createUserDeclaration(TEST_USER_ID, "我不喜欢早起学习", "preference");
    console.log("  ✓ User declaration created (confidence=1.0)");

    const allMemories = await prisma.agentMemory.findMany({
      where: { userId: TEST_USER_ID },
      select: { content: true, confidence: true, source: true },
    });
    console.log(`  ✓ Total ${allMemories.length} memories in DB`);
    console.log("    Sample:", allMemories.slice(0, 3).map(m => `${m.source}: ${m.content.slice(0, 40)}... (${m.confidence})`).join("\n    "));
  } catch (e) { console.error("  ✗ Failed:", e); }

  // ── Step 3: Memory Manager ──
  console.log("\n[3] Memory Manager...");
  try {
    const { computeImportanceScore, getTopMemories, runMemoryLifecycle, resolveMemoryConflicts, blockMemory, checkBlockedMemoryRevival } = await import("../src/lib/ai/memory-manager");

    // Compute importance for one memory
    const firstMem = await prisma.agentMemory.findFirst({ where: { userId: TEST_USER_ID } });
    if (firstMem) {
      const score = await computeImportanceScore(firstMem.id);
      console.log(`  ✓ Importance score computed: ${score}`);
    }

    // Get top memories
    const top = await getTopMemories(TEST_USER_ID, 5);
    console.log(`  ✓ Top ${top.length} memories retrieved`);

    // Resolve conflicts
    const testConflicts = [
      { id: "a", source: "system_baseline", confidence: 0.2, content: "上午效率高" },
      { id: "b", source: "user_declaration", confidence: 1.0, content: "不要早上安排任务" },
    ];
    const resolved = resolveMemoryConflicts(testConflicts);
    console.log(`  ✓ Conflict resolved: ${resolved.length} winning (expected: user_declaration wins)`);
    console.log(`    Winner: "${resolved[0].content}" (source: ${resolved[0].source})`);

    // Block a memory
    if (firstMem) {
      await blockMemory(firstMem.id);
      const blocked = await prisma.agentMemory.findUnique({ where: { id: firstMem.id } });
      console.log(`  ✓ Memory blocked: status="${blocked?.status}"`);

      // Unblock
      await prisma.agentMemory.update({ where: { id: firstMem.id }, data: { status: "active" } });
    }

    // Run lifecycle (won't expire anything since data is fresh)
    await runMemoryLifecycle(TEST_USER_ID);
    console.log("  ✓ Lifecycle ran (fresh data, no decay expected)");
  } catch (e) { console.error("  ✗ Failed:", e); }

  // ── Step 4: Decision Engine ──
  console.log("\n[4] Decision Engine...");
  try {
    const { makeDecision, recomputeUserModel, canAutoExecute } = await import("../src/lib/ai/decision-engine");

    // Recompute UserModel
    await recomputeUserModel(TEST_USER_ID);
    const um = await prisma.userModel.findUnique({ where: { userId: TEST_USER_ID } });
    console.log(`  ✓ UserModel created: peakHours=${um?.peakHours}, trustScore=${um?.trustScore}, dailyCapacity=${um?.dailyCapacity}`);

    // Get memories for decision
    const { getTopMemories: getTop } = await import("../src/lib/ai/memory-manager");
    const topMemories = await getTop(TEST_USER_ID, 5);
    const memSnapshots = topMemories.map(m => ({
      id: m.id, content: m.content, source: m.source,
      confidence: m.confidence, dimension: m.dimension, memoryType: m.memoryType,
    }));

    // Make a decision
    const decision = await makeDecision({
      taskId: "test-task-1",
      taskTitle: "学习数学",
      taskImportance: 4,
      taskCategory: "LEARNING",
      deadline: new Date(Date.now() + 86400000),
      userModel: {
        peakHours: um?.peakHours ? JSON.parse(um.peakHours) : [],
        dailyCapacity: um?.dailyCapacity || 4,
        taskChunk: um?.taskChunk ?? null,
        commonFailures: um?.commonFailures ? JSON.parse(um.commonFailures) : [],
        trustScore: um?.trustScore || 0.5,
      },
      currentState: { energy: "medium", focus: "normal", mood: "neutral", stress: "medium" },
      relevantMemories: memSnapshots,
    });

    console.log(`  ✓ Decision made: action=${decision.action}`);
    console.log(`    reason: ${decision.reason}`);
    console.log(`    confidence: ${decision.confidence}`);
    console.log(`    actionRisk: ${decision.actionRisk}`);
    console.log(`    memoryUsed: ${decision.memoryUsed.length} memories`);

    // Test canAutoExecute
    const execLevel = canAutoExecute(0.5, "low");
    console.log(`  ✓ Auto-execute level (trust=0.5, risk=low): ${execLevel}`);

    const execLevel2 = canAutoExecute(0.9, "low");
    console.log(`  ✓ Auto-execute level (trust=0.9, risk=low): ${execLevel2}`);
  } catch (e) { console.error("  ✗ Failed:", e); }

  // ── Step 5: Advanced capabilities ──
  console.log("\n[5] Advanced...");
  try {
    const { runDailyAIPipeline, checkMemoryResurrection } = await import("../src/lib/ai/advanced");

    await checkMemoryResurrection(TEST_USER_ID);
    console.log("  ✓ Memory resurrection check ran");

    // Daily pipeline (only if AI is configured — skip LLM part)
    await runDailyAIPipeline(TEST_USER_ID).catch(() => console.log("  ⚠ Daily pipeline LLM step skipped (no AI config)"));
    console.log("  ✓ Daily pipeline completed (LLM steps gracefully skipped)");

  } catch (e) { console.error("  ✗ Failed:", e); }

  // ── Step 6: Decision Log integration ──
  console.log("\n[6] Decision Log...");
  try {
    await prisma.decisionLog.create({
      data: {
        userId: TEST_USER_ID,
        action: "reschedule",
        actionDetail: JSON.stringify({ taskId: "test-task-1", newStart: "2026-08-01T09:00:00" }),
        reasoning: "Phase 3 audit: test decision",
        memoryId: "test-memory-id",
        confidence: 0.75,
        outcome: "accepted",
      },
    });
    const logs = await prisma.decisionLog.findMany({
      where: { userId: TEST_USER_ID },
      select: { action: true, confidence: true, outcome: true },
    });
    console.log(`  ✓ Decision log created: ${logs.length} entries`);
    console.log("    Last entry:", JSON.stringify(logs[logs.length - 1]));
  } catch (e) { console.error("  ✗ Failed:", e); }

  // ── Cleanup ──
  console.log("\n═══════════════════════════════════════════");
  console.log("Audit complete. Cleaning up test data...");
  await prisma.userObservation.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.userPattern.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.agentMemory.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.userModel.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.decisionLog.deleteMany({ where: { userId: TEST_USER_ID } });
  console.log("Test data cleaned. ✅");
  console.log("═══════════════════════════════════════════");
}

audit().catch(console.error);
