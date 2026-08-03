import { callAI } from "./client";
import { localDateStr, localDateTimeStr, addDays, parseLocalDate, startOfDay } from "@/lib/date";
import { normalizeCategory } from "@/lib/plan/colors";
import type { InboxResponse, InboxDraftItem } from "@/types/inbox";

const PARSER_SYSTEM_PROMPT = `你是 Task OS 的任务深度理解引擎。

你的唯一职责：
将用户自然语言输入转换为深度理解的结构化任务数据。

你不是聊天助手，不需要解释。
你的输出会被程序直接读取。

请严格返回 JSON 格式。

你的任务：

1. 提取任务名称
2. 判断任务类型
3. 提取时间信息
4. 判断重要程度
5. 估算预计耗时
6. 提取任务描述
7. 分析任务复杂度
8. 评估风险等级
9. 识别阶段依赖关系
10. 拆解为执行阶段（不是简单子任务）
11. 提供整体排程建议

任务类型（非常重要，请仔细判断）：

inbox:
用户只是记录想法，没有明确执行计划，也没说要做。

planned:
用户明确需要完成某件事，有截止日期或目标，但没有指定具体几点到几点执行。
例如："下周三之前完成报告"、"这周做完实验"、"明天交作业"。

scheduled:
用户明确指定了具体执行的开始时间和结束时间。
例如："明天下午2点到4点做实验"、"周五9:00-11:00开会"。

重要程度：

1: 低优先级，不影响主要目标
2: 普通任务
3: 重要任务，需要安排
4: 高优先级，有明确期限或重要影响
5: 最高优先级，必须优先处理

复杂度判断：

low: 单一动作，无需规划，30分钟内可完成
medium: 2-3个步骤，需要一定规划，1-3小时
high: 多阶段任务，需要深入规划，超过3小时或跨多天

风险等级判断：

low: 确定性高，按部就班即可完成
medium: 存在一定不确定性，可能需要调整
high: 高度不确定，可能需要多次尝试或返工

时间字段说明（非常重要）：

deadline（截止日期）：
任务必须在此日期之前完成。这是一个"最后期限"。
例如："下周三之前" -> deadline 填下周三的日期。
只有 planned 和 scheduled 类型可以填 deadline。

startTime + endTime（执行时间段）：
用户明确指定了在某个具体时间段内执行该任务。
例如："明天下午2点到4点" -> startTime 填明天14:00，endTime 填明天16:00。
只有 scheduled 类型才填 startTime 和 endTime。

重要区分：
"下周三之前完成" = deadline，不是 startTime/endTime。这是 planned 类型。
"下周三下午2点到5点做" = startTime/endTime。这是 scheduled 类型。

阶段拆解原则：

不要简单拆分子任务。要按执行阶段拆解：
- 每个阶段应该有明确的认知负荷等级
- 阶段之间可能有依赖关系
- 给出每个阶段的排程建议

认知负荷等级：
low: 低认知负荷，适合碎片时间（如资料收集、整理笔记）
medium: 中认知负荷，需要一定专注（如写文档、设计草稿）
high: 高认知负荷，需要连续专注时间（如深度思考、复杂调试）

排程建议示例：
"适合碎片时间"、"需要连续时间块"、"建议上午精力充沛时做"、"存在风险，需提前开始"

当前日期信息：
今天的日期是 ${localDateStr()}。
请根据这个日期来推算"明天"、"下周三"、"下周"、"月底"等相对时间。

输出格式：

{
"title":"",
"description":"",
"type":"inbox",
"importance":3,
"deadline":"2024-01-15",
"startTime":"",
"endTime":"",
"estimatedMinutes":0,
"complexity":"medium",
"riskLevel":"low",
"dependencies":"阶段间的依赖关系描述",
"phases":[
  {
  "title":"阶段名称",
  "estimatedMinutes":60,
  "cognitiveLoad":"low",
  "schedulingHint":"排程建议",
  "riskLevel":"low"
  }
],
"scheduleAdvice":"整体排程建议，例如：不要周四才开始，建议周一调研、周二方案、周三调试"
}

deadline 格式为 YYYY-MM-DD。
startTime 和 endTime 格式为 ISO 8601（如 2024-01-15T14:00:00）。
如果某字段没有信息，留空字符串。

禁止输出任何 JSON 之外的内容。`;

