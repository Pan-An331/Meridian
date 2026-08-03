"use client";

import { useState, useEffect, type ReactNode } from "react";

/* ═══════════════════════════════════════════
   FadeTransition — Task OS Interaction System
   统一淡入淡出过渡
   ═══════════════════════════════════════════ */

interface FadeTransitionProps {
  show: boolean;
  children: ReactNode;
  duration?: number;
  className?: string;
}

export function FadeTransition({ show, children, duration = 200, className = "" }: FadeTransitionProps) {
  const [render, setRender] = useState(show);

  useEffect(() => {
    if (show) setRender(true);
    else {
      const t = setTimeout(() => setRender(false), duration);
      return () => clearTimeout(t);
    }
  }, [show, duration]);

  if (!render) return null;

  return (
    <div
      className={`transition-opacity ${className}`}
      style={{
        opacity: show ? 1 : 0,
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {children}
    </div>
  );
}
