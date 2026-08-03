"use client";

import { useEffect, useState } from "react";
import { getFcLayout, type FcLayout } from "@/lib/ui-preferences";

/* ═══════════════════════════════════════════
   FocusCardLayouts — Focus Card 版式骨架（一栏 / 两栏）
   集成说明：
   · 现有 src/components/today/FocusTaskCard.tsx 是 V3（真实任务+执行状态）
   · 本文件提供两种版式的 JSX 骨架与数据形态，供接入
   · 接入方式：FocusTaskCard 内部按 fcLayout 渲染 <LayoutOne/> 或 <LayoutTwo/>
   · 时间型/清单型/学习型 三种任务共用该骨架（主体区不同）
   ═══════════════════════════════════════════ */

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  meta?: string;      // "18分" / "进行中" / "待开始"
  active?: boolean;   // 当前进行项
}

export interface FocusCardData {
  parent: string;          // 归属项目
  title: string;
  type: "timer" | "checklist" | "learning";
  tagLabel: string;        // 计时型 / 清单型 / 学习型
  timeRange: string;       // "9:00 - 11:00"
  plannedMinutes: number;
  doneCount: number;
  totalCount: number;
  progress: number;        // 0-100
  elapsedMinutes: number;
  items: ChecklistItem[];  // 清单 / 知识点
}

/** 防御性：把任意数值收敛到 0-100 的合法百分比，NaN/Infinity 一律回落 0 */
export function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** 由 done/total 推导百分比（total=0 时返回 0），避免调用方重复除零判断 */
export function ratioPercent(done: number, total: number): number {
  return total > 0 ? clampProgress((done / total) * 100) : 0;
}