export interface ParsedPhase {
  title: string;
  estimatedMinutes: number;
  cognitiveLoad: "low" | "medium" | "high";
  schedulingHint: string;
  riskLevel?: "low" | "medium" | "high";
}

export interface ParsedTask {
  title: string;
  description: string;
  type: "inbox" | "planned" | "scheduled";
  importance: number;
  deadline: string;
  startTime: string;
  endTime: string;
  estimatedMinutes: number;
  complexity: "low" | "medium" | "high";
  riskLevel: "low" | "medium" | "high";
  dependencies: string;
  phases: ParsedPhase[];
  scheduleAdvice: string;
}

export async function parseTask(userId: string, input: string): Promise<ParsedTask> {
  const raw = await callAI(userId, PARSER_SYSTEM_PROMPT, input);
  let jsonStr = raw.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  try {
    const parsed = JSON.parse(jsonStr) as ParsedTask;
    if (!parsed.title) throw new Error("AI 未返回任务名称");
    const validTypes = ["inbox", "planned", "scheduled"];
    if (!validTypes.includes(parsed.type)) parsed.type = "inbox";
    if (typeof parsed.importance !== "number" || parsed.importance < 1 || parsed.importance > 5) parsed.importance = 3;
    if (!Array.isArray(parsed.phases)) parsed.phases = [];
    const validLevels = ["low", "medium", "high"];
    if (!validLevels.includes(parsed.complexity)) parsed.complexity = "medium";
    if (!validLevels.includes(parsed.riskLevel)) parsed.riskLevel = "low";
    if (parsed.type === "scheduled" && (!parsed.startTime || !parsed.endTime)) parsed.type = "planned";
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error("AI 返回格式错误，请重试");
    throw e;
  }
}

// ═══════════════════════════════════════════
// Inbox Multi-Object Parser
// ═══════════════════════════════════════════

