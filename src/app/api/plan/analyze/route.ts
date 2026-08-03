import { NextRequest, NextResponse } from "next/server";
import { localDateStr } from "@/lib/date";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { getWeeklyPlan } from "@/lib/plan/service";
import { adaptPlanData } from "@/lib/plan/adapter";
import { analyzePlan } from "@/lib/plan/conflict";
import type { PlanAnalysisResult } from "@/lib/plan/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const weekStartStr = body.weekStart;
    const weekStart = weekStartStr ? new Date(weekStartStr) : (() => {
      const d = new Date();
      const day = d.getDay();
      d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const plan = await getWeeklyPlan(session.user.id, weekStart);
    const { interactions } = adaptPlanData(plan.items, [], weekStart);
    const { issues, healthScore } = analyzePlan(interactions);

    // Generate suggestions for overloaded days
    const suggestions: PlanAnalysisResult["suggestions"] = [];
    const overloadIssues = issues.filter(i => i.type === "overload");
    if (overloadIssues.length > 0 && interactions.length > 0) {
      // Find a free day to suggest moving tasks
      const dayLoad = new Map<string, number>();
      for (const item of interactions) {
        const dk = localDateStr(item.start);
        dayLoad.set(dk, (dayLoad.get(dk) || 0) + item.durationMinutes);
      }
      const freeDays = Array.from(dayLoad.entries())
        .filter(([, m]) => m <= 120)
        .sort((a, b) => a[1] - b[1]);

      if (freeDays.length > 0) {
        const busyItems = interactions
          .filter(i => i.importance >= 4 && i.durationMinutes >= 60)
          .sort((a, b) => b.importance - a.importance);
        if (busyItems.length > 0) {
          suggestions.push({
            action: "move",
            taskId: busyItems[0].taskId,
            taskTitle: busyItems[0].title,
            targetDate: freeDays[0][0],
            targetStart: freeDays[0][0] + "T14:00:00",
            reason: freeDays[0][0] + " 时间充裕，可分担压力",
          });
        }
      }
    }

    const result: PlanAnalysisResult = { issues, suggestions, healthScore };
    return NextResponse.json(result);
  } catch (e) {
    console.error("[plan/analyze]", e);
    return NextResponse.json({ error: "分析失败" }, { status: 500 });
  }
}
