"use client";

import { useState, type ReactNode } from "react";

/* ═══════════════════════════════════════════
   HoverCard — Task OS Interaction System
   统一卡片 hover 效果: default / lift / glow
   ═══════════════════════════════════════════ */

type HoverEffect = "default" | "lift" | "glow";

interface HoverCardProps {
  effect?: HoverEffect;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

export function HoverCard({ effect = "default", className = "", children, onClick }: HoverCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const base = "transition-all duration-200 ease-out";
  const cursor = onClick ? "cursor-pointer" : "";
  const effects: Record<HoverEffect, string> = {
    default: "hover:shadow-sm",
    lift:    "hover:-translate-y-0.5 hover:shadow-md",
    glow:    "hover:ring-2 hover:ring-brand-200 hover:shadow-md",
  };

  return (
    <div
      className={`${base} ${effects[effect]} ${cursor} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