const INBOX_ANALYZER_PROMPT = `你是 Task OS 的 Inbox 多对象解析引擎。

你的职责：将用户自然语言输入解析为多个结构化任务草案。

用户输入可能包含多个独立事项，例如：
"下个月准备电赛，但最近还有实验报告，我还想学STM32"

你需要逐个识别并分类。

分类规则（非常重要）：
仔细判断用户输入的核心场景，选择最匹配的分类（值必须是小写 key）：

course = 课程/教学任务（作业、考试、论文、上课、复习、交报告、四六级）
learning = 自学提升（背单词、学Python、看书、刷题、学STM32、听课、做笔记——只要是自主学习的都归这里）
practice = 专业实践（做项目、开发、实验、调试、部署代码——有产出物的动手实践；电赛、比赛、备赛、集训等竞赛类也归这里，另加 theme="竞赛"）
health = 健康生活（健身、跑步、运动、早睡早起、减肥——跟身体相关的）
life = 私人生活（购物、买菜、做饭、打扫、缴费、聚会——日常杂务）
external = 外部事务（老板/客户、会议、汇报、邮件、审批——别人要求你做的）
other = 实在无法归入以上任何一类的才用
没有 competition 这个分类，竞赛冲刺一律归 practice，同时 theme="竞赛"。

theme（主题）判断规则（V3，重要）：
- 主题 = 用户的目标语境（考研/竞赛/身材 + 自定义），是独立字段，与 category 互补
- 明确出现才填，拿不准留空（null），禁止强猜：
  · 出现"考研/备考/初试/上岸/刷考研题"等 → theme="考研"（注意"学英语"不等于考研，需上下文明确）
  · 出现"电赛/竞赛/比赛/备赛/选拔"等 → theme="竞赛"
  · 出现"健身/减肥/增肌/塑形/练出好身材"等 → theme="身材"
- 例子："准备考研数学" → category=learning, theme="考研"；"电赛调试" → category=practice, theme="竞赛"

taskType 规则：
- scheduled = 用户指定了具体的执行时间段。比如"下午3点"、"明天9:00-11:00"、"今晚8点"。这类任务有明确的 startTime 和 endTime
- planned = 有 deadline 或目标，但没有指定几点到几点执行。比如"周五前交报告"、"月底比赛"
- inbox = 只是想法，没有任何时间约束

任务类型判断优先级：
1. 如果用户说了具体时间点（几点、几点到几点）→ scheduled，填 startTime 和 endTime
2. 如果用户只说了日期（周五、月底）没具体时间 → planned，填 deadline
3. 都没说 → inbox

startTime / endTime 格式：ISO 8601 如 "2026-07-31T15:00:00"
deadline 格式：YYYY-MM-DD 如 "2026-08-01"

示例：
- "今天下午3点去采购1小时" → scheduled, startTime="2026-07-31T15:00:00", endTime="2026-07-31T16:00:00"
- "明天上午9点到11点学数学" → scheduled, startTime="2026-08-01T09:00:00", endTime="2026-08-01T11:00:00"
- "周五前交实验报告" → planned, deadline="2026-08-01"
- "想学Python" → inbox

━━━ 拆项规则（非常重要）━━━
用户一段话可能包含多个独立事项，必须逐个识别并拆开：
- "明天下午学数学2小时，晚上健身1小时" → 2 个 item：数学、健身
- "下周五交报告，月底比赛，还想学STM32" → 3 个 item：交报告、备赛、学STM32
- "下午3点采购，要买西红柿、鸡蛋、牛奶" → 1 个 item，但采购清单放 description 不放 title

━━━ 标题 vs 备注分离规则（非常重要）━━━
title 只写核心动作描述，≤15字。具体内容、清单、细节全部放 description 字段：
- "下午3点买菜，买西红柿鸡蛋牛奶面包" → title="采购食材" description="西红柿、鸡蛋、牛奶、面包"
- "明天上午写实验报告，关于STM32 CAN通信" → title="完成实验报告" description="STM32 CAN通信实验"
- "想学Python，从爬虫开始" → title="学习Python" description="从爬虫开始入手"
- "明天下午2点到4点做电赛项目，做电机控制部分" → title="电赛项目" description="电机控制部分"
- title 绝对不要塞具体清单和细节，这些放 description
- 如果用户只是说了一个动作没有细节，description 可以为 null

━━━ 积累型任务识别（V5，非常重要）━━━
如果任务带有"每天/每周/坚持/持续"等周期性语义，且动作是反复执行的（背单词、健身、跑步、冥想、阅读打卡、练字、复盘日记），
标记为积累型：accumulate=true，repeatMinutes=单次预计分钟数，taskType="planned"。
积累型没有 deadline，没有"完成"概念，只有每日打卡。
示例：
- "每天背单词30分钟" → title="背单词" accumulate=true repeatMinutes=30
- "坚持每周健身3次" → title="健身" accumulate=true repeatMinutes=60
- "今天下午3点去采购" → accumulate=false（一次性）

复杂度：
low = 简单，30分钟以内
medium = 中等，1-3小时
high = 复杂，多阶段跨多天

━━━ 动机（purpose，Focus Card V2，非常重要）━━━
purpose 是"为什么做这件事"的动机文案（≤50 字），给用户一个行动的理由，如：
- "做四轴飞行器，先画原理图" → purpose="为四轴飞行器打好电路基础"
- "暑假学Python，从爬虫开始" → purpose="用爬虫实战入门 Python"
推断原则：
- 从输入的上下文中提取"目标/意义"，不是重复标题
- 拿不准就留空（null），不强猜——与 theme 同理
- 只要理由明确出现才填；纯列事项（"下午3点买菜"）不填

如果任务复杂(high)且有deadline，生成 breakdown：
{
  shouldBreakdown: true,
  reason: "为什么建议拆解",
  phases: [
    { title: "阶段名", phaseOrder: 1, tasks: [
        { title: "任务", estimatedMinutes: 60, children: [ { title: "执行项", estimatedMinutes: 20 } ] }
    ]}
  ]
}
层级语义：phases 是阶段（phase），tasks 是任务（task，可排期/可执行），tasks 里的 children 是执行项（比任务更小，作为执行清单显示）。
最多 4 层：项目根 → phase → task → 执行项。不需要拆解的 tasks 不要生成 children。

当前日期：${localDateStr()}

返回 JSON（必须严格遵守类型）：
{
  "understanding": "你对用户情况的理解",
  "items": [
    {
      "id": "item1",
      "title": "任务标题",
      "description": "任务备注/清单（可为null）",
      "category": "learning",
      "theme": "考研",
      "taskType": "planned",
      "deadline": "2026-08-01",
      "startTime": "2026-07-31T15:00:00",
      "endTime": "2026-07-31T16:00:00",
      "estimatedMinutes": 120,
      "complexity": "medium",
      "level": "task",
      "accumulate": false,
      "repeatMinutes": null,
      "purpose": "为四轴飞行器打好电路基础",
      "aiReason": "为什么这样分类和安排",
      "confidence": 0.9,
      "breakdown": null
    }
  ]
}

每个 item 的 id 用 item1/item2/item3 递增。
禁止输出 JSON 之外的内容。`;

