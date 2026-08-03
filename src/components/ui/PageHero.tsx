import type { ReactNode } from "react";

/* ═══════════════════════════════════════════
   PageHero — Task OS Design System V3
   渐变背景图标 + subtitle 支持
   ═══════════════════════════════════════════ */

interface PageHeroProps {
  title: string;
  description?: string;
  subtitle?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function PageHero({ title, description, subtitle, icon, children, className = "" }: PageHeroProps) {
  return (
    <div className={`pb-8 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="w-11 h-11 rounded-xl bg-[var(--color-grad-brand-light)] flex items-center justify-center shrink-0 shadow-sm">
              <span className="text-brand-500">{icon}</span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">{title}</h1>
            {description && (
              <p className="text-sm text-[var(--color-text-secondary)] mt-1.5 leading-relaxed max-w-md">{description}</p>
            )}
            {subtitle && (
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2 shrink-0">{children}</div>
        )}
      </div>
    </div>
  );
}
