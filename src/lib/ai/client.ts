import { prisma } from "@/lib/prisma";
import { buildAgentContext } from "./context";
import { getToolsDescription } from "./tools";
import { localDateStr, addDays } from "@/lib/date";

export interface AIConfig { provider: string; baseUrl: string; apiKey: string; model: string; }

/** fetch with timeout — 防止 LLM 服务挂起时请求悬挂 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("AI_REQUEST_TIMEOUT: 请求超时（" + timeoutMs + "ms）");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function getUserAIConfig(userId: string): Promise<AIConfig | null> {
  const config = await prisma.aIConfig.findUnique({ where: { userId } });
  if (!config) return null;
  return { provider: config.provider, baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model };
}

async function buildAgentSystemPrompt(userId: string): Promise<string> {
  const ctx = await buildAgentContext(userId);
  const toolsDesc = getToolsDescription();
  const now = new Date();
  const timeStr = now.getHours().toString().padStart(2, "0") + ":" + now.getMinutes().toString().padStart(2, "0");
  const todayStr = localDateStr(now);
  const tomorrowStr = localDateStr(addDays(1, now));
  const dayAfterStr = localDateStr(addDays(2, now));

  // 计算本周五和下周一的日期（本地时区）
  const today = now;
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const friday = addDays(daysUntilFriday, today);
  const fridayStr = localDateStr(friday);
  const nextMonday = addDays(((8 - dayOfWeek) % 7 || 7), today);
  const nextMondayStr = localDateStr(nextMonday);

  let prompt = "你是用户的个人时间管理AI助手。你的目标：帮助用户在现实变化中持续做出合理时间决策。\n当前时间：" + todayStr + " " + timeStr + "\n";
  prompt += "本周五=" + fridayStr + " 下周一=" + nextMondayStr + "\n";

  if (ctx.profile) prompt += "\n## 用户画像\n" + ctx.profile + "\n";
  if (ctx.states) prompt += "\n## 当前状态\n" + ctx.states + "\n";
  if (ctx.memories) prompt += "\n## 长期记忆\n" + ctx.memories + "\n";
  if (ctx.userModel) prompt += "\n" + ctx.userModel + "\n"; // 修复：机器学习画像注入
  if (ctx.behaviorStats) prompt += "\n## 行为统计\n" + ctx.behaviorStats + "\n";
  if (ctx.todayData) prompt += "\n## 今日数据\n" + ctx.todayData + "\n";
  if (ctx.recentTasks) prompt += "\n" + ctx.recentTasks + "\n";

  prompt += "\n" + toolsDesc + "\n";

  prompt += "\n## Step 1: Intent Recognition\n\n";
  prompt += "1. modify_task: change/adjust/delay/reschedule/delete existing tasks\n";
  prompt += "2. create_task: when no existing task matches, create a new one\n";

  prompt += "\n### Step 2: Task Type Rules (CRITICAL)\n";
  prompt += "Always set the type parameter based on user's input:\n";
  prompt += "- type=\"scheduled\" if user specifies exact time (e.g. 'tomorrow 2pm', 'Friday 9am-11am') - include startTime AND endTime in ISO format\n";
  prompt += "- type=\"planned\" if user mentions deadline only (e.g. 'submit by Friday', 'finish before next week') - include deadline in YYYY-MM-DD format\n";
  prompt += "- type=\"inbox\" if user is just recording an idea without any time commitment\n\n";

  prompt += "### Task Type Examples\n";
  prompt += "- create_task({title:\"study math\",type:\"scheduled\",startTime:\"" + tomorrowStr + "T15:00:00\",endTime:\"" + tomorrowStr + "T17:00:00\"})\n";
  prompt += "- create_task({title:\"submit report\",type:\"planned\",deadline:\"" + fridayStr + "\",importance:4})\n";
  prompt += "- create_task({title:\"learn Python\",type:\"inbox\",importance:2})\n\n";

  prompt += "Time Format Rules\n";
  prompt += "- start/end MUST be full ISO: YYYY-MM-DDTHH:mm:ss\n";
  prompt += "- deadline MUST be YYYY-MM-DD (date only, NO time component)\n";
  prompt += "- NEVER pass: 'evening', '20:00', '19', '8pm' as time values\n";
  prompt += "- today=" + todayStr + " tomorrow=" + tomorrowStr + " day after=" + dayAfterStr + "\n";
  prompt += "- tonight=" + todayStr + "T20:00:00\n";
  prompt += "- tomorrow 3pm=" + tomorrowStr + "T15:00:00\n\n";

  prompt += "Keyword Rules\n";
  prompt += "- Use keyword (NOT taskId) to locate tasks for modification\n";
  prompt += "- keyword comes from task name mentioned by user\n\n";

  prompt += "Response Format - ONLY output JSON:\n";
  prompt += "{\n";
  prompt += "  \"understanding\": \"...\",\n";
  prompt += "  \"toolCalls\": [{\"tool\":\"create_task\",\"args\":{\"title\":\"...\",\"type\":\"planned\",\"deadline\":\"2026-07-31\",\"importance\":4}}],\n";
  prompt += "  \"message\": \"...\",\n";
  prompt += "  \"options\": []\n";
  prompt += "}\n\n";
  prompt += "If multiple tasks match, use options. NEVER output anything except JSON.";

  return prompt;
}

export async function callAgent(userId: string, userMessage: string): Promise<string> {
  const config = await getUserAIConfig(userId);
  if (!config) throw new Error("AI_NOT_CONFIGURED");
  const systemPrompt = await buildAgentSystemPrompt(userId);
  const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.apiKey },
    body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.3, max_tokens: 4000 }),
  });
  if (!response.ok) { const et = await response.text(); throw new Error("AI_API_ERROR: " + response.status + " - " + et); }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI_EMPTY_RESPONSE");
  return content;
}

export async function callAI(userId: string, systemPrompt: string, userMessage: string): Promise<string> {
  const config = await getUserAIConfig(userId);
  if (!config) throw new Error("AI_NOT_CONFIGURED");
  const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + config.apiKey },
    body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.3, max_tokens: 2000 }),
  });
  if (!response.ok) { const et = await response.text(); throw new Error("AI_API_ERROR: " + response.status + " - " + et); }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI_EMPTY_RESPONSE");
  return content;
}