// ═══════════════════════════════════════════
// Fallback: Rule-based Inbox Parser
// ═══════════════════════════════════════════

/** 分类关键词映射（统一小写 key，与 DOMAINS 一致，禁止大写枚举混用；V3 D8：无 competition） */
const CATEGORY_RULES: { category: string; keywords: string[] }[] = [
  { category: "course",     keywords: ["数学", "作业", "考试", "上课", "论文", "答辩", "课程", "期末", "期中", "复习", "习题", "语文", "物理", "化学", "历史", "提交", "交作业", "老师", "课堂", "测验", "模拟考", "六级", "四级", "托福", "雅思"] },
  { category: "learning",   keywords: ["学习", "看书", "自学", "教程", "技能", "编程", "代码", "入门", "进阶", "掌握", "了解", "研究", "背单词", "单词", "背书", "记忆", "阅读", "写作", "听课", "笔记", "练习", "刷题", "学", "练", "读", "Python", "前端", "后端", "算法", "框架", "语言", "STM32", "嵌入式", "人工智能", "机器学习"] },
  { category: "practice",   keywords: ["实验", "项目", "开发", "实践", "做项目", "搭建", "实现", "调试", "部署", "上线", "测试", "构建", "配置", "环境", "数据库", "部署到", "完成项目", "写代码", "改bug", "竞赛", "比赛", "电赛", "冲刺", "选拔", "决赛", "初赛", "备赛", "参赛", "报名", "队伍", "集训", "赛前", "选题"] },
  { category: "health",     keywords: ["健身", "跑步", "运动", "锻炼", "作息", "健康", "体检", "拉伸", "游泳", "瑜伽", "冥想", "早睡", "早起", "减肥", "增肌", "跳绳", "户外", "登山", "骑行", "散步", "打球", "篮球", "足球", "乒乓", "羽毛球"] },
  { category: "life",       keywords: ["日常", "杂事", "购物", "买菜", "做饭", "打扫", "整理", "收拾", "洗衣服", "倒垃圾", "缴费", "续费", "银行", "快递", "取件", "搬家", "理发", "看医生", "约饭", "聚会", "采购", "生活", "杂务"] },
  { category: "external",   keywords: ["老板", "客户", "第三方", "外包", "合作", "对接", "会议", "汇报", "周报", "日报", "同步", "沟通", "联系", "邮件", "回复", "审批", "签字", "盖章"] },
];