/* ── 一栏（放大版）：内容纵向铺开 ── */
export function FocusCardLayoutOne({ data }: { data: FocusCardData }) {
  return (
    <div className="rounded-xl border border-[var(--page-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] p-7 flex flex-col gap-3.5">
      <div className="text-[11px] text-[var(--color-text-tertiary)]">{data.parent}</div>
      <h2 className="text-2xl font-semibold tracking-tight">{data.title}</h2>
      <div className="flex items-center gap-2">
        <span className="text-[10px] px-2 py-0.5 rounded-lg font-medium bg-orange-50 text-orange-600">{data.tagLabel}</span>
        <span className="text-xs text-[var(--color-text-tertiary)]">预计 {data.plannedMinutes} 分钟</span>
      </div>

      {/* 清单 / 知识点主体 */}
      <div className="bg-[#fff9e6] border-l-[3px] border-[#f5a623] rounded-lg px-3 py-2.5">
        <div className="text-[10px] font-semibold text-[#8b6914] mb-1.5">{data.type === "learning" ? "本章知识点" : "执行清单"}</div>
        {data.items.map((it) => (
          <div key={it.id} className="flex items-center gap-1.5 py-0.5">
            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] shrink-0 ${it.done ? "bg-[#d4a853] text-white" : "border border-[#d4a853]"}`}>
              {it.done ? "✓" : ""}
            </span>
            <span className={`text-[11px] ${it.done ? "line-through text-[#b09850]" : "text-[#8b6914]"} ${it.active ? "font-medium" : ""}`}>{it.text}</span>
            {it.meta && <span className="ml-auto text-[9px] text-[#b09850]">{it.meta}</span>}
          </div>
        ))}
      </div>

      <div className="text-[10px] text-[var(--color-text-tertiary)]">已完成 {data.doneCount}/{data.totalCount} · 总耗时 {data.elapsedMinutes} 分钟</div>
      <div className="h-1 rounded bg-gray-100 overflow-hidden">
        <div className="h-full rounded bg-[var(--color-success-text)]" style={{ width: `${ratioPercent(data.doneCount, data.totalCount)}%` }} />
      </div>

      <div className="flex gap-2">
        <button className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-gray-100 text-[var(--color-text-secondary)] hover:bg-gray-200 transition">跳过</button>
        <button className="flex-[2] py-2 rounded-lg text-[13px] font-medium text-white bg-[var(--color-success-text)] hover:bg-[#15803d] transition">完成 1 项</button>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-md bg-ai-50 text-ai-600">
        <span className="font-semibold text-[9px] shrink-0">AI 执行</span>
        <span>上次类似任务你花了 90 分钟</span>
      </div>
      <div className="text-center text-[10px] text-[var(--color-text-tertiary)]">做产品/项目 — 以产出清单为准，计时是辅助</div>
    </div>
  );
}

/* ── 两栏：左信息栏 + 右内容区 ── */
export function FocusCardLayoutTwo({ data, stages }: { data: FocusCardData; stages: { name: string; done?: boolean; current?: boolean }[] }) {
  return (
    <div className="rounded-xl border border-[var(--page-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden flex">
      {/* 左信息栏 */}
      <div className="w-[36%] shrink-0 bg-[#fafafa] border-r border-[var(--page-border-subtle)] px-3.5 py-4 flex flex-col gap-1.5">
        <div className="text-[13px] font-semibold text-brand-600">{data.parent}</div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-[3px] rounded bg-gray-100 overflow-hidden">
            <div className="h-full rounded bg-brand-500" style={{ width: `${ratioPercent(data.doneCount, data.totalCount)}%` }} />
          </div>
          <span className="text-[8px] text-[var(--color-text-tertiary)]">{data.doneCount}/{data.totalCount}</span>
        </div>
        <div className="h-px bg-gray-100 my-0.5" />
        <div className="text-[9px] text-[var(--color-text-tertiary)] tracking-wide">阶段</div>
        {stages.map((s) => (
          <div key={s.name}
            className={`text-[10px] px-2.5 py-0.5 rounded-md flex items-center gap-1 ${
              s.current ? "bg-brand-100 border-l-4 border-brand-500 font-medium text-brand-700"
              : s.done ? "line-through text-[var(--color-text-tertiary)]" : "text-[var(--color-text-secondary)]"
            }`}>
            {s.name}
            {s.done && <span>✓</span>}
          </div>
        ))}
        <div className="h-px bg-gray-100 my-1" />
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium self-start">{data.tagLabel}</span>
        <div className="text-[11px] text-[var(--color-text-primary)]">{data.timeRange}</div>
        <div className="text-[10px] text-[var(--color-text-secondary)] -mt-0.5">预计 {data.plannedMinutes} 分钟</div>
        <div className="h-px bg-gray-100 my-0.5" />
        <div className="flex justify-between text-[10px] text-[var(--color-text-secondary)]">
          <span>本任务 {data.doneCount}/{data.totalCount}</span>
          <span className="text-[var(--color-success-text)] font-medium">{ratioPercent(data.doneCount, data.totalCount)}%</span>
        </div>
        <div className="h-[3px] rounded bg-gray-100 overflow-hidden">
          <div className="h-full rounded bg-[var(--color-success-text)]" style={{ width: `${ratioPercent(data.doneCount, data.totalCount)}%` }} />
        </div>
        <div className="text-[9px] text-[var(--color-text-tertiary)]">总耗时 {data.elapsedMinutes} 分钟</div>
      </div>

      {/* 右内容区 */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-2.5 min-w-0">
        <h2 className="text-lg font-semibold">{data.title}</h2>
        <div className="bg-[#fff9e6] border-l-4 border-[#f5a623] rounded-md px-2.5 py-2 flex-1 flex flex-col">
          <div className="text-[9px] font-semibold text-[#8b6914] mb-1">执行清单 · {data.doneCount}/{data.totalCount} 已完成</div>
          {data.items.map((it) => (
            <div key={it.id} className="flex items-center gap-1.5 py-0.5">
              <span className="w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] shrink-0
                ${it.done ? 'bg-[#d4a853] text-white' : 'border border-[#d4a853]'}"> {it.done ? "✓" : ""}</span>
              <span className={`text-[11px] ${it.done ? "text-[#b09850]" : "text-[#8b6914]"} ${it.active ? "font-medium" : ""}`}>{it.text}</span>
              {it.meta && <span className={`ml-auto text-[8px] ${it.active ? "text-brand-500" : "text-[#b09850]"}`}>{it.meta}</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-3 items-center text-[10px] text-brand-500 cursor-pointer">
          <span>+ 追加</span><span>·</span><span>标记完成一项</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-md bg-ai-50 text-ai-600">
          <span className="font-semibold text-[9px] shrink-0">AI</span>
          <span>上次类似花了 90 分钟</span>
        </div>
        <div className="flex gap-1.5">
          <button className="flex-1 py-1.5 rounded-lg text-[10px] bg-gray-100 text-[var(--color-text-tertiary)] hover:bg-gray-200 transition">跳过</button>
          <button className="flex-1 py-1.5 rounded-lg text-[10px] font-medium text-white bg-[var(--color-success-text)] hover:bg-[#15803d] transition">完成</button>
        </div>
      </div>
    </div>
  );
}

/* ── 版式选择器（供 Today 页调用） ── */
export function useFcLayout(): FcLayout {
  const [layout, setLayout] = useState<FcLayout>(1);
  useEffect(() => {
    setLayout(getFcLayout());
    const on = (e: Event) => setLayout((e as CustomEvent).detail as FcLayout);
    window.addEventListener("taskos:fclayout-change", on);
    return () => window.removeEventListener("taskos:fclayout-change", on);
  }, []);
  return layout;
}
