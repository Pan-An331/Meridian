"use client";

import { useEffect, useState } from "react";
import { getNavMode, setNavMode, getFcLayout, setFcLayout, type NavMode, type FcLayout } from "@/lib/ui-preferences";

/* ═══════════════════════════════════════════
   NavLayoutSettings — 设置页「导航与版式」卡片
   · 导航方案：工作流侧栏 / 顶栏（即时生效）
   · Focus Card 版式：一栏 / 两栏（即时生效）
   ═══════════════════════════════════════════ */

function Seg<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-[var(--page-surface-hover)]">
      {options.map((o) => (
        <button key={String(o.value)} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            value === o.value
              ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm"
              : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NavLayoutSettings() {
  const [navMode, setNav] = useState<NavMode>("side");
  const [layout, setLayout] = useState<FcLayout>(1);

  useEffect(() => {
    setNav(getNavMode());
    setLayout(getFcLayout());
  }, []);

  const changeNav = (v: NavMode) => {
    setNav(v);
    setNavMode(v);
    window.dispatchEvent(new CustomEvent("taskos:nav-change", { detail: v }));
  };

  const changeLayout = (v: FcLayout) => {
    setLayout(v);
    setFcLayout(v);
    window.dispatchEvent(new CustomEvent("taskos:fclayout-change", { detail: v }));
  };

  return (
    <section className="rounded-xl border border-[var(--page-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] overflow-hidden">
      <header className="flex items-center gap-2.5 px-4 py-3">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm bg-brand-100 text-brand-700">🧭</span>
        <div>
          <h3 className="text-sm font-semibold">导航与版式</h3>
          <p className="text-[11px] text-[var(--color-text-tertiary)]">导航形态与 Focus Card 版式 · 改动即时生效</p>
        </div>
      </header>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--page-border-subtle)]">
        <span className="text-[13px]">导航方案</span>
        <Seg value={navMode} onChange={changeNav}
          options={[{ label: "工作流侧栏", value: "side" as NavMode }, { label: "顶栏", value: "top" as NavMode }]} />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--page-border-subtle)]">
        <span className="text-[13px]">Focus Card 版式</span>
        <Seg value={layout} onChange={changeLayout}
          options={[{ label: "一栏", value: 1 as FcLayout }, { label: "两栏", value: 2 as FcLayout }]} />
      </div>
      <p className="px-4 pb-3 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">选择会立即应用到整个界面 · 保存在本机（localStorage）</p>
    </section>
  );
}
