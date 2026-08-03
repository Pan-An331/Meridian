"use client";

import { useEffect, useState } from "react";
import {
  getNavMode, setNavMode, getFcLayout, setFcLayout,
  getNavLang, setNavLang,
  NAV_CHANGE_EVENT, FCLAYOUT_CHANGE_EVENT, LANG_CHANGE_EVENT,
  type NavMode, type FcLayout, type NavLang,
} from "@/lib/ui-preferences";

/* ═══════════════════════════════════════════
   NavLayoutSettings — 设置页「导航与版式」卡片
   · 导航方案：工作流侧栏 / 顶栏（即时生效）
   · 导航语言：中文 / English（默认中文 · 即时生效）
   · Focus Card 版式：一栏 / 两栏（即时生效）
   风格对齐设置页 SettingsSection（surface 卡 + 分隔行）
   ═══════════════════════════════════════════ */

function Seg<T extends string | number>({ value, options, onChange }: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-[var(--color-gray-100)]">
      {options.map((o) => (
        <button key={String(o.value)} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            value === o.value
              ? "bg-[var(--v2-card)] text-[var(--v2-text)] shadow-sm"
              : "text-[var(--v2-text3)] hover:text-[var(--v2-text2)]"
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
  const [lang, setLang] = useState<NavLang>("zh");

  useEffect(() => {
    setNav(getNavMode());
    setLayout(getFcLayout());
    setLang(getNavLang());
  }, []);

  const changeNav = (v: NavMode) => {
    setNav(v);
    setNavMode(v);
    window.dispatchEvent(new CustomEvent<NavMode>(NAV_CHANGE_EVENT, { detail: v }));
  };

  const changeLayout = (v: FcLayout) => {
    setLayout(v);
    setFcLayout(v);
    window.dispatchEvent(new CustomEvent<FcLayout>(FCLAYOUT_CHANGE_EVENT, { detail: v }));
  };

  const changeLang = (v: NavLang) => {
    setLang(v);
    setNavLang(v);
    window.dispatchEvent(new CustomEvent<NavLang>(LANG_CHANGE_EVENT, { detail: v }));
  };

  return (
    <section className="bg-[var(--v2-card)] rounded-2xl border border-[var(--v2-border)] sh-card overflow-hidden">
      <header className="flex items-center gap-2.5 px-6 py-4 border-b border-[var(--v2-border)]">
        <span className="w-7 h-7 rounded-lg bg-[var(--v2-brand-bg)] text-[var(--v2-brand)] flex items-center justify-center shrink-0 text-sm">🧭</span>
        <div>
          <h2 className="text-sm font-bold text-[var(--v2-text)]">导航与版式</h2>
          <p className="text-sm text-[var(--v2-text3)]">导航形态 · 语言 · Focus Card 版式 · 改动即时生效</p>
        </div>
      </header>
      <div className="flex items-center justify-between gap-3 px-6 py-3.5">
        <div>
          <span className="text-sm font-medium text-[var(--v2-text)]">导航方案</span>
          <p className="text-sm text-[var(--v2-text3)] mt-0.5">工作流侧栏 / 顶栏</p>
        </div>
        <Seg value={navMode} onChange={changeNav}
          options={[{ label: "工作流侧栏", value: "side" as NavMode }, { label: "顶栏", value: "top" as NavMode }]} />
      </div>
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--v2-border)]">
        <div>
          <span className="text-sm font-medium text-[var(--v2-text)]">导航语言</span>
          <p className="text-sm text-[var(--v2-text3)] mt-0.5">收纳 / 蓝图 / 此刻 / 复盘 / 项目（URL 不变）</p>
        </div>
        <Seg value={lang} onChange={changeLang}
          options={[{ label: "中文", value: "zh" as NavLang }, { label: "English", value: "en" as NavLang }]} />
      </div>
      <div className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--v2-border)]">
        <div>
          <span className="text-sm font-medium text-[var(--v2-text)]">Focus Card 版式</span>
          <p className="text-sm text-[var(--v2-text3)] mt-0.5">Today 主任务卡布局</p>
        </div>
        <Seg value={layout} onChange={changeLayout}
          options={[{ label: "一栏", value: 1 as FcLayout }, { label: "两栏", value: 2 as FcLayout }]} />
      </div>
      <p className="px-6 pb-4 text-sm text-[var(--v2-text3)]">选择立即应用到整个界面 · 保存在本机（localStorage）</p>
    </section>
  );
}
