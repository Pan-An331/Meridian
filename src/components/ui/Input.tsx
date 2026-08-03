"use client";

import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from "react";

/* ═══════════════════════════════════════════
   Input / Textarea — Task OS Design System V3
   品牌色 focus ring + 无障碍 label
   ═══════════════════════════════════════════ */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3.5 py-2.5 text-sm bg-[var(--color-surface)] border-[1.5px] border-[var(--color-border-default)] rounded-lg 
            placeholder:text-[var(--color-text-tertiary)]
            focus:outline-none focus:ring-[3px] focus:ring-brand-500/15 focus:border-brand-300
            disabled:bg-gray-50 disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed
            transition-all duration-100
            ${error ? "border-red-300 focus:ring-red-500/15 focus:border-red-300" : ""}
            ${className}`}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{hint}</p>
        )}
        {error && (
          <p className="mt-1 text-sm text-[var(--color-danger-text)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

/* ── Textarea ── */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = "", id, rows = 3, ...props }, ref) => {
    const inputId = id || label?.replace(/\s+/g, "-").toLowerCase();

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={`w-full px-3.5 py-2.5 text-sm bg-[var(--color-surface)] border-[1.5px] border-[var(--color-border-default)] rounded-lg resize-none
            placeholder:text-[var(--color-text-tertiary)]
            focus:outline-none focus:ring-[3px] focus:ring-brand-500/15 focus:border-brand-300
            disabled:bg-gray-50 disabled:text-[var(--color-text-disabled)] disabled:cursor-not-allowed
            transition-all duration-100
            ${error ? "border-red-300 focus:ring-red-500/15 focus:border-red-300" : ""}
            ${className}`}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{hint}</p>
        )}
        {error && (
          <p className="mt-1 text-sm text-[var(--color-danger-text)]">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
