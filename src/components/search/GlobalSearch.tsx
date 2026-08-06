"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DOMAINS, normalizeCategory, resolveTheme } from "@/lib/plan/colors";
import { ThemeBadge } from "@/components/task/ThemeBadge";
import { useArchive } from "@/components/task/ArchiveProvider";

/* ═══════════════════════════════════════════
   GlobalSearch — V3 全局搜索（顶部导航）
   · 优先 GET /api/tasks/search?q=（V3 阶段 C 后端提供）
   · 后端未就绪（404/失败）→ 本地拉 /api/tasks 过滤兜底（标题/标签/领域/归属链 contains）
   · 点击结果 → 打开任务档案面板（560px）
   ═══════════════════════════════════════════ */

interface SearchHit {
  id: string; title: string; category: string | null; tags?: string | null;
  status?: string; parentTitle?: string | null; deadline?: string | null;
  startTime?: string | null; taskType?: string;
  theme?: string | null; // V3 C1：search API 已返回落库主题
}

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const { open } = useArchive();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [openPanel, setOpenPanel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viaApi, setViaApi] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 防抖搜索
  useEffect(() => {
    const kw = q.trim();
    if (!kw) { setHits(null); setOpenPanel(false); return; }
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        // 优先走 V3 search API
        const r = await fetch(`/api/tasks/search?q=${encodeURIComponent(kw)}`);
        if (r.ok) {
          const d = await r.json();
          setHits(Array.isArray(d.results) ? d.results : []);
          setViaApi(true);
          setOpenPanel(true);
          return;
        }
        // 后端未就绪 → 本地兜底：全量拉取 + contains 过滤
        const allR = await fetch("/api/tasks");
        if (allR.ok) {
          const list = (await allR.json()) as SearchHit[];
          const lower = kw.toLowerCase();
          const filtered = list.filter((t) =>
            (t.title || "").toLowerCase().includes(lower) ||
            (t.tags || "").toLowerCase().includes(lower) ||
            (DOMAINS[normalizeCategory(t.category)]?.label || "").toLowerCase().includes(lower) ||
            (t.parentTitle || "").toLowerCase().includes(lower)
          );
          setHits(filtered.slice(0, 8));
          setViaApi(false);
          setOpenPanel(true);
        }
      } catch { /* 静默失败 */ }
      finally { setBusy(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  // 点击外部关闭
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpenPanel(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ⌘K / Ctrl+K 聚焦
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = wrapRef.current?.querySelector("input");
        el?.focus();
      }
      if (e.key === "Escape") setOpenPanel(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const pick = (hit: SearchHit) => {
    setOpenPanel(false);
    setQ("");
    open(hit.id, { title: hit.title, category: hit.category, startTime: hit.startTime ?? undefined, endTime: undefined });
  };

  return (
    <div ref={wrapRef} className="relative">
      {/* 输入框 */}
      <div className={`flex items-center gap-2 rounded-lg border border-[var(--v2-border)] bg-white/60 transition-all ${openPanel ? "border-[var(--v2-brand)] shadow-[0_0_0_3px_rgba(99,102,241,0.12)]" : "hover:border-[var(--v2-brand)]/50"}`}>
        <svg className="ml-2.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => q.trim() && setOpenPanel(true)}
          placeholder={compact ? "搜索…" : "搜索任务 / 标签 / 归属链…"}
          className="flex-1 bg-transparent outline-none text-sm text-[var(--v2-text)] placeholder:text-[var(--v2-text3)] py-1.5 min-w-0"
        />
        {busy ? (
          <span className="mr-2.5 text-[11px] text-[var(--v2-text3)] animate-pulse">…</span>
        ) : (
          <kbd className="mr-2 shrink-0 hidden sm:inline font-sans text-[10px] px-1 py-px rounded bg-[var(--color-gray-100)] border border-[var(--v2-border)] text-[var(--v2-text3)]">⌘K</kbd>
        )}
      </div>

      {/* 结果下拉 */}
      {openPanel && hits && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-white rounded-xl border border-[var(--v2-border)] shadow-[0_16px_32px_-8px_rgba(16,24,40,0.18)] overflow-hidden z-[120]">
          <div className="px-3.5 py-2 border-b border-[var(--v2-border)] text-[11px] text-[var(--v2-text3)] flex items-center justify-between">
            <span>搜索结果 <b className="text-[var(--v2-text2)]">{hits.length} 条</b></span>
            <span className="text-[10px]">{viaApi ? "V3 search API" : "本地过滤（后端 search API 未就绪）"}</span>
          </div>
          {hits.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--v2-text3)]">未找到与「{q}」匹配的任务</div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              {hits.map((h) => {
                const cs = DOMAINS[normalizeCategory(h.category)] ?? DOMAINS.other;
                // V3 C1：直读落库主题（fallback 本地过滤场景无 theme 字段时再推断）
                const theme = h.theme ?? resolveTheme(h.tags, h.title, h.category);
                return (
                  <button key={h.id} onClick={() => pick(h)} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-[var(--color-gray-50)] transition">
                    <span className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-medium shrink-0" style={{ background: cs.bg, color: cs.border }}>{cs.label.slice(0, 1)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5 text-sm text-[var(--v2-text)] font-medium truncate">
                        {h.title}
                        {theme && <ThemeBadge theme={theme} />}
                      </span>
                      <span className="block text-[11px] text-[var(--v2-text3)] truncate mt-0.5">
                        {cs.label}{h.parentTitle ? ` · 📍 ${h.parentTitle}` : ""}{h.deadline ? ` · ${new Date(h.deadline).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })} 截止` : ""}
                      </span>
                    </span>
                    <span className="text-[11px] text-[var(--v2-text3)] shrink-0">{h.taskType === "scheduled" ? "时间块" : h.taskType === "planned" ? "截止日" : "事项"}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="px-3.5 py-1.5 border-t border-[var(--v2-border)] text-[10px] text-[var(--v2-text3)] bg-[#fafbfc]">点击结果打开任务档案面板</div>
        </div>
      )}
    </div>
  );
}
