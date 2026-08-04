"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";
import { MobileNav } from "@/components/nav/mobile-nav";
import { ContentContainer } from "@/components/layout/content-container";
import { getNavMode, getFcLayout, type NavMode } from "@/lib/ui-preferences";

/* ═══════════════════════════════════════════
   DashboardShell V2 — 导航壳
   · 读设置：导航形态（侧栏 / 顶栏）
   · 桌面：按设置渲染 Sidebar 或 Topbar
   · 移动：底部 4 tab（MobileNav）
   · 内容区：ContentContainer 宽度规则
   · Ctrl+↑↓ 页面切换（工作流顺序）
   ═══════════════════════════════════════════ */

const navOrder = ["/inbox", "/plan", "/today", "/review", "/settings"];

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
    getFcLayout(); // 预热（Focus Card 版式由 Today 页读取）
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (!e.ctrlKey && !e.metaKey) return;
    const idx = navOrder.indexOf(pathname);
    if (idx === -1) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      router.push(navOrder[(idx + 1) % navOrder.length]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      router.push(navOrder[(idx - 1 + navOrder.length) % navOrder.length]);
    }
  }, [pathname, router]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 桌面导航：按设置渲染侧栏或顶栏 */}
      {navMode === "side" ? (
        <Sidebar userName={userName} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      ) : (
        <div className="hidden lg:flex flex-col w-full">
          <Topbar userName={userName} />
          <main className="flex-1 overflow-y-auto">
            <ContentContainer navMode="top" padding="px-6 lg:px-12 py-6">
              {children}
            </ContentContainer>
          </main>
        </div>
      )}

      {/* 侧栏模式的内容区 */}
      {navMode === "side" && (
        <main className="flex-1 overflow-y-auto">
          <ContentContainer navMode="side" padding="px-6 lg:px-10 py-6 lg:py-8 pb-24 lg:pb-10">
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
  );
}
