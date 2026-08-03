import { callAI } from "@/lib/ai/client";
import { buildDecisionContext } from "@/lib/context/decision-context";
import type { DecisionAnalysis } from "./interface";

const ADVISOR_PROMPT = `你是用户的决策顾问。你的任务不是执行命令，而是分析决定的影响。

考虑：1.当前时间安排 2.Deadline 3.用户状态 4.历史完成情况

分析风险等级并给出2-3个可执行方案。

输出JSON：
{
  "decision": "用户的决定",
  "risk": "low|medium|high",
  "impact": ["影响1"],
  "suggestions": [{"title":"方案A","description":"说明"}],
  "actions": [
    {"id":"option1","type":"reschedule","title":"延期到明天","description":"移动任务时间","payload":{"taskId":"...","newStart":"ISO","newEnd":"ISO"}},
    {"id":"option2","type":"keep","title":"保持原计划","description":"按计划执行","payload":{}}
  ],
  "needConfirmation": true
}

action type: reschedule(修改Schedule) | modify_task(修改Task属性) | keep(不变)
payload示例:
- reschedule: {"taskId":"...","newStart":"2026-07-27T09:00:00","newEnd":"2026-07-27T11:00:00"}
- modify_task: {"taskId":"...","deadline":"2026-08-01","importance":4}
- keep: {}

不要输出非JSON内容。`;

export async function analyzeDecision(userId: string, userDecision: string): Promise<DecisionAnalysis> {
  const ctx = await buildDecisionContext(userId);

  const userMessage = `用户当前上下文：

任务：${ctx.tasks || "无"}
日程：${ctx.schedules || "无"}
状态：${ctx.userState || "未知"}
反馈：${ctx.executionFeedback || "无"}
统计：${ctx.behaviorStats || "无"}
历史：${ctx.decisionHistory || "无"}

用户决定：${userDecision}`;

  try {
    const raw = await callAI(userId, ADVISOR_PROMPT, userMessage);
    const js = raw.trim().replace(/```json\s*|\s*```/g, "");
    const result = JSON.parse(js) as DecisionAnalysis;
    if (!result.risk) result.risk = "medium";
    if (!result.impact) result.impact = [];
    if (!result.suggestions) result.suggestions = [];
    if (!result.actions) result.actions = [{ id: "option1", type: "keep", title: "保持原计划", description: "按计划执行", payload: {} }];
    if (result.needConfirmation === undefined) result.needConfirmation = true;
    return result;
  } catch (_) {
    return {
      decision: userDecision, risk: "low", impact: ["无法完成完整分析"],
      suggestions: [{ title: "按原计划继续", description: "保持当前安排不变" }],
      actions: [{ id: "option1", type: "keep", title: "保持原计划", description: "按计划执行", payload: {} }],
      needConfirmation: true,
    };
  }
}