/** V3 主题关键词（fallback：明确出现才判，拿不准留空） */
const THEME_RULES: { theme: string; keywords: RegExp }[] = [
  { theme: "考研", keywords: /考研|备考|初试|上岸|刷考研/ },
  { theme: "竞赛", keywords: /电赛|竞赛|比赛|备赛|选拔|决赛|初赛|集训/ },
  { theme: "身材", keywords: /健身|减肥|增肌|塑形|身材/ },
];

/** 从内容推断主题（拿不准返回 null，不强猜） */
function matchTheme(content: string): string | null {
  for (const rule of THEME_RULES) {
    if (rule.keywords.test(content)) return rule.theme;
  }
  return null;
}

/**
 * Focus Card V2：fallback 动机提取（保守——只提取明确"为…/…为了…"句式，≤50 字，否则 null）
 * 示例："为四轴飞行器打基础" → "为四轴飞行器打基础"；"下午3点买菜" → null
 */
function extractPurposeFallback(content: string): string | null {
  // 明确动机句式："为了XXX"（优先，更长词先匹配）/"为XXX"（目的状语）
  const m = content.match(/(?:为了|为)([^，。,.\n；;！!？?]{2,30})/);
  if (m) {
    const p = m[1].trim();
    if (p.length >= 2) return p.slice(0, 50);
  }
  return null;
}

/** 从内容中匹配分类 */
function matchCategory(content: string): string {
  const lower = content.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.category;
    }
  }
  return "other";
}

/** 提取日期：YYYY-MM-DD 格式 */
function extractExplicitDate(content: string): string | undefined {
  const m = content.match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, "0");
    const day = m[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return undefined;
}

/** 识别相对日期: 明天/后天/下周/下个月 */
function extractRelativeDate(content: string): string | undefined {
  const today = startOfDay();

  const nextDay = (days: number) => localDateStr(addDays(days, today));

  if (/明天/.test(content)) return nextDay(1);
  if (/后天/.test(content)) return nextDay(2);
  if (/大后天/.test(content)) return nextDay(3);
  if (/下周[一二三四五六日天]/.test(content)) {
    const dayMap: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0 };
    const m = content.match(/下周([一二三四五六日天])/);
    if (m) {
      const targetDay = dayMap[m[1]];
      const currentDay = today.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
      return nextDay(daysUntil);
    }
    return nextDay(7);
  }
  if (/下周/.test(content)) return nextDay(7);
  if (/下个月/.test(content)) return nextDay(30);
  if (/本周[一二三四五六日天]/.test(content)) {
    const dayMap: Record<string, number> = { "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0 };
    const m = content.match(/本周([一二三四五六日天])/);
    if (m) {
      const targetDay = dayMap[m[1]];
      const currentDay = today.getDay();
      const daysUntil = (targetDay - currentDay + 7) % 7;
      return daysUntil === 0 ? undefined : nextDay(daysUntil);
    }
  }
  if (/今天/.test(content) || /今日/.test(content)) return localDateStr(today);

  return undefined;
}

/** 从内容提取标题：取第一句或前40字符 */
function extractTitle(content: string): string {
  // 按标点分割取第一段
  const first = content.split(/[，。,.\n；;！!？?]+/).filter(s => s.trim().length > 0)[0];
  if (first && first.trim().length > 0) {
    const t = first.trim();
    return t.length > 40 ? t.slice(0, 40) + "..." : t;
  }
  return content.trim().slice(0, 40) || "未命名任务";
}

/** 拆段：按连接词分割 */
function splitIntoSegments(content: string): string[] {
  const parts = content.split(/[和跟以及还有再加上]+/).filter(s => s.trim().length > 2);
  if (parts.length <= 1) return [content];
  return parts;
}

