"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { XIcon } from "@/components/ui/icons";

/* ═══════════════════════════════════════════
   Modal Component — Task OS Design System V3
   入场/退场动画 + SVG 关闭图标
   ═══════════════════════════════════════════ */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
  closeOnOverlay?: boolean;
}

const sizeClass: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
  size = "sm",
  closeOnOverlay = true,
}: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 200);
      document.body.style.overflow = "";
      return () => clearTimeout(timer);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay */}
      <div
        ref={overlayRef}
        className={`absolute inset-0 bg-black/30 transition-opacity duration-200 ${animating ? "opacity-100" : "opacity-0"}`}
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Panel */}
      <div
        className={`relative bg-[var(--color-surface)] rounded-2xl shadow-xl ${sizeClass[size] || sizeClass.sm} w-full mx-4 p-5 z-10 ${className}`}
        style={{
          opacity: animating ? 1 : 0,
          transform: animating ? "scale(1) translateY(0)" : "scale(0.95) translateY(8px)",
          transition: "opacity 200ms cubic-bezier(0.4, 0, 0.2, 1), transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
            <button
              onClick={onClose}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] p-1 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors"
              aria-label="关闭"
            >
              <XIcon size={16} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
