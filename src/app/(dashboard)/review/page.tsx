"use client";

import { useEffect, useState, useCallback } from "react";
import { DOMAINS, resolveDomain, THEMES, themeColor, THEME_FALLBACK } from "@/lib/plan/colors";
import { ThemeBadge } from "@/components/task/ThemeBadge";
import { PERIOD_KEYS, PERIOD_LABELS, periodOf } from "@/lib/task/periods";

// 设计稿短名：进度条/图例用（学习成长→学习、竞赛冲刺→竞赛、专业实践→实践、健康生活→健康、私人生活→生活）
const SHORT_LABEL: Record<string, string> = {
  course: "课程", learning: "学习", practice: "实践",
  health: "健康", life: "生活", external: "外部", other: "未分类",
};
const shortLabel = (key: string): string => SHORT_LABEL[key] ?? DOMAINS[key as keyof typeof DOMAINS]?.label ?? "未分类";

/* ═══════════════════════════════════════════
   Review · V2 视觉语言（阶段 2：对接真实数据）
   · 数据源：/api/views/stats
   · 战报卡（规则聚合 + DailySummary 文案）
   · 本周洞察（分类时间占比 / 最认真时段 / 时段偏好 / 打断）
   · 下周可以试试（规则建议 + 应用写入记忆）
   · 行为洞察（黄金时段 / 效率矩阵 / 周趋势 / 拖延率）
   · 产出日记（按天分组 + 深度专注/分2段标签）
   ═══════════════════════════════════════════ */

const cardCls = "bg-[var(--v2-card)] border border-[var(--v2-border)] rounded-xl sh-v2";

interface Daily { date: string; completedCount: number; totalMinutes: number; summaryText: string | null; }
interface TimeLogLite { id: string; durationSeconds: number; startedAt: string; type?: string | null; }
interface CompletedTask { id: string; title: string; taskType: string; importance: number; actualMinutes: number; tags: string | null; completedAt: string; timeLogs: TimeLogLite[]; }
interface StatsResponse {
  range: string;
  dailyBreakdown: Daily[];
  totalCompleted: number;
  totalMinutes: number;
  avgCompletionRate: number;
  behavioral: {
    peakHours: { hour: number; count: number; label: string }[];
    efficiencyByTag: { tag: string; ratio: number; count: number; totalActual: number; totalEstimated: number }[];
    weekOverWeek: { completedChange: number; minutesChange: number; direction: "up" | "down" | "flat" };
    procrastinationRate: number;
    delayedCount: number;
    totalActive: number;
  };
  completedTasks: CompletedTask[];
  periodBoundaries: [number, number, number, number];
  // V3 C8：指标卡（D2）+ 主题投入（D3/D17 按任务数）
  metrics?: { completionRate: number | null; adoptionRate: number | null; backlogRate: number | null; checkinKeepRate: number | null };
  themeBreakdown?: { theme: string; count: number; percent: number; label: string; prev?: number | null }[];
}

