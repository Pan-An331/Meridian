import { callAI } from "./client";
import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";

const TODAY_SYSTEM_PROMPT = `你是 Task OS 的每日执行助手。

你的目标：
帮助用户专注当前最重要的事情。

你会收到：

今天日期：
当前时间（精确到分钟）：
今日时间线：
未完成任务：
任务重要程度：
截止时间：
今日已完成任务数：

非常重要的时间规则：

1. 你收到的"当前时间"是用户的真实当前时间
2. 你推荐的所有时间必须在"当前时间"之后
3. 绝对不要推荐已经过去的时间
4. 如果现在是下午6点，你只能推荐6点之后的安排
5. 下一步的时间应该是当前任务结束后+合理休息时间

请输出：

1. 当前应该做什么（当前任务）
2. 下一步做什么（下一个时间段，必须在当前时间之后）
3. 今日剩余时间线（只包含当前时间之后的安排）
4. 每日消息（简短鼓励）

当前任务选择优先级：
- 正在进行中的任务最优先
- 其次是 scheduled 类型且当前时间在时间段内
- 再次是 importance 最高且 deadline 最近的任务
- 如果都没有，推荐 importance 最高的未完成任务

下一步选择：
- 当前任务结束后的下一个时间段
- 如果当前任务后没有安排，提示休息
- 给出休息后的下一个任务
- 休息时间建议 15-30 分钟

今日时间线：
- 只展示当前时间之后剩余的安排
- 按时间顺序排列
- 最多显示 5 个

不要制造新的任务。
不要输出其他内容。

输出 JSON：

{
"currentTask": {
  "taskId": "任务ID或null",
  "title": "当前任务名称",
  "estimatedMinutes": 90,
  "reasons": [
    "推荐理由1",
    "推荐理由2",
    "推荐理由3"
  ]
},
"nextStep": {
  "time": "18:30",
  "action": "休息 20 分钟",
  "afterThat": {
    "time": "18:50",
    "title": "下一个任务名称",
    "taskId": "任务ID"
  }
},
"todayTimeline": [
  {
    "time": "19:00",
    "title": "任务名称",
    "duration": "2h",
    "taskId": "任务ID"
  }
],
"dailyMessage": "简短鼓励语"
}

如果当前没有任务，currentTask 可以是 null。
如果后面没有安排，nextStep.afterThat 可以是 null。
如果今天没有剩余安排，todayTimeline 可以是空数组。

禁止输出其他内容。`;

export interface CurrentTask {
  taskId: string | null;
  title: string;
  estimatedMinutes: number;
  reasons: string[];
}

export interface NextStep {
  time: string;
  action: string;
  afterThat: {
    time: string;
    title: string;
    taskId: string;
  } | null;
}

export interface TimelineItem {
  time: string;
  title: string;
  duration: string;
  taskId: string;
}

export interface TodaySuggestion {
  currentTask: CurrentTask | null;
  nextStep: NextStep | null;
  todayTimeline: TimelineItem[];
  dailyMessage: string;
}

export async function getTodaySuggestion(userId: string): Promise<TodaySuggestion | null> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const todaySchedule = await prisma.schedule.findMany({
    where: {
      userId,
      scheduledStart: { gte: todayStart, lte: todayEnd },
    },
    include: {
      task: { select: { id: true, title: true, importance: true, deadline: true, status: true, estimatedMinutes: true } },
    },
    orderBy: { scheduledStart: "asc" },
  });

  const uncompletedTasks = await prisma.task.findMany({
    where: {
      userId,
      status: { notIn: ["completed", "cancelled"] },
      parentId: null,
    },
    orderBy: [{ importance: "desc" }, { deadline: "asc" }],
    take: 15,
  });

  const inProgressTask = await prisma.task.findFirst({
    where: { userId, status: "in_progress" },
  });

  const completedToday = await prisma.task.count({
    where: {
      userId,
      status: "completed",
      completedAt: { gte: todayStart, lte: todayEnd },
    },
  });

  const timeline = todaySchedule.map((s) => ({
    taskId: s.task.id,
    title: s.task.title,
    importance: s.task.importance,
    status: s.task.status,
    estimatedMinutes: s.task.estimatedMinutes,
    start: s.scheduledStart.toISOString(),
    end: s.scheduledEnd?.toISOString(),
  }));

  const tasks = uncompletedTasks.map((t) => ({
    id: t.id,
    title: t.title,
    importance: t.importance,
    status: t.status,
    deadline: t.deadline?.toISOString(),
    estimatedMinutes: t.estimatedMinutes,
  }));

  // Format current time in user-friendly way
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const currentTimeStr = `${hours}:${minutes}`;

  const userMessage = `今天日期：${localDateStr(now)}
当前时间：${currentTimeStr}（这是用户此刻的真实时间，你推荐的所有时间必须在这之后）

今日时间线：
${JSON.stringify(timeline, null, 2)}

未完成任务：
${JSON.stringify(tasks, null, 2)}

正在进行中的任务：${inProgressTask ? inProgressTask.title + " (ID: " + inProgressTask.id + ")" : "无"}

今日已完成任务数：${completedToday}`;

  try {
    const raw = await callAI(userId, TODAY_SYSTEM_PROMPT, userMessage);

    let jsonStr = raw.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const suggestion = JSON.parse(jsonStr) as TodaySuggestion;

    if (!suggestion.todayTimeline) suggestion.todayTimeline = [];
    if (!suggestion.dailyMessage) suggestion.dailyMessage = "";

    return suggestion;
  } catch (e) {
    console.error("Today assistant error:", e);
    return null;
  }
}
