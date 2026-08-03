"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";

/* ═══════════════════════════════════════════
   AnimatedModal — Task OS Interaction System
   统一 Modal 动画: fade + scale(0.95→1)
   ═══════════════════════════════════════════ */

interface AnimatedModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
  closeOnOverlay?: boolean;
}

export function AnimatedModal({
  open, onClose, title, children, className = "", closeOnOverlay = true,
}: AnimatedModalProps) {
  const [visible, setVisible] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      const timer = setTimeout(() => setVisible(false), 200);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!visible && !open) return null;

  const isEntering = open;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Overlay with fade */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${
          isEntering ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Panel with scale+fade */}
      <div
        className={`relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-5 z-10 transition-all duration-200 ${
          isEntering ? "opacity-100 scale-100" : "opacity-0 scale-95"
        } ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-800">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