/** 提取核心动作（≤15字） */
function extractCoreAction(seg: string): string {
  // 修复：正则加 g 标志，否则 replace 只清理第一处时间词
  const cleaned = seg.replace(/[上下中]午\d{1,2}点|明天|后天|下周[一二三四五六日]|本周[一二三四五六日]|今天|今晚|早上|晚上|凌晨|周末/g, "");
  const noDuration = cleaned.replace(/\d+分钟|\d+小时|1小时|半小时/g, "");
  const words = noDuration.trim().split(/[，, 、\s]+/).filter(w => w.length > 1);
  const result = words.slice(0, 4).join("");
  return result.length > 1 ? result : seg.trim().slice(0, 15);
}

/** 提取备注：标题后面的剩余内容 */
function extractDescription(seg: string, title: string): string | undefined {
  const idx = seg.indexOf(title);
  if (idx === -1) {
    const rest = seg.trim();
    return rest.length > 2 ? rest : undefined;
  }
  const rest = seg.slice(idx + title.length).replace(/^[，,。.\s：:]+/, "").trim();
  return rest.length > 2 ? rest : undefined;
}

/** 从文本中提取小时数 */
function extractHour(seg: string): number {
  // 匹配 "下午3点" → 15, "上午9点" → 9, "晚上8点" → 20
  const m = seg.match(/([上下中]午|晚上|早上|凌晨)(\d{1,2})点/);
  if (m) {
    const h = parseInt(m[2]);
    if (m[1] === "下午" || m[1] === "晚上") return h + 12;
    if (m[1] === "凌晨") return h <= 5 ? h : h - 12;
    return h; // 上午
  }
  // 匹配 "15:00"
  const hm = seg.match(/(\d{1,2}):(\d{2})/);
  if (hm) return parseInt(hm[1]);
  return 9; // 默认上午9点
}

/** 规则降级解析：不依赖 AI，纯正则+关键词 */
function fallbackAnalyzeInboxInput(content: string): InboxResponse {
  const draftId = "draft_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
  const segments = splitIntoSegments(content);
  // V5：显式类型标注，防止对象字面量属性被宽化为 string
  const items: InboxDraftItem[] = segments.map((seg, i) => {
    const title = extractCoreAction(seg);
    const description = extractDescription(seg, title);
    const category = matchCategory(seg);
    const explicitDate = extractExplicitDate(seg);
    const relativeDate = extractRelativeDate(seg);
    const deadline = explicitDate || relativeDate || undefined;

    // V5 降级：积累型识别（每天/坚持 + 反复动作）
    const isAccumulate = /每天|每日|坚持|持续|天天|每周/.test(seg) && /背单词|单词|健身|跑步|运动|冥想|阅读|读书|练字|日记|打卡|复习|锻炼|早睡|早起/.test(seg);
    const repeatMatch = seg.match(/(\d+)\s*分钟/);
    const repeatMinutes = isAccumulate && repeatMatch ? parseInt(repeatMatch[1]) : undefined;

    // 检测精确时间 → scheduled
    let taskType: "planned" | "inbox" | "scheduled" = "inbox";
    let startTime: string | undefined;
    let endTime: string | undefined;

    const hasExplicitTime = /[上下中]午\d{1,2}点|晚上\d{1,2}点|早上\d{1,2}点|凌晨\d{1,2}点|今晚|今[早晚]/.test(seg) ||
      /\d{1,2}:\d{2}/.test(seg);
    const hasDuration = /(\d+)\s*(分钟|小时|个?半小时)/.test(seg) || seg.includes("1小时");

    if (hasExplicitTime) {
      taskType = "scheduled";
      const baseDate = deadline ? parseLocalDate(deadline) : startOfDay();
      const hour = extractHour(seg);
      baseDate.setHours(hour, 0, 0, 0);
      startTime = localDateTimeStr(baseDate);

      if (hasDuration) {
        const durMatch = seg.match(/(\d+)\s*(分钟|小时)/);
        const durMin = durMatch
          ? (durMatch[2] === "小时" ? parseInt(durMatch[1]) * 60 : parseInt(durMatch[1]))
          : 60;
        const endDate = new Date(baseDate.getTime() + durMin * 60000);
        endTime = localDateTimeStr(endDate);
      }
    } else if (deadline) {
      taskType = "planned";
    }

    return {
      id: `item${i + 1}`,
      title,
      description,
      category,
      // V3：主题（fallback 明确关键词才判，拿不准 null）
      theme: matchTheme(seg),
      // Focus Card V2：动机——fallback 保守：仅当句含"为…/…为了…"明确动机才提取，否则 null（不强猜）
      purpose: extractPurposeFallback(seg),
      taskType: isAccumulate ? "planned" : taskType,
      deadline: isAccumulate ? undefined : deadline,
      startTime,
      endTime,
      estimatedMinutes: undefined,
      complexity: undefined,
      // V5：降级解析器也标记积累型
      level: "task",
      accumulate: isAccumulate,
      repeatMinutes,
      aiReason: "基础关键词降级解析（AI 不可用或失败时自动回退）",
      confidence: 0.5,
      breakdown: undefined,
    };
  });

  return {
    draftId,
    understanding: `根据关键词降级解析：${items.length} 个任务`,
    items,
  };
}