function fmtMinutes(m: number): string {
  if (m >= 60) return `${Math.floor(m / 60)}小时${m % 60 ? `${m % 60}分钟` : ""}`;
  return `${m} 分钟`;
}
// 进度条时长格式（设计稿改版）：3小时31分钟 → 3H31MIN
function fmtHM(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}H${String(min).padStart(2, "0")}MIN` : `${min}MIN`;
}
function weekLabel(range: string): string {
  try {
    const raw = (range || "").split(" - ")[0]?.trim();
    if (!raw) return "WEEK";
    // 兼容 "2026-07-27" / "2026.07.27" / "2026/07/27" 三种日期格式
    const m = raw.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (!m) return "WEEK";
    const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(start.getTime())) return "WEEK";
    const iso = (d: Date) => { const t = new Date(d); t.setDate(t.getDate() + 4); const y = t.getFullYear(); const w = Math.ceil(((t.getTime() - new Date(y, 0, 1).getTime()) / 86400000 + 1) / 7); return { y, w }; };
    const { y, w } = iso(start);
    return `WEEK ${w} · ${y}`;
  } catch { return "WEEK"; }
}

/* ═══════════════════════════════════════════
   V3：指标卡（D2 北极星 4 格）+ 主题投入（D3，resolveTheme 真实聚合）
   · 指标卡：周完成率/采纳率/堆积率/打卡保持率；数据来自 stats（缺失字段待阶段 C stats 升级）
   · 主题投入：主题 + 时长 + 占比 + 任务数（无 AI 依赖）
   ═══════════════════════════════════════════ */
function MetricCards({ stats }: { stats: StatsResponse }) {
  const m = stats.metrics;
  const metrics = [
    { label: "周完成率", value: m?.completionRate != null ? `${m.completionRate}%` : "—", sub: `完成 ${stats.totalCompleted} 件 · 北极星指标`, tone: "var(--v2-brand)" },
    { label: "AI 采纳率", value: m?.adoptionRate != null ? `${m.adoptionRate}%` : "—", sub: "AI 建议采纳比例", tone: "var(--v2-brand)" },
    { label: "堆积率", value: m?.backlogRate != null ? `${m.backlogRate}%` : "—", sub: "过滤失败信号 · 越低越好", tone: "#d97706" },
    { label: "打卡保持率", value: m?.checkinKeepRate != null ? `${m.checkinKeepRate}%` : "—", sub: "积累型任务连续打卡", tone: "#dc2626" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {metrics.map((mi) => (
        <div key={mi.label} className="bg-[var(--v2-card)] border border-[var(--v2-border)] rounded-xl sh-v2 p-3.5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-2" style={{ background: mi.tone }} />
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: mi.tone }} />
            <span className="text-sm font-medium text-[var(--v2-text2)]">{mi.label}</span>
          </div>
          <div className="text-[28px] font-bold leading-[1.2] mt-1.5 tabular-nums tracking-[-0.5px] text-[var(--v2-text)]">{mi.value}</div>
          <div className="text-[11.5px] text-[var(--v2-text3)] mt-1">{mi.sub}</div>
        </div>
      ))}
    </div>
  );
}

function ThemeInvestment({ stats }: { stats: StatsResponse }) {
  // V3 C8/D17：消费后端 themeBreakdown（按排期任务数聚合：theme/count/percent/label 主攻|待加强）
  // 方案 §3-③：每行加周环比趋势（后端需返回 prev 占比；未就绪显示 "—"）
  const rows = (stats.themeBreakdown ?? []).map((r) => ({ ...r, prev: (r as { prev?: number | null }).prev ?? null, t: themeColor(r.theme) ?? THEME_FALLBACK }));

  const trend = (cur: number, prev: number | null) => {
    if (prev == null) return { txt: "—", cls: "bg-[var(--color-gray-100)] text-[var(--v2-text3)]" };
    if (cur > prev) return { txt: `↑${cur - prev}%`, cls: "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" };
    if (cur < prev) return { txt: `↓${prev - cur}%`, cls: "bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]" };
    return { txt: "—", cls: "bg-[var(--color-gray-100)] text-[var(--v2-text3)]" };
  };

  return (
    <div className="bg-[var(--v2-card)] border border-[var(--v2-border)] rounded-xl sh-v2 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--v2-text)]">主题投入</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-gray-100)] text-[var(--v2-text2)]">本周</span>
        </div>
        <span className="text-[11px] text-[var(--v2-text3)]">按本周排期任务数聚合 · 较上周趋势待 stats API</span>
      </div>
      {rows.length === 0 && <div className="text-sm text-[var(--v2-text3)] py-2 text-center">数据不足 · 排期后生成</div>}
      {rows.length > 0 && (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const tr = trend(r.percent, r.prev);
            return (
              <div key={r.theme}>
                <div className="flex items-center gap-2">
                  <ThemeBadge theme={r.theme} />
                  <span className="text-sm text-[var(--v2-text2)] tabular-nums">{r.count} 项</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${r.label === "主攻" ? "bg-[var(--v2-brand-bg)] text-[var(--v2-brand-deep)]" : "bg-[var(--color-gray-100)] text-[var(--v2-text2)]"}`}>{r.label}</span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${tr.cls}`} title="较上周占比">{tr.txt}</span>
                  <span className="text-sm font-bold tabular-nums ml-auto" style={{ color: r.t.deep }}>{r.percent}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-[var(--color-gray-100)] overflow-hidden mt-1.5">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, r.percent)}%`, background: r.t.color }} />
                </div>
                <div className="text-[11px] text-[var(--v2-text3)] mt-1">占本周排期任务 {r.percent}%{tr.txt !== "—" ? ` · 较上周 ${tr.txt}` : ""}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 战报卡（设计稿：主色 / 最投入 / 关键词 / 发现条 / 3 数字） ── */
