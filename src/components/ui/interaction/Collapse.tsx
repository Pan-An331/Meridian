"use client";

import { type ReactNode } from "react";

/* ═══════════════════════════════════════════
   Collapse — Task OS Interaction System
   统一展开/收起动画
   ═══════════════════════════════════════════ */

interface CollapseProps {
  open: boolean;
  children: ReactNode;
  className?: string;
}

export function Collapse({ open, children, className = "" }: CollapseProps) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      } ${className}`}
    >
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );
}
