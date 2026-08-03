import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { callAgent } from "@/lib/ai/client";
import { executeTools, type ToolCall, type OperationResult } from "@/lib/ai/executor";
import { prisma } from "@/lib/prisma";
import { createDecisionLog } from "@/lib/ai/decision-log";
import { generateOperationMessage } from "@/lib/ai/result-message";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let input: string;
  try { const body = await req.json(); input = body.input; } catch { return badRequest("请求格式错误"); }
  if (!input || typeof input !== "string" || input.trim().length < 1) return badRequest("请输入内容");

  try {
    const raw = await callAgent(session.user.id, input.trim());
    let agentResponse: any;
    let jsonStr = raw.trim(); const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/); if (codeBlock) jsonStr = codeBlock[1].trim();
    try { agentResponse = JSON.parse(jsonStr); } catch { return NextResponse.json({ success: true, message: raw, toolCalls: [], confirmations: [], options: [] }); }

    const stateResults = agentResponse.stateUpdates?.length > 0 ? await executeTools(session.user.id, agentResponse.stateUpdates as ToolCall[]) : [];
    const toolResults = agentResponse.toolCalls?.length > 0 ? await executeTools(session.user.id, agentResponse.toolCalls as ToolCall[]) : [];
    const memoryResults = agentResponse.memorySaves?.length > 0 ? await executeTools(session.user.id, agentResponse.memorySaves as ToolCall[]) : [];

    // 状态/记忆写入失败也要留痕（修复：原来只检查 toolCalls，state/memory 失败完全静默）
    const silentFailures = [...stateResults, ...memoryResults].filter((r: any) => !r.success);
    if (silentFailures.length > 0) {
      console.warn("[agent/chat] silent tool failures:", silentFailures.map((r: any) => `${r.tool}: ${r.error}`).join(" | "));
    }

    // Extract confirmations
    const blockedConfirms = toolResults.filter((r: any) => r.requiresConfirmation);
    const confirmations = [...(agentResponse.confirmations || []), ...blockedConfirms];

    // Record successful tool calls
    for (const r of toolResults) {
      if (r.success && r.data?.id) {
        createDecisionLog({ userId: session.user.id, action: r.tool, targetId: r.data.id, actionDetail: JSON.stringify(r.data), reasoning: agentResponse.understanding || null }).catch(() => {});
      }
    }

    // Auto-planner for arrange requests
    const isArrangeRequest = /安排|规划|排一下|排个|排入|日程|作息|帮我排|帮我安排|帮我规划/i.test(input);
    if (isArrangeRequest) {
      try {
        const activeTasks = await prisma.task.findMany({ where: { userId: session.user.id, status: { in: ["not_started", "delayed"] } }, select: { id: true }, take: 30 });
        const tasksWithSchedule = await prisma.schedule.findMany({ where: { userId: session.user.id, taskId: { in: activeTasks.map(t => t.id) } }, select: { taskId: true } });
        const scheduledIds = new Set(tasksWithSchedule.map(s => s.taskId));
        const needsScheduling = activeTasks.filter(t => !scheduledIds.has(t.id));
        if (needsScheduling.length > 0) {
          const { generateSchedule, saveSchedule } = await import('@/lib/ai/planner');
          const planResult = await generateSchedule(session.user.id, needsScheduling.map(t => t.id));
          if (planResult.suggestions?.length > 0) await saveSchedule(session.user.id, planResult.suggestions, 'ai');
        }
      } catch (e) {
        console.error("[agent/chat] auto-planner failed:", e);
      }
    }

    // ═══ Generate message from executor results (not AI) ═══
    const writeOps = toolResults.filter((r: any) => r.data?.operation);

    // Deny fake success
    const writeFailures = toolResults.filter((r: any) => !r.success && !r.requiresConfirmation &&
      r.tool !== "get_today_tasks" && r.tool !== "get_schedule" && r.tool !== "get_tasks" &&
      r.tool !== "get_user_state" && r.tool !== "get_memories");
    if (writeFailures.length > 0) {
      return NextResponse.json({
        success: true, understanding: agentResponse.understanding || "",
        message: "操作失败：" + writeFailures.map((r: any) => r.error || "未知错误").join("；"),
        toolCalls: toolResults, confirmations, options: agentResponse.options || [],
      });
    }

    // Build final message
    let finalMessage = "";
    if (writeOps.length > 0) {
      finalMessage = writeOps.map((r: any) => generateOperationMessage(r.data as OperationResult)).join("\n");
    } else if (blockedConfirms.length > 0) {
      finalMessage = agentResponse.message || "";
    } else {
      finalMessage = agentResponse.message || "";
    }

    try { await prisma.decisionLog.create({ data: { userId: session.user.id, action: "agent_chat", actionDetail: JSON.stringify({ stateUpdates: stateResults, toolCalls: toolResults, memorySaves: memoryResults, confirmations }), contextUsed: JSON.stringify({ inputLength: input.length }), reasoning: agentResponse.understanding || null } }); } catch {}

    return NextResponse.json({
      success: true,
      understanding: agentResponse.understanding || "",
      message: finalMessage,
      stateUpdates: stateResults, toolCalls: toolResults, memorySaves: memoryResults,
      confirmations, options: agentResponse.options || [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Agent处理失败";
    if (message === "AI_NOT_CONFIGURED") return NextResponse.json({ error: "请先在设置中配置 AI API" }, { status: 400 });
    if (message.startsWith("AI_API_ERROR:")) return NextResponse.json({ error: "AI 服务调用失败，请检查 API 配置" }, { status: 502 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