function ReportCard({ stats, period }: { stats: StatsResponse; period: "week" | "month" }) {
  const { totalCompleted, dailyBreakdown } = stats;
  // 关键词：只统计用户自定义 tag（过滤 domain:/important:/ai 等系统 tag，修复"关键词莫名一堆"）
  const SYSTEM_TAG = /^(domain|important|ai|taskType|source|auto|schedule|deadline):/i;
  const tagCount = new Map<string, number>();
  for (const t of stats.completedTasks) {
    if (!t.tags) continue;
    for (const tag of t.tags.split(",").map((s) => s.trim()).filter(Boolean)) {
      if (SYSTEM_TAG.test(tag) || tag === "ai") continue;
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }
  const TAG_COLORS = [
    { color: "#3b6d11", bg: "#eaf3de" },
    { color: "#534ab7", bg: "#eeedfe" },
    { color: "#0f6e56", bg: "#e1f5ee" },
  ];
  const keywords = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([text], i) => ({ text, ...TAG_COLORS[i % TAG_COLORS.length] }));
  // 最投入任务
  const topTask = [...stats.completedTasks].sort((a, b) => (b.timeLogs?.reduce((s, l) => s + l.durationSeconds, 0) ?? 0) - (a.timeLogs?.reduce((s, l) => s + l.durationSeconds, 0) ?? 0))[0];
  const topMinutes = topTask ? Math.round((topTask.timeLogs?.reduce((s, l) => s + l.durationSeconds, 0) ?? 0) / 60) : 0;
  // 本周主色：分类时间占比最大的分类
  const catMinutes = new Map<string, number>();
  for (const t of stats.completedTasks) {
    const key = resolveDomain(t.tags, t.title);
    const minutes = (t.timeLogs ?? []).reduce((s, l) => s + l.durationSeconds, 0) / 60;
    catMinutes.set(key, (catMinutes.get(key) ?? 0) + minutes);
  }
  const topCatEntry = [...catMinutes.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCat = topCatEntry ? DOMAINS[topCatEntry[0] as keyof typeof DOMAINS] : null;
  const catTotalAll = [...catMinutes.values()].reduce((s, v) => s + v, 0);
  const topCatTasks = catTotalAll > 0 && topCat
    ? stats.completedTasks
        .filter((t) => {
          const key = resolveDomain(t.tags, t.title);
          return key === topCatEntry![0];
        })
        .slice(0, 2)
        .map((t) => t.title)
    : [];
  const discovery = topCat && catTotalAll > 0
    ? `这周 ${Math.round((topCatEntry![1] / catTotalAll) * 100)}% 的时间都投入在「${shortLabel(topCatEntry![0])}」上${topCatTasks.length ? `——${topCatTasks.join("、")}${topCatTasks.length === 2 ? "，看得出真的很专注" : ""}` : ""}`
    : topTask
      ? `最投入「${topTask.title}」专注 ${fmtMinutes(topMinutes)}`
      : "";
  // 主色卡副标题：代表任务 · 的星期（设计稿「画原理图 · PCB 的星期」）
  const colorSub = topCatTasks.length >= 2 ? `${topCatTasks[0]} · ${topCatTasks[1]} 的星期` : topCatTasks.length === 1 ? `${topCatTasks[0]} 的星期` : "";
  // 之最卡辅助行：完成于星期几（视觉稿 v3：全周最长 · 周四 7/30）
  const topWeekday = topTask?.completedAt ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(topTask.completedAt).getDay()] : null;

  return (
    <div className={`${cardCls} p-[24px] mb-4 flex flex-col gap-4`}>
      <div className="text-[11px] font-medium tracking-[2px] text-[var(--v2-text3)]">{period === "week" ? `${weekLabel(stats.range)} · 你的本周` : `本月 · ${stats.range}`}</div>
      <div className="text-[24px] font-semibold tracking-[-0.3px] leading-[1.4] text-[var(--v2-text)]">
        {/* 摘要优先（AI 生成的周总结），占位文案回退到完成数 */}
        {(() => {
          const s = dailyBreakdown[dailyBreakdown.length - 1]?.summaryText?.trim();
          const placeholder = !s || /暂无记录|没有记录|暂无数据|无数据/.test(s);
          return placeholder
            ? (period === "week" ? `这一周，你完成了 ${totalCompleted} 件任务` : `这一个月，你完成了 ${totalCompleted} 件任务`)
            : s;
        })()}
      </div>

      {/* 双卡：本周主色 + 本周之最（视觉稿 v3 加厚：大色点 + 大数字 + 辅助行，min-h 112 不扁） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 bg-[var(--v2-purple-bg)] flex flex-col gap-1.5 min-h-[112px]">
          <div className="text-[11px] text-[#7c7ad8] tracking-wide">本周主色</div>
          {topCat ? (
            <>
              <div className="flex items-center gap-2">
                <span className="w-[34px] h-[34px] rounded-full shrink-0 border-2 border-white shadow-[0_0_0_1px_rgba(124,58,237,.25)]" style={{ background: topCat.border }} />
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-[var(--v2-text)]">{shortLabel(topCatEntry![0])}</div>
                  <div className="text-[11px] text-[#7c7ad8] mt-px truncate">{colorSub || "本周投入最多领域"}</div>
                </div>
              </div>
              <div className="flex items-baseline gap-2 mt-auto">
                <span className="text-[26px] font-bold tracking-[-0.5px] leading-none text-[#7c3aed] tabular-nums">{catTotalAll > 0 ? `${Math.round((topCatEntry![1] / catTotalAll) * 100)}%` : "—"}</span>
                <span className="text-[11px] text-[#7c7ad8]">全周时间投入占比</span>
              </div>
            </>
          ) : (
            <div className="text-[12px] text-[#7c7ad8]">完成任务后生成</div>
          )}
        </div>
        <div className="rounded-xl p-4 bg-[#f4f4f6] flex flex-col gap-1.5 min-h-[112px]">
          <div className="text-[11px] text-[var(--v2-text3)] tracking-wide">本周之最 · 最投入</div>
          {topTask ? (
            <>
              <div className="text-[16px] font-semibold text-[var(--v2-text)] truncate">{topTask.title}</div>
              <div className="flex items-baseline gap-2 mt-auto">
                <span className="text-[26px] font-bold tracking-[-0.5px] leading-none text-[var(--v2-text)] tabular-nums">{topMinutes}<span className="text-[13px] font-semibold text-[var(--v2-text2)]"> 分钟</span></span>
                <span className="text-[11px] text-[var(--v2-text3)]">全周最长{topWeekday ? ` · ${topWeekday}` : ""}</span>
              </div>
            </>
          ) : (
            <div className="text-[12px] text-[var(--v2-text3)]">完成任务后生成</div>
          )}
        </div>
      </div>

      {/* 本周关键词（视觉稿 v3：chip 加大 12px / px-14 py-4.5） */}
      <div className="rounded-xl px-[15px] py-3 bg-[#f4f4f6]">
        <div className="text-[11px] text-[var(--v2-text3)] mb-2">本周关键词</div>
        <div className="flex gap-1.5 flex-wrap">
          {keywords.length === 0 && <span className="text-[11px] text-[var(--v2-text3)]">完成任务后生成</span>}
          {keywords.map((k) => (
            <span key={k.text} className="text-[12px] font-medium px-[14px] py-[4.5px] rounded-full" style={{ color: k.color, background: k.bg }}>{k.text}</span>
          ))}
        </div>
      </div>

      {/* 发现条（视觉稿 v3.1：左侧紫竖条 + ✨ 白底方标 + 加宽；数据逻辑不变） */}
      {discovery && (
        <div className="flex items-start gap-2.5 text-[13px] leading-[1.6] text-[#3c3489] bg-[var(--v2-purple-bg)] rounded-xl px-4 py-3.5 border-l-4 border-[#8b5cf6]">
          <span className="w-[26px] h-[26px] rounded-lg bg-white flex items-center justify-center text-[13px] flex-none shadow-[0_1px_3px_rgba(124,58,237,.15)]">✨</span>
          <span className="min-w-0"><b className="font-semibold">发现：</b>{discovery}</span>
        </div>
      )}
    </div>
  );
}

