import type { ScheduleCardData, PlanInteractionItem, DeadlineItem } from "./types";
import { realTimeToVisualTime } from "./time";
import { resolveDomain, formatParentLabel, type DomainKey } from "./colors";
import { localDateStr } from "@/lib/date";

export interface AdaptedTask {
  id: string; title: string; scheduleId: string;
  date: string; realDate: string;
  startTime: string; endTime: string | null; durationMinutes: number;
  importance: number; status: string; source: "HARD" | "AI_PROPOSED" | "SYSTEM";
  domain: DomainKey;
  parentLabel: string | null;
  isAI: boolean;
}

export interface AdaptedPeriod {
  key: string; label: string; startHour: number; endHour: number; tasks: AdaptedTask[];
}

export interface AdaptedDay {
  date: string; label: string; dayNum: number; isToday: boolean; periods: AdaptedPeriod[];
}

export interface AdaptedIdeas { id: string; title: string; label: string; estimatedMinutes?: number | null; domain: DomainKey; }

export interface DayDensity {
  totalMinutes: number; taskCount: number; fullness: number; level: "low" | "medium" | "high" | "overload";
}

const PERIODS = [
  { key: "morning", label: "上午", startHour: 8, endHour: 13 },
  { key: "afternoon", label: "下午", startHour: 13, endHour: 18 },
  { key: "evening", label: "晚上", startHour: 18, endHour: 24 },
  { key: "midnight", label: "凌晨", startHour: 0, endHour: 3 },
];

const DAY_LABELS = ["周一","周二","周三","周四","周五","周六","周日"];
const WAKING_MINUTES = 900;

export function mapSource(source: string): "HARD" | "AI_PROPOSED" | "SYSTEM" {
  if (source === "ai") return "AI_PROPOSED";
  if (source === "ai_fallback") return "SYSTEM";
  return "HARD";
}

export function computeDayDensity(day: AdaptedDay): DayDensity {
  let totalMinutes = 0; let taskCount = 0;
  for (const p of day.periods) { for (const t of p.tasks) { totalMinutes += t.durationMinutes; taskCount++; } }
  const fullness = Math.min(100, Math.round((totalMinutes / WAKING_MINUTES) * 100));
  let level: DayDensity["level"] = "low";
  if (fullness >= 80) level = "overload"; else if (fullness >= 50) level = "high"; else if (fullness >= 25) level = "medium";
  return { totalMinutes, taskCount, fullness, level };
}

