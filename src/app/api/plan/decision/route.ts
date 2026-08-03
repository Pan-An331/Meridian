import { NextRequest, NextResponse } from "next/server";
import { localDateStr } from "@/lib/date";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { getWeeklyPlan } from "@/lib/plan/service";
import { adaptPlanData } from "@/lib/plan/adapter";
import { analyzePlan } from "@/lib/plan/conflict";

// ─── Types ───

interface DecisionOption {
  id: string;
  title: string;
  changes: { taskId: string; taskTitle: string; oldTime: string; newTime: string; newStart: string; newEnd: string }[];
  reason: string;
}

/**
 * POST /api/plan/decision
 * Rule-based decision engine — generates optimization options without LLM.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const weekStartStr = body.weekStart;
    const weekStart = weekStartStr ? new Date(weekStartStr) : (() => {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      d.setHours(0, 0, 0, 0); return d;
    })();

    const plan = await getWeeklyPlan(session.user.id, weekStart);
    const { interactions } = adaptPlanData(plan.items, [], weekStart);
    const { issues, healthScore } = analyzePlan(interactions);

    const options: DecisionOption[] = [];

    // ── Rule 1: If overload exists, suggest moving a task to a free day ──
    const dayLoad = new Map<string, number>();
    for (const item of interactions) {
      const dk = localDateStr(item.start);
      dayLoad.set(dk, (dayLoad.get(dk) || 0) + item.durationMinutes);
    }

    const overloadedDays = Array.from(dayLoad.entries()).filter(([, m]) => m >= 360);
    const freeDays = Array.from(dayLoad.entries()).filter(([, m]) => m <= 120).sort((a, b) => a[1] - b[1]);

    if (overloadedDays.length > 0 && freeDays.length > 0) {
      const busyDate = overloadedDays[0][0];
      const freeDate = freeDays[0][0];

      // Find a task on the busy day to move
      const busyTasks = interactions.filter(i =>
        localDateStr(i.start) === busyDate && i.source !== "SYSTEM"
      ).sort((a, b) => a.importance - b.importance); // move least important first

      if (busyTasks.length > 0) {
        const target = busyTasks[0];
        const oldTime = target.start.toTimeString().slice(0, 5);
        const newTime = "10:00";
        options.push({
          id: "A",
          title: "移动 " + target.title + " 到 " + freeDate,
          changes: [{
            taskId: target.taskId, taskTitle: target.title,
            oldTime: busyDate + " " + oldTime,
            newTime: freeDate + " " + newTime,
            newStart: freeDate + "T" + newTime + ":00",
            newEnd: freeDate + "T11:00:00",
          }],
          reason: "减轻 " + busyDate + " 的负担，利用 " + freeDate + " 的空闲时间",
        });
      }
    }

    // ── Rule 2: If long session exists, suggest splitting ──
    const longSessions = interactions.filter(i => i.durationMinutes >= 180);
    if (longSessions.length > 0) {
      const session = longSessions[0];
      const date = localDateStr(session.start);
      const start = session.start.toTimeString().slice(0, 5);
      const midTime = new Date(session.start.getTime() + session.durationMinutes * 30000).toTimeString().slice(0, 5);
      options.push({
        id: "B",
        title: "拆分 " + session.title,
        changes: [{
          taskId: session.taskId, taskTitle: session.title,
          oldTime: date + " " + start + " (" + Math.round(session.durationMinutes / 60) + "h)",
          newTime: "拆分为两段",
          newStart: date + "T" + start + ":00",
          newEnd: date + "T" + midTime + ":00",
        }],
        reason: session.title + " 连续 " + Math.round(session.durationMinutes / 60) + " 小时，建议拆分并安排休息",
      });
    }

    // ── Rule 3: Keep current ──
    options.push({
      id: "C",
      title: "保持当前安排",
      changes: [],
      reason: "当前安排没有严重问题，继续保持",
    });

    return NextResponse.json({ healthScore, issues, options });
  } catch (e) {
    console.error("[plan/decision]", e);
    return NextResponse.json({ error: "决策失败" }, { status: 500 });
  }
}
