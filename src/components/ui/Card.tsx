import { type HTMLAttributes, forwardRef } from "react";

/* ═══════════════════════════════════════════
   Card Component — Task OS Design System V3
   主题感知背景 + focus/route 新变体
   ═══════════════════════════════════════════ */

type CardVariant = "l1" | "l2" | "l3" | "elevated" | "ai" | "success" | "warning" | "focus" | "route";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  l1: "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-default)] p-6 sh-card",
  l2: "bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-default)] p-5",
  l3: "bg-[var(--color-surface)] rounded-lg border border-[var(--color-border-subtle)] p-4",
  elevated: "bg-[var(--color-surface)] rounded-2xl shadow-lg border border-[var(--color-border-default)] p-7",
  ai: "bg-[var(--color-ai-50)] rounded-2xl border border-[var(--color-ai-200)] p-5",
  success: "bg-[var(--color-success-bg)] rounded-2xl border border-[var(--color-success-border)] p-5",
  warning: "bg-[var(--color-warning-bg)] rounded-2xl border border-[var(--color-warning-border)] p-5",
  // V3 新增变体
  focus: "bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border-default)] p-9 sh-card relative",
  route: "bg-[var(--color-surface)] rounded-xl border border-[var(--color-border-default)] p-0 sh-card",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "l1", interactive = false, className = "", children, ...props }, ref) => {
    const interaction = interactive
      ? "cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
      : "transition-shadow duration-150 hover:sh-card-hover";

    return (
      <div
        ref={ref}
        className={`${variantStyles[variant]} ${interaction} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

/* ── Card sub-components ── */

export function CardLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm font-bold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3 ${className}`}>{children}</p>;
}

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-xl font-bold text-[var(--color-text-primary)] tracking-tight ${className}`}>{children}</h2>;
}

export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm text-[var(--color-text-secondary)] ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mt-5 pt-4 flex items-center gap-3 border-t border-[var(--color-border-subtle)] ${className}`}>{children}</div>;
}
