"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/nav/topbar";
import { MobileNav } from "@/components/mobile-nav";
import { ContentContainer } from "@/components/layout/content-container";
import { ArchiveProvider } from "@/components/task/ArchiveProvider";
import { NAV_ORDER } from "@/lib/navigation";
import { getNavMode, listenNavMode, type NavMode } from "@/lib/ui-preferences";

/* ═══════════════════════════════════════════
   DashboardShell V2 — 导航壳
   · 读设置：导航形态（侧栏 / 顶栏），设置页改动即时响应
   · 桌面：按设置渲染 Sidebar 或 Topbar
   · 移动：底部 4 tab（MobileNav）
   · 内容区：ContentContainer 宽度规则
   · Ctrl+↑↓ 页面切换（工作流顺序）
   ═══════════════════════════════════════════ */

interface DashboardShellProps {
  userName: string;
  children: React.ReactNode;
}

export function DashboardShell({ userName, children }: DashboardShellProps) {
  const [navMode, setNavMode] = useState<NavMode>("side");
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // 挂载后读偏好（SSR 阶段保持默认，避免 hydration 不一致）
  useEffect(() => {
    setNavMode(getNavMode());
  }, []);

  // 设置页切换导航形态 → 即时响应
  useEffect(() => listenNavMode(setNavMode), []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (!e.ctrlKey && !e.metaKey) return;
    const idx = NAV_ORDER.indexOf(pathname);
    if (idx === -1) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      router.push(NAV_ORDER[(idx + 1) % NAV_ORDER.length]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      router.push(NAV_ORDER[(idx - 1 + NAV_ORDER.length) % NAV_ORDER.length]);
    }
  }, [pathname, router]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ArchiveProvider>
      <div className="flex h-screen overflow-hidden">
        {/* 桌面导航：按设置渲染侧栏或顶栏 */}
        {navMode === "side" ? (
          <Sidebar userName={userName} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        ) : (
          <div className="hidden lg:flex flex-col w-full">
            <Topbar userName={userName} />
            <main className="flex-1 overflow-y-auto bg-[var(--v2-bg)]">
              <ContentContainer navMode="top" padding="px-4 lg:px-8 py-6 lg:py-10">
                {children}
              </ContentContainer>
            </main>
          </div>
        )}

        {/* 侧栏模式的内容区 */}
        {navMode === "side" && (
          <main className="flex-1 overflow-y-auto bg-[var(--v2-bg)]">
            <ContentContainer navMode="side" padding="px-4 lg:px-6 py-6 lg:py-8 pb-24 lg:pb-10">
              {children}
            </ContentContainer>
          </main>
        )}

        {/* 移动端底部导航（隐藏于桌面） */}
        <div className="lg:hidden">
          <MobileNav />
        </div>
        <div id="ai-assistant-slot" className="hidden" />
      </div>
    </ArchiveProvider>
  );
}
