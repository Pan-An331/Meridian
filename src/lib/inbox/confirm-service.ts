import { prisma } from "@/lib/prisma";
import { buildTasksFromDraft } from "./task-builder";
import type { InboxDraftItem } from "@/types/inbox";
import { localDateStr } from "@/lib/date";
import { createDecisionLog } from "@/lib/ai/decision-log";
import { createAccumulateSchedules } from "@/lib/schedule/service";
import { normalizeCategory } from "@/lib/plan/colors";
import { normalizeThemeColorInput } from "@/lib/task/theme";
import { createFeedback } from "@/lib/ai/feedback";

/** V3：领域白名单（7 类封顶，无 competition） */
const CATEGORY_WHITELIST = ["course", "learning", "practice", "health", "life", "external", "other"];

/**
 * V3 D2 + Focus Card V2：确认时「AI 推断值 ≠ 用户最终值」→ AgentFeedback 回流（计入 trustScore）
 * 比较 category / theme / purpose 三个 AI 推断字段
 */
async function recordModifyFeedback(
  userId: string,
  taskId: string,
  field: "category" | "theme" | "purpose",
  aiValue: string | null | undefined,
  userValue: string | null | undefined
) {
  const orig = (aiValue || "").trim();
  const user = (userValue || "").trim();
  // AI 没给值或用户没改 → 不记录
  if (!orig || !user || orig === user) return;
  await createFeedback({
    userId,
    taskId,
    agentAction: "inbox_classify",
    userResponse: "modified",
    modifiedField: field,
    originalValue: orig,
    userValue: user,
    context: "inbox_confirm",
    agentSuggestion: JSON.stringify({ [field]: orig }),
  });
}

/** Focus Card V2：purpose 白名单（≤50 字，null 清除） */
function normalizePurpose(input: unknown): string | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string") return null;
  const t = input.trim();
  if (!t) return null;
  return t.slice(0, 50);
}