// ═══════════════════════════════════════════
// Main analyzer (AI-first, fallback on error)
// ═══════════════════════════════════════════

export async function analyzeInboxInput(userId: string, content: string): Promise<InboxResponse> {
  try {
    const raw = await callAI(userId, INBOX_ANALYZER_PROMPT, content);
    let jsonStr = raw.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
    try {
      const parsed = JSON.parse(jsonStr);
      // Generate draftId
      const draftId = "draft_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
      // Validate and normalize items
      const items = (Array.isArray(parsed.items) ? parsed.items : []).map((item: any, i: number) => ({
        id: item.id || ("item" + (i + 1)),
        title: item.title || "未命名任务",
        description: item.description || undefined,
        category: normalizeCategory(item.category),
        // V3：主题（LLM 明确判断，拿不准留空；fallback 关键词兜底）
        theme: (typeof item.theme === "string" && item.theme.trim()) ? item.theme.trim().slice(0, 20) : matchTheme(String(item.title || "")),
        // Focus Card V2：动机（LLM 明确给出才收，≤50 字；拿不准留空不强猜）
        purpose: (typeof item.purpose === "string" && item.purpose.trim()) ? item.purpose.trim().slice(0, 50) : null,
        taskType: ["planned", "inbox", "scheduled"].includes(item.taskType) ? item.taskType : "planned",
        deadline: item.deadline || undefined,
        startTime: item.startTime || undefined,
        endTime: item.endTime || undefined,
        estimatedMinutes: typeof item.estimatedMinutes === "number" ? item.estimatedMinutes : undefined,
        complexity: ["low", "medium", "high"].includes(item.complexity) ? item.complexity : undefined,
        // V5：层级语义 + 积累型透传（LLM 未返回时按规则兜底）
        level: (["project", "phase", "task"].includes(item.level) ? item.level : "task") as "project" | "phase" | "task",
        accumulate: !!item.accumulate || /每天|每日|坚持|持续|天天|每周/.test(item.title || ""),
        repeatMinutes: typeof item.repeatMinutes === "number" && item.repeatMinutes > 0 ? item.repeatMinutes : undefined,
        aiReason: item.aiReason || "",
        confidence: typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0.7,
        breakdown: item.breakdown?.shouldBreakdown ? item.breakdown : undefined,
      }));
      return {
        draftId,
        understanding: parsed.understanding || "",
        items,
      };
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error("AI 返回格式错误，请重试");
      throw e;
    }
  } catch {
    // AI 不可用或失败 → 降级到规则解析
    return fallbackAnalyzeInboxInput(content);
  }
}
