"use client";

import { usePathname } from "next/navigation";
import { isWidePath } from "@/lib/navigation";

/* ═══════════════════════════════════════════
   ContentContainer — 页面级宽度规则（居中）
   · 宽页面（Today / Plan）：侧栏模式 1160px，顶栏模式 1280px
   · 窄页面（Inbox / Review / 设置）：720px
   · 视口不足时自动收窄居中，减少左右留白让日历更宽
   ═══════════════════════════════════════════ */

export const NARROW_WIDTH = "max-w-[720px]";
export const WIDE_SIDE = "max-w-[1160px]";
export const WIDE_TOP = "max-w-[1280px]";

interface ContentContainerProps {
  children: React.ReactNode;
  navMode: "side" | "top";
  /** 内容区水平留白（由 DashboardShell 按导航形态传入） */
  padding?: string;
}

export function ContentContainer({ children, navMode, padding = "px-6 lg:px-10" }: ContentContainerProps) {
  const pathname = usePathname();
  const wide = isWidePath(pathname);

  const widthClass = wide
    ? navMode === "side" ? WIDE_SIDE : WIDE_TOP
    : NARROW_WIDTH;

  return (
    <div className={`w-full mx-auto ${widthClass} ${padding}`}>
      {children}
    </div>
  );
}
