"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

/* ═══════════════════════════════════════════
   Button Component — Task OS Design System V3
   + outline 变体 + iconOnly + size 枚举
   ═══════════════════════════════════════════ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ai-action" | "outline";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  "aria-label"?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:   "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300",
  ghost:     "bg-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200",
  danger:    "bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200",
  "ai-action": "bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 active:bg-brand-200",
  outline:   "bg-transparent text-[var(--color-text-secondary)] border border-[var(--color-border-default)] hover:bg-[var(--color-surface-hover)] active:bg-gray-100",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm:   "px-3 py-1.5 text-sm rounded-lg gap-1",
  md:   "px-5 py-2 text-sm rounded-xl gap-1.5",
  lg:   "px-6 py-2.5 text-sm rounded-xl gap-2",
  icon: "p-2 rounded-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      iconOnly = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const base = "inline-flex items-center justify-center font-semibold transition-all duration-100 ease-out active:scale-[0.97] focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100";
    const width = fullWidth ? "w-full" : "";
    const actualSize = iconOnly ? "icon" : size;

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variantStyles[variant]} ${sizeStyles[actualSize]} ${width} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className={iconOnly ? "sr-only" : ""}>处理中...</span>
          </>
        ) : (
          iconOnly ? <span className="sr-only">{props["aria-label"] || ""}</span> : null
        )}
        {!loading && !iconOnly && children}
      </button>
    );
  }
);

Button.displayName = "Button";
