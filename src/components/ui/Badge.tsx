/* ═══════════════════════════════════════════
   Badge Component — Task OS Design System
   ═══════════════════════════════════════════ */

type BadgeVariant = "default" | "brand" | "success" | "warning" | "danger";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-gray-100 text-gray-600",
  brand: "bg-brand-50 text-brand-600",
  success: "bg-[var(--sem-status-completed-bg)] text-[var(--sem-status-completed)]",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-sm rounded-full font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ── Status Dot ── */

type StatusDotVariant = "not_started" | "in_progress" | "completed" | "delayed" | "cancelled";

interface StatusDotProps {
  variant: StatusDotVariant;
  label?: string;
  className?: string;
}

const dotColors: Record<StatusDotVariant, string> = {
  not_started: "bg-[var(--sem-status-notstarted)]",
  in_progress: "bg-[var(--sem-status-inprogress)] animate-pulse",
  completed: "bg-[var(--sem-status-completed)]",
  delayed: "bg-[var(--sem-status-delayed)]",
  cancelled: "bg-[var(--sem-status-cancelled)]",
};

const dotLabels: Record<StatusDotVariant, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  delayed: "已延期",
  cancelled: "已取消",
};

export function StatusDot({ variant, label, className = "" }: StatusDotProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm text-gray-500 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotColors[variant]}`} />
      {label || dotLabels[variant]}
    </span>
  );
}