function fmtTime(iso: string): string { const d = new Date(iso); return d.getHours().toString().padStart(2,"0")+":"+d.getMinutes().toString().padStart(2,"0"); }
function calcDuration(s: string, e: string|null): number { if (!e) return 60; return Math.round((new Date(e).getTime()-new Date(s).getTime())/60000); }
function getLocalDate(iso: string): string { const d = new Date(iso); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

export function adaptPlanData(
  planItems: { taskId:string; title:string; schedule:{id:string;start:string;end:string|null;source:string}|null; status:string; importance:number; }[],
  rawTasks: { id:string; title:string; taskType:string; tags?:string|null; deadline:string|null; estimatedMinutes:number|null; status:string; parentId?:string|null; }[],
  weekStart: Date
): { days: AdaptedDay[]; ideas: AdaptedIdeas[]; deadlineTasks: DeadlineItem[]; interactions: PlanInteractionItem[] } {
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);

  const days: Date[] = Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(d.getDate()+i);return d});
  const scheduledIds=new Set<string>();
  const scheduledMinutesMap = new Map<string, number>();
  const schedulesByTask = new Map<string, { date:string; start:string; end:string; durationMinutes:number }[]>();

  // Build lookup map for tags, parentId etc
  const taskMap = new Map<string, (typeof rawTasks)[number]>();
  for (const t of rawTasks) taskMap.set(t.id, t);

  const daysData: AdaptedDay[] = days.map(d=>{
    const dateStr=getLocalDate(d.toISOString()); const dayIdx=(d.getDay()+6)%7;
    const dayItems = planItems.filter(item => {
      if (!item.schedule?.start) return false;
      const realDate = getLocalDate(item.schedule.start); const realHour = new Date(item.schedule.start).getHours();
      const { displayDate } = realTimeToVisualTime(realDate, realHour);
      return displayDate === dateStr;
    });
    dayItems.forEach(item=>scheduledIds.add(item.taskId));
    const periods: AdaptedPeriod[] = PERIODS.map(p=>{
      const tasks: AdaptedTask[]=dayItems.filter(item=>{if(!item.schedule?.start)return false;const h=new Date(item.schedule.start).getHours();return h>=p.startHour&&h<p.endHour;})
        .sort((a,b)=>new Date(a.schedule!.start).getTime()-new Date(b.schedule!.start).getTime())
        .map(item=>{
          const realDate=getLocalDate(item.schedule!.start);
          const realHour=new Date(item.schedule!.start).getHours();
          const dur = calcDuration(item.schedule!.start,item.schedule!.end);
          scheduledMinutesMap.set(item.taskId, (scheduledMinutesMap.get(item.taskId) || 0) + dur);
          const schedEntry = {
            date: dateStr,
            start: realHour.toString().padStart(2,"0")+":"+new Date(item.schedule!.start).getMinutes().toString().padStart(2,"0"),
            end: item.schedule!.end?fmtTime(item.schedule!.end):"",
            durationMinutes: dur,
          };
          if (!schedulesByTask.has(item.taskId)) schedulesByTask.set(item.taskId, []);
          schedulesByTask.get(item.taskId)!.push(schedEntry);

          const raw = taskMap.get(item.taskId);
          const domain = resolveDomain(raw?.tags, item.title);
          const isAI = item.schedule!.source === "ai" || item.schedule!.source === "ai_fallback"
                    || (raw?.taskType === "planned" && !!raw?.parentId);
          const parentLabel = raw?.parentId
            ? formatParentLabel(taskMap.get(raw.parentId)?.title || "")
            : null;

          return {
            id:item.taskId,title:item.title,scheduleId:item.schedule!.id,
            date:dateStr, realDate,
            startTime:schedEntry.start,
            endTime:item.schedule!.end?fmtTime(item.schedule!.end):null,
            durationMinutes:dur,
            importance:item.importance||3,status:item.status,source:mapSource(item.schedule!.source),
            domain, parentLabel, isAI,
          };
        });
      return {...p,tasks};
    });
    return {date:dateStr,label:DAY_LABELS[dayIdx],dayNum:d.getDate(),isToday:d.toDateString()===new Date().toDateString(),periods};
  });

  // ── Deadline tasks ──
  const now = new Date();
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const deadlineTasks: DeadlineItem[] = rawTasks
    .filter(t => {
      if (!t.deadline) return false;
      if (t.status === "completed" || t.status === "cancelled") return false;
      const dl = new Date(t.deadline);
      return dl >= weekStart && dl < weekEnd;
    })
    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
    .map(t => {
      const dl = new Date(t.deadline!);
      const dlUTC = Date.UTC(dl.getFullYear(), dl.getMonth(), dl.getDate());
      const remainingDays = Math.max(0, Math.round((dlUTC - todayUTC) / 86400000));
      const domain = resolveDomain(t.tags, t.title);
      return {
        taskId: t.id,
        title: t.title,
        deadline: localDateStr(dl),
        estimatedMinutes: t.estimatedMinutes,
        scheduledMinutes: scheduledMinutesMap.get(t.id) || 0,
        remainingDays,
        hasSchedule: scheduledIds.has(t.id),
        schedules: schedulesByTask.get(t.id) || [],
        domain,
      };
    });

  const deadlineIds = new Set(deadlineTasks.map(t => t.taskId));
  const ideas:AdaptedIdeas[]=rawTasks
    .filter(t=>!scheduledIds.has(t.id)&&!deadlineIds.has(t.id)&&t.status!=="completed"&&t.status!=="cancelled"&&t.taskType!=="scheduled")
    .map(t=>{
      const domain = resolveDomain(t.tags, t.title);
      return {id:t.id,title:t.title,label:t.estimatedMinutes?"约"+t.estimatedMinutes+"分钟":"以后再说",estimatedMinutes:t.estimatedMinutes,domain};
    });

  // 修复：构建 interactions（原实现恒为空数组，导致 plan/analyze 健康分恒 100、建议永不生成）
  const interactions: PlanInteractionItem[] = planItems
    .filter(p => p.schedule)
    .map(p => ({
      taskId: p.taskId,
      title: p.title,
      scheduleId: p.schedule!.id,
      start: new Date(p.schedule!.start),
      end: p.schedule!.end ? new Date(p.schedule!.end) : null,
      durationMinutes: p.schedule!.end ? Math.max(1, Math.round((new Date(p.schedule!.end).getTime() - new Date(p.schedule!.start).getTime()) / 60000)) : 60,
      importance: p.importance,
      source: (p.schedule!.source === "ai" ? "AI" : p.schedule!.source === "user" ? "USER" : "SYSTEM") as "USER" | "AI" | "SYSTEM",
      status: p.status === "completed" ? "completed" : "pending",
    }));

  return {days:daysData,ideas,deadlineTasks,interactions};
}
