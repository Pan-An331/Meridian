"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { SettingsIcon, LogOutIcon } from "@/components/ui/icons";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { NAV_ITEMS, isActiveNav } from "@/components/nav/nav-items";

/* ═══════════════════════════════════════════
   Sidebar V2 — 工作流顺序（默认导航形态）
   · ①Inbox → ②Plan → ③Today → ④Review，Today 带「默认」徽章
   · 设置降级：底部齿轮图标（不再与主页面平级）
   · 折叠 240px ↔ 64px 保留
   ═══════════════════════════════════════════ */

interface SidebarProps {
  userName: string;
  collapsed: boolean;
  onToggle: () => void;
}

function ToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {collapsed
        ? <rect x="4" y="5" width="6" height="14" rx="2.5" />
        : (<><rect x="4" y="5" width="16" height="14" rx="2.5" /><line x1="10" y1="7" x2="10" y2="17" /></>)}
    </svg>
  );
}

export function Sidebar({ userName, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const w = collapsed ? "w-16" : "w-60";

  return (
    <aside className={`${w} bg-[var(--page-sidebar)] text-[var(--page-sidebar-text)] flex flex-col h-full shrink-0 transition-all duration-200 hidden lg:flex`}>
      {/* Brand */}
      <div className="flex items-center justify-between p-5 border-b border-white/10 h-[68px] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--grad-brand)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          {!collapsed && <h1 className="text-lg font-bold tracking-tight">Task OS</h1>}
        </div>
        <button onClick={onToggle} className={`text-[var(--page-sidebar-text)]/30 hover:text-[var(--page-sidebar-text)]/60 transition ${collapsed ? "mx-auto" : ""}`} title={collapsed ? "展开" : "收起"}>
          <ToggleIcon collapsed={collapsed} />
        </button>
      </div>

      {/* 工作流导航（带序号 + Today 默认徽章） */}
      <nav className={`flex-1 overflow-y-auto ${collapsed ? "px-2 py-3 space-y-1" : "p-3 space-y-0.5"}`}>
        {NAV_ITEMS.map(({ href, label, sub, num, Icon, isDefault }) => {
          const active = isActiveNav(pathname, href);
          return (
            <Link key={href} href={href} title={collapsed ? label : undefined}
              className={`flex items-center rounded-lg text-sm transition-all ${
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2.5"
              } ${
                active
                  ? "bg-brand-600 text-white font-medium shadow-sm"
                  : "text-[var(--page-sidebar-text)]/65 hover:bg-white/10 hover:text-[var(--page-sidebar-text)]"
              }`}>
              {!collapsed && (
                <span className={`text-[10px] w-4 shrink-0 text-center ${active ? "text-brand-200" : "text-[var(--page-sidebar-text)]/35"}`}>{num}</span>
              )}
              <span className="shrink-0" style={{ width: 20, height: 20 }}>
                <Icon size={20} className={active ? "text-brand-200" : "text-[var(--page-sidebar-text)]/50"} />
              </span>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="leading-tight truncate flex items-center gap-1.5">
                    {label}
                    {isDefault && <span className="text-[9px] px-1.5 py-px rounded bg-white/15 text-brand-200 font-normal">默认</span>}
                  </span>
                  <span className={`text-[10px] leading-tight ${active ? "text-brand-200" : "text-[var(--page-sidebar-text)]/30"}`}>{sub}</span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* 设置：降级为底部图标（与主题、用户区合并为工具区） */}
      <div className={`${collapsed ? "px-2" : "px-3"} pb-1 space-y-1`}>
        <ThemeSwitcher collapsed={collapsed} />
        <Link href="/settings" title="设置"
          className={`flex items-center rounded-lg text-sm transition-all ${
            collapsed ? "justify-center p-2.5" : "gap-3 px-4 py-2.5"
          } ${
            pathname === "/settings"
              ? "bg-brand-600 text-white"
              : "text-[var(--page-sidebar-text)]/65 hover:bg-white/10 hover:text-[var(--page-sidebar-text)]"
          }`}>
          <span className="shrink-0" style={{ width: 20, height: 20 }}>
            <SettingsIcon size={20} className={pathname === "/settings" ? "text-brand-200" : "text-[var(--page-sidebar-text)]/50"} />
          </span>
          {!collapsed && <span className="leading-tight">设置</span>}
        </Link>
      </div>

      {/* User */}
      <div className={`border-t border-white/10 ${collapsed ? "p-2 flex justify-center" : "p-3"}`}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-sm font-medium" title={userName}>
            {userName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="flex items-center gap-3 px-3 py-1.5">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-sm font-medium shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{userName}</p>
            </div>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-[var(--page-sidebar-text)]/40 hover:text-[var(--page-sidebar-text)]/80 transition p-1" title="退出登录">
              <LogOutIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