export async function confirmDraftItems(userId: string, draftId: string, confirmed: InboxDraftItem[]) {
  const results: { id: string; title: string }[] = [];

  await prisma.$transaction(async (tx) => {
    for (const item of confirmed) {
      // V3：category 白名单 7 类（归一化 + 兜底 other→null，与其他入口存储一致；防任意字符串污染）
      const cat = normalizeCategory(item.category);
      // 断言：category 运行时可传 null（task-builder 内部 `draft.category || null` 兼容），类型保持前端 string 契约
      const normalizedItem: InboxDraftItem = {
        ...item,
        category: (cat === "other" ? null : cat) as string,
        // V3：theme 白名单——非空字符串 ≤20 字，null 清除
        theme: typeof item.theme === "string" && item.theme.trim() ? item.theme.trim().slice(0, 20) : null,
        // B7：自定义主题落库色归一化（#hex JSON；theme 为空时无意义 → null）
        themeColor: item.theme ? normalizeThemeColorInput(item.themeColor).value : null,
        // Focus Card V2：purpose 白名单——≤50 字，null 清除
        purpose: normalizePurpose(item.purpose),
      };

      // V3 D2 + FCV2：读取 AI 推断值（draft item 的 dataJson）用于反馈回流
      let aiInferred: { category?: string | null; theme?: string | null; purpose?: string | null } = {};
      try {
        const draftItem = await tx.taskDraftItem.findFirst({
          where: { draftId, title: item.title, status: "WAIT_CONFIRM" },
          select: { dataJson: true },
        });
        if (draftItem?.dataJson) {
          const parsed = JSON.parse(draftItem.dataJson);
          aiInferred = {
            category: typeof parsed.category === "string" ? parsed.category : undefined,
            theme: typeof parsed.theme === "string" ? parsed.theme : undefined,
            purpose: typeof parsed.purpose === "string" ? parsed.purpose : undefined,
          };
        }
      } catch {}

      const buildResult = buildTasksFromDraft(normalizedItem);
      const created: { id: string }[] = [];

      // V5 多级建树：按 parents 顺序创建（父先子后，parents 已保证拓扑序）
      for (let i = 0; i < buildResult.params.length; i++) {
        const params = buildResult.params[i];
        const parentId = buildResult.parents[i] >= 0 ? created[buildResult.parents[i]].id : null;

        // Focus Card V2：父级继承——子任务 purpose 为空时继承父任务 purpose（查父节点，非空则填）
        let effPurpose = params.purpose || null;
        if (!effPurpose && parentId) {
          try {
            const parent = await tx.task.findUnique({ where: { id: parentId }, select: { purpose: true } });
            if (parent?.purpose) effPurpose = parent.purpose.slice(0, 50);
          } catch {}
        }
        const createData: Record<string, unknown> = { ...params, userId, parentId, source: "ai" };
        if (effPurpose !== params.purpose) createData.purpose = effPurpose;

        const task = await tx.task.create({ data: createData as never });
        created.push({ id: task.id });
        results.push({ id: task.id, title: task.title });

        // BUG-20260807-041：scheduled 任务补写排期——analyze 返回的 startTime/endTime
        // （如「早上 8 点备份数据，60 分钟」→ 08:00-09:00）在 confirm 创建时丢失，
        // 导致时间表达任务没有时间块（惰性结算/今日路线/续排全部失效）。
        if ((params.taskType === "scheduled" || item.taskType === "scheduled") && item.startTime) {
          const st = new Date(item.startTime);
          if (!isNaN(st.getTime())) {
            const durMin = params.estimatedMinutes || 60;
            const ed = item.endTime
              ? new Date(item.endTime)
              : new Date(st.getTime() + durMin * 60000);
            if (!isNaN(ed.getTime())) {
              await tx.schedule.create({
                data: { userId, taskId: task.id, scheduledStart: st, scheduledEnd: ed, source: "ai" },
              });
            }
          }
        }

        // V3 D2 + FCV2：反馈回流（仅根节点，taskId 用实际创建的任务）
        if (i === 0) {
          await recordModifyFeedback(userId, task.id, "category", aiInferred.category, normalizedItem.category);
          await recordModifyFeedback(userId, task.id, "theme", aiInferred.theme, normalizedItem.theme);
          await recordModifyFeedback(userId, task.id, "purpose", aiInferred.purpose, normalizedItem.purpose);
        }

        // V5 积累型：生成未来 30 天每日重复排期（事务内）
        if (params.accumulate) {
          await createAccumulateSchedules(userId, task.id, params.estimatedMinutes || 20, 30, 20, tx);
        }
      }

      // Update draft item status
      try {
        await tx.taskDraftItem.updateMany({
          where: { draftId, title: item.title, status: "WAIT_CONFIRM" },
          data: { status: "CREATED" },
        });
      } catch {}
    }

    // Update draft status if all items are processed
    try {
      const remaining = await tx.taskDraftItem.count({ where: { draftId, status: "WAIT_CONFIRM" } });
      if (remaining === 0) {
        await tx.taskDraft.updateMany({ where: { id: draftId }, data: { status: "CONFIRMED" } });
      }
    } catch {}
  }, { timeout: 30_000 }); // 2026-08-07：Neon 高延迟下防交互式事务默认 5s 超时（BUG-20260807-013）

  try {
    createDecisionLog({
      userId, action: "inbox_confirm",
      actionDetail: JSON.stringify({ draftId, count: confirmed.length, tasks: results.length }),
      reasoning: "用户确认了 Inbox 分析结果",
      targetId: draftId,
    }).catch(() => {});
  } catch {}

  // BUG-20260807-038（扩展）：Inbox 确认创建是主要创建入口——同样失效今日决策缓存，
  // 否则用户先打开 Today 再录入时，新任务永远进不了 mustDo（学习型等无排期任务不可达）。
  prisma.todayDecision.deleteMany({ where: { userId, date: localDateStr() } }).catch(() => {});

  return results;
}
