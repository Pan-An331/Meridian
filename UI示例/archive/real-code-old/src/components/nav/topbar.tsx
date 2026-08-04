"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SettingsIcon, LogOutIcon } from "@/components/ui/icons";
import { NAV_ITEMS, isActiveNav } from "@/components/nav/nav-items";

/* ═══════════════════════════════════════════
   Topbar — 顶栏导航（可选形态 B）
   · Brand 左 / 四页面 Tab 居中 / 设置齿轮 + 头像右上
   ═══════════════════════════════════════════ */

interface TopbarProps {
  userName: string;
}

export function Topbar({ userName }: TopbarProps) {
  const pathname = usePathname();

  return (
    <header className="h-14 shrink-0 bg-[var(--page-sidebar)] text-[var(--page-sidebar-text)] flex items-center gap-4 px-5">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--grad-brand)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        </div>
        <h1 className="text-base font-bold tracking-tight">Task OS</h1>
      </div>

      {/* 四页面 Tab 居中 */}
      <nav className="flex items-center gap-1 mx-auto">
        {NAV_ITEMS.map(({ href, label, Icon, isDefault }) => {
          const active = isActiveNav(pathname, href);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                active
                  ? "bg-brand-600 text-white font-medium shadow-sm"
                  : "text-[var(--page-sidebar-text)]/65 hover:bg-white/10 hover:text-[var(--page-sidebar-text)]"
              }`}>
              <span className="shrink-0" style={{ width: 18, height: 18 }}>
                <Icon size={18} className={active ? "text-brand-200" : "text-[var(--page-sidebar-text)]/50"} />
              </span>
              <span className="leading-none">{label}</span>
              {isDefault && !active && <span className="text-[9px] px-1.5 py-px rounded bg-white/12 text-[var(--page-sidebar-text)]/60">默认</span>}
            </Link>
          );
        })}
      </nav>

      {/* 设置 + 用户 */}
      <div className="flex items-center gap-3 ml-auto">
        <Link href="/settings" title="设置"
          className={`p-2 rounded-lg transition ${pathname === "/settings" ? "bg-brand-600 text-white" : "text-[var(--page-sidebar-text)]/50 hover:bg-white/10 hover:text-[var(--page-sidebar-text)]"}`}>
          <SettingsIcon size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center text-xs font-medium shrink-0">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm hidden xl:inline">{userName}</span>
          <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-[var(--page-sidebar-text)]/40 hover:text-[var(--page-sidebar-text)]/80 transition p-1" title="退出登录">
            <LogOutIcon size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
