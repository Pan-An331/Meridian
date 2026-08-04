"use client";

import { usePathname } from "next/navigation";

/* ═══════════════════════════════════════════
   ContentContainer — 页面级宽度规则（居中）
   · 宽页面（Today / Plan）：侧栏模式 1000px，顶栏模式 1100px
   · 窄页面（Inbox / Review / 设置）：720px
   · 视图高度不足时自动收窄，保持呼吸留白
   ═══════════════════════════════════════════ */

export const WIDE_PATHS = ["/today", "/plan", "/week"];
export const NARROW_WIDTH = "max-w-[720px]";
export const WIDE_SIDE = "max-w-[1000px]";
export const WIDE_TOP = "max-w-[1100px]";

interface ContentContainerProps {
  children: React.ReactNode;
  navMode: "side" | "top";
  /** 内容区水平留白（由 DashboardShell 按导航形态传入） */
  padding?: string;
}

export function ContentContainer({ children, navMode, padding = "px-6 lg:px-10" }: ContentContainerProps) {
  const pathname = usePathname();
  const isWide = WIDE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const widthClass = isWide
    ? navMode === "side" ? WIDE_SIDE : WIDE_TOP
    : NARROW_WIDTH;

  return (
    <div className={`w-full mx-auto ${widthClass} ${padding}`}>
      {children}
    </div>
  );
}