/* ── 本周洞察（设计稿：任务类型时间占比 / 最认真时段 / 时段偏好 / 打断） ── */
function WeekInsight({ stats }: { stats: StatsResponse }) {
  const ins = stats.behavioral;

  // 任务时段偏好：分类 × 4 时段（时段边界来自 Settings 日分区边界，默认 8/12/18/22）
  const boundaries: [number, number, number, number] = stats.periodBoundaries ?? [8, 12, 18, 22];
  const catPeriod = new Map<string, Record<(typeof PERIOD_KEYS)[number], number>>();
  const catHours = new Map<string, number[]>(); // 24-bin 小时直方图（精确窗口用）
  for (const t of stats.completedTasks) {
    const key = resolveDomain(t.tags, t.title);
    for (const l of t.timeLogs ?? []) {
      const h = new Date(l.startedAt).getHours();
      const pk = periodOf(h, boundaries);
      const rec = catPeriod.get(key) ?? { morning: 0, afternoon: 0, evening: 0, midnight: 0 };
      rec[pk]++;
      catPeriod.set(key, rec);
      const bins = catHours.get(key) ?? new Array(24).fill(0);
      bins[h]++;
      catHours.set(key, bins);
    }
  }

  // 精确小时窗口：24-bin 直方图上滑动 3 小时找最密集窗口（跨天环绕）
  const bestWindow = (bins: number[]): { start: number; sum: number } => {
    let best = { start: 0, sum: -1 };
    for (let s = 0; s < 24; s++) {
      let sum = 0;
      for (let i = 0; i < 3; i++) sum += bins[(s + i) % 24];
      if (sum > best.sum) best = { start: s, sum };
    }
    return best;
  };

  // 候选分类：总次数 ≥2 的按总量降序取 top 3（结论行用）
  const catTotals = [...catPeriod.entries()]
    .map(([key, rec]) => ({ key, total: (Object.values(rec) as number[]).reduce((s, v) => s + v, 0) }))
    .filter((x) => x.total >= 2)
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  // 结论行：top 3 分类，窗口标签精确到小时（如「下午 14-17 点」）+ 任务证据
  const conclusionRows = catTotals.map((r) => {
    const bins = catHours.get(r.key) ?? new Array(24).fill(0);
    const w = bestWindow(bins);
    const pct = r.total > 0 ? Math.round((w.sum / r.total) * 100) : 0;
    const endH = (w.start + 3) % 24;
    const p0 = periodOf(w.start, boundaries);
    const p1 = periodOf(endH, boundaries);
    const windowLabel = `${PERIOD_LABELS[p0]} ${w.start}-${endH} 点`;
    const examples: string[] = [];
    for (const t of stats.completedTasks) {
      const tKey = resolveDomain(t.tags, t.title);
      if (tKey !== r.key) continue;
      for (const l of t.timeLogs ?? []) {
        const h = new Date(l.startedAt).getHours();
        if (h >= w.start && h < endH && l.durationSeconds > 0) {
          examples.push(`${t.title} ${String(h).padStart(2, "0")}:00`);
          break;
        }
      }
      if (examples.length >= 2) break;
    }
    const domain = DOMAINS[r.key as keyof typeof DOMAINS];
    return {
      key: r.key,
      label: shortLabel(r.key),
      color: domain?.border ?? "#94a3b8",
      windowLabel,
      pct,
      examples,
      count: r.total,
    };
  });

  // 打断次数（pause 类 TimeLog）
  const pauseCount = stats.completedTasks.reduce((s, t) => s + (t.timeLogs ?? []).filter((l) => l.type === "pause").length, 0);

  return (
    <div className={`${cardCls} p-5`}>
      <div className="text-sm font-semibold text-[var(--v2-text)] mb-4">本周洞察</div>

      <div className="border-t border-[var(--v2-border)] pt-3.5 space-y-3.5">
        {/* 任务时段偏好（设计稿 ai-line 行式 · 精确到小时窗口） */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-sm font-medium text-[var(--v2-text2)]">任务时段偏好</div>
            <div className="text-[11px] text-[var(--v2-text3)]">时段边界可在设置调整</div>
          </div>
          {conclusionRows.length === 0 && <div className="text-sm text-[var(--v2-text3)]">数据不足 · 完成任务后生成</div>}
          <div className="space-y-2.5">
            {conclusionRows.map((r) => (
              <div key={r.key} className="flex items-start gap-2.5">
                <span className="w-[64px] shrink-0 text-center text-[12px] px-2 py-[7px] rounded-lg font-semibold text-white" style={{ background: r.color }}>
                  {r.label}
                </span>
                <div className="min-w-0 flex-1 pt-[2px]">
                  <div className="text-[13px] leading-[1.6] text-[var(--v2-text2)]">
                    更喜欢在<b className="font-semibold text-[var(--v2-text)]">{r.windowLabel}</b>完成 · 占本周该类 <b className="font-semibold text-[var(--v2-text)]">{r.pct}%</b>
                  </div>
                  {r.examples.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {r.examples.map((ex, i) => (
                        <span key={i} className="text-[11px] px-2 py-[3px] rounded-full bg-[var(--v2-card)] border border-[var(--v2-border)] text-[var(--v2-text2)]">{ex}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 打断注意（设计稿 amber ai-tag） */}
        {pauseCount > 0 && (
          <div className="flex items-start gap-2.5">
            <span className="text-xs px-2.5 py-1 rounded-md font-medium whitespace-nowrap shrink-0 bg-[var(--v2-amber-bg)] text-[#b45309]">注意</span>
            <span className="text-sm text-[var(--v2-text2)] leading-[1.6]">{pauseCount} 次打断 · 集中在执行过程中，试试安排完整时间块</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── 下周可以试试（设计稿：逐条建议 + 应用） ── */
function NextSuggestions({ stats, onApplied }: { stats: StatsResponse; onApplied: (content: string) => Promise<boolean> }) {
  const ins = stats.behavioral;
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  const suggestions: { id: string; text: string; cond: boolean }[] = [];
  if (ins.procrastinationRate > 30) {
    suggestions.push({ id: "realistic", text: `执行率仅 ${Math.round(100 - ins.procrastinationRate)}%，下周排期要更现实（减少每天任务量）`, cond: true });
  }
  const peak = [...ins.peakHours].sort((a, b) => b.count - a.count)[0];
  if (peak && peak.hour < 12) {
    suggestions.push({ id: "deep", text: "深度工作排上午 —— 你的黄金时段在上午，把硬骨头放这里", cond: true });
  } else if (peak) {
    suggestions.push({ id: "deep", text: `深度工作排${peak.hour < 18 ? "下午" : "晚上"} —— 你的黄金时段在这段时间`, cond: true });
  }
  const pauseCount = stats.completedTasks.reduce((s, t) => s + (t.timeLogs ?? []).filter((l) => l.type === "pause").length, 0);
  if (pauseCount >= 3) {
    suggestions.push({ id: "quiet", text: "找一段不被打扰的时间（今天有多次中断）", cond: true });
  }

  const apply = async (id: string, text: string) => {
    setBusy(id);
    try {
      const ok = await onApplied(text);
      if (ok) setApplied((prev) => new Set(prev).add(id));
    } finally { setBusy(null); }
  };

  if (suggestions.length === 0) return null;

  // 设计稿 action 条：绿底绿边 · 🎯 标题 · ①②③ 编号 · 应用按钮
  return (
    <div style={{ background: "var(--v2-green-bg)", border: "1px solid var(--v2-green-border, #bbf7d0)", borderRadius: 12, padding: "14px 16px" }}>
      <div className="text-[13px] font-semibold" style={{ color: "#14532d" }}>🎯 下周可以试试</div>
      <div className="text-[11.5px] mb-1.5" style={{ color: "#4d7c0f" }}>逐条应用 · 只采纳符合你情况的建议</div>
      {suggestions.map((s, i) => (
        <div key={s.id + i} className="flex items-center gap-2.5" style={{ padding: "7px 0", borderTop: i === 0 ? "none" : "1px dashed #d7eecf" }}>
          <span className="text-[12px] font-semibold shrink-0" style={{ color: "#4d7c0f" }}>{"①②③④"[i]}</span>
          <span className="text-[13px] flex-1 min-w-0" style={{ color: "#14532d" }}>{s.text}</span>
          <button onClick={() => apply(s.id, s.text)} disabled={busy === s.id || applied.has(s.id)}
            className="text-[12px] px-3 py-1 rounded-md font-medium shrink-0 transition-all disabled:opacity-60"
            style={applied.has(s.id) ? { background: "#16a34a", color: "#fff" } : { background: "#16a34a", color: "#fff" }}>
            {busy === s.id ? "保存中…" : applied.has(s.id) ? "已应用 ✓" : "应用"}
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── 产出日记 ── */
function DayDiary({ daily, completed }: { daily: Daily[]; completed: CompletedTask[] }) {
  // 设计稿：本周成果 · 产出日记（day-block / task-row：时间 + 分类色点 + 名称 + 深度专注/分段 tag + 时长）
  const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const now2 = new Date();
  const todayStr = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, "0")}-${String(now2.getDate()).padStart(2, "0")}`;
  const isTodayCellFn = (date: string) => todayStr === date;
  const rangeLabel = daily.length > 0 ? `${daily[0].date.slice(5).replace("-", "/")} – ${daily[daily.length - 1].date.slice(5).replace("-", "/")}` : "";
  // 分类色：从 tags 的 domain: 或标题推断
  const taskColor = (t: CompletedTask): string => {
    const key = resolveDomain(t.tags, t.title);
    return DOMAINS[key as keyof typeof DOMAINS]?.border ?? "#94a3b8";
  };
  const maxDayMinutes = Math.max(1, ...daily.map((d) => d.totalMinutes));

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15.5px] font-semibold text-[var(--v2-text)]">本周成果</span>
          <span className="text-xs text-[var(--v2-text3)]">{rangeLabel || "按天"}</span>
        </div>
        <span className="text-xs text-[var(--v2-text3)]">按天 · 按时间</span>
      </div>
      {daily.length === 0 && <div className="text-sm text-[var(--v2-text3)] py-4 text-center">本周还没有记录</div>}
      <div className="space-y-2 mt-3">
        {daily.map((d) => {
          const tasks = completed.filter((t) => t.completedAt?.startsWith(d.date));
          const date = new Date(d.date + "T12:00:00");
          const dayName = DAY_NAMES[date.getDay()];
          const isTodayCell = isTodayCellFn(d.date);
          const isPeak = d.totalMinutes >= maxDayMinutes * 0.9 && d.totalMinutes > 0 && daily.filter((x) => x.totalMinutes > 0).length > 1;
          const totalFmt = d.totalMinutes > 0 ? fmtMinutes(d.totalMinutes) : "";
          return (
            <div key={d.date} className={`rounded-[10px] ${isPeak ? "bg-[#fffbeb] border border-[#fde68a] px-3 py-2.5 -mx-1" : "border-b border-[var(--v2-border)] pb-2"} ${isTodayCell ? "!border-b-0" : ""}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[14.5px] font-medium ${isPeak ? "text-[#92400e]" : isTodayCell ? "text-[var(--v2-brand)]" : "text-[var(--v2-text)]"}`}>
                  {dayName} {d.date.slice(5).replace("-", "/")}
                </span>
                {isTodayCell ? (
                  <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--v2-brand)] text-white font-medium">今天</span>
                ) : d.completedCount > 0 ? (
                  <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${isPeak ? "bg-[#fde68a] text-[#92400e]" : "bg-[var(--color-gray-100)] text-[var(--v2-text2)]"}`}>
                    {d.completedCount} 件{totalFmt ? ` · ${totalFmt}` : ""}
                  </span>
                ) : (
                  <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--color-gray-100)] text-[var(--v2-text3)]">休息</span>
                )}
              </div>
              {tasks.length === 0 && (
                <p className={`text-[13px] ${isTodayCell ? "text-[var(--v2-brand)]" : "text-[var(--v2-text3)]"}`}>
                  {(() => {
                    const s = d.summaryText?.trim();
                    const placeholder = !s || /暂无记录|没有记录|暂无数据/.test(s);
                    return placeholder ? (isTodayCell ? "进行中 · 完成 1 件即可点亮今天" : "休整一天，明天继续") : s;
                  })()}
                </p>
              )}
              {tasks.map((t) => {
                const logs = t.timeLogs ?? [];
                const segs = logs.filter((l) => l.durationSeconds > 0).length;
                const longest = logs.reduce((mx, l) => Math.max(mx, l.durationSeconds), 0);
                const deepFocus = segs === 1 && longest >= 40 * 60;
                const multi = segs >= 2;
                const color = taskColor(t);
                const time = t.completedAt?.slice(11, 16) || "";
                return (
                  <div key={t.id} className="flex items-center gap-2.5 py-1">
                    {/* 时间列：固定宽度，永不被标签挤占 */}
                    <span className={`text-[13.5px] tabular-nums w-12 shrink-0 ${isPeak ? "text-[#b45309]" : "text-[var(--v2-text3)]"}`}>{time}</span>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className={`text-[15px] min-w-0 truncate flex-1 ${isPeak ? "text-[#451a03]" : "text-[var(--v2-text)]"}`}>{t.title}</span>
                    {/* 标签区：固定宽度右对齐（深度专注 / 分N段 纵向对齐） */}
                    <span className="w-[68px] shrink-0 flex justify-end gap-1">
                      {deepFocus && <span className="text-[12px] px-1.5 py-px rounded-full font-medium bg-[var(--color-brand-50)] text-[var(--v2-brand-deep)] whitespace-nowrap">深度专注</span>}
                      {multi && <span className="text-[12px] px-1.5 py-px rounded-full font-medium bg-[var(--color-gray-100)] text-[var(--color-gray-500)] whitespace-nowrap">分{segs}段</span>}
                    </span>
                    {/* 时长列：固定宽度右对齐，无时长也保留空位 */}
                    <span className={`text-[13.5px] tabular-nums w-24 shrink-0 text-right ${isPeak ? "text-[#b45309] font-medium" : "text-[var(--v2-text2)]"}`}>{t.actualMinutes > 0 ? fmtMinutes(t.actualMinutes) : ""}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {/* 图例（设计稿 legend：实践/学习/竞赛/课程/健康/生活 短名 + 深度专注 + 分N段） */}
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 mt-4 pt-3 border-t border-[var(--v2-border)]">
        {(Object.entries(DOMAINS) as [string, { label: string; border: string }][]).filter(([k]) => k !== "other").map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-[12px] text-[var(--v2-text2)]">
            <span className="w-2 h-2 rounded-full" style={{ background: v.border }} />{v.label.replace("成长", "").replace("冲刺", "").replace("生活", "").replace("私人", "").replace("专业", "").replace("社团/学校任务", "外部")}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--v2-text2)]">
          <span className="w-2 h-2 rounded-full bg-[var(--v2-brand-deep)]" />深度专注
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-[var(--v2-text2)]">
          <span className="w-2 h-2 rounded-full bg-[var(--color-gray-400)]" />分N段
        </span>
      </div>
    </div>
  );
}

/* ── 页面 ── */
export default function ReviewPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<"week" | "month">("week");

  const load = useCallback(async (range = "week") => {
    setLoading(true); setError(false);
    try {
      const r = await fetch(`/api/views/stats?range=${range}`);
      if (!r.ok) throw new Error();
      setStats(await r.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // 应用建议：写入长期记忆（preference）
  const applySuggestion = useCallback(async (content: string): Promise<boolean> => {
    try {
      const r = await fetch("/api/agent/memory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, memoryType: "preference" }),
      });
      return r.ok;
    } catch { return false; }
  }, []);

  if (loading) return <div className="space-y-3"><div className="h-8 w-56 rounded bg-[var(--color-gray-100)] animate-pulse" /><div className="h-64 rounded-xl bg-[var(--color-gray-100)] animate-pulse" /><div className="h-48 rounded-xl bg-[var(--color-gray-100)] animate-pulse" /></div>;
  if (error || !stats) return (
    <div className="text-center py-16">
      <div className="text-[15px] font-medium text-[var(--v2-text)] mb-2">加载复盘数据失败</div>
      <button onClick={() => load()} className="text-sm px-4 py-2 rounded-lg bg-[var(--v2-brand)] text-white hover:bg-[var(--v2-brand-deep)] transition">重试</button>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-semibold tracking-[-0.3px] text-[var(--v2-text)]">回顾</h2>
          <p className="text-xs text-[var(--v2-text3)]/70 mt-1">看见自己做到了什么，比上周更好</p>
        </div>
        {/* 本周 / 本月 分段（设计稿） */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-[var(--color-gray-100)] shrink-0 mt-1">
          {(["week", "month"] as const).map((p) => (
            <button key={p} onClick={() => { setPeriod(p); load(p); }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === p ? "bg-white text-[var(--v2-text)] shadow-[var(--shadow-card)]" : "text-[var(--v2-text2)] hover:text-[var(--v2-text)]"
              }`}>
              {p === "week" ? "本周" : "本月"}
            </button>
          ))}
        </div>
      </div>
      {/* V3 §7.2 两栏化（用户验收修订 20:29）：战报全宽置顶 → 左主叙事(本周成果+本周洞察) | 右仪表(指标2×2+主题投入, 不 sticky)
          下周建议(AI) 沉底全宽独立；<860px 回退单栏：战报 → 指标 → 主题 → 成果 → 洞察 → 建议 */}
      <ReportCard stats={stats} period={period} />

      <div className="grid grid-cols-1 lg:grid-cols-[13fr_7fr] gap-4 items-start">
        {/* 右列 · 仪表区（指标 2×2 + 主题投入；用户验收：滚动须跟随，去掉 sticky） */}
        <div className="order-1 lg:order-none lg:col-start-2 lg:row-start-1 space-y-4 min-w-0">
          <MetricCards stats={stats} />
          <ThemeInvestment stats={stats} />
        </div>
        {/* 左列 · 主叙事 1：本周成果 */}
        <div className="order-2 lg:order-none lg:col-start-1 lg:row-start-1 min-w-0">
          <DayDiary daily={stats.dailyBreakdown} completed={stats.completedTasks} />
        </div>
        {/* 左列 · 主叙事 2：本周洞察（与本周成果一块，证据→结论承接） */}
        <div className="order-3 lg:order-none lg:col-start-1 lg:row-start-2 min-w-0">
          <WeekInsight stats={stats} />
        </div>
      </div>

      {/* 下周建议（AI 行动区）：沉底全宽独立，不占主叙事位置 */}
      <div className="mt-4">
        <NextSuggestions stats={stats} onApplied={applySuggestion} />
      </div>
    </div>
  );
}
