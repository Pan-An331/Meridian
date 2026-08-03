import { Badge } from "@/components/ui/Badge";

/* ═══════════════════════════════════════════
   StatusBadge — Task OS Design System
   统一的任务/AI/系统状态 Badge
   ═══════════════════════════════════════════ */

type StatusDomain = "task" | "ai" | "system";

interface StatusBadgeProps {
  domain: StatusDomain;
  value: string;
  className?: string;
}

const config: Record<StatusDomain, Record<string, { label: string; variant: "default" | "brand" | "success" | "warning" | "danger" }>> = {
  task: {
    not_started: { label: "未开始", variant: "default" },
    in_progress: { label: "进行中", variant: "warning" },
    completed:   { label: "已完成", variant: "success" },
    delayed:     { label: "已延期", variant: "danger" },
    cancelled:   { label: "已取消", variant: "default" },
    snoozed:     { label: "已暂缓", variant: "default" },
  },
  ai: {
    idle:      { label: "待命",   variant: "default" },
    thinking:  { label: "思考中", variant: "brand" },
    done:      { label: "已完成", variant: "success" },
    error:     { label: "出错了", variant: "danger" },
    proposed:  { label: "AI 建议", variant: "brand" },
    confirmed: { label: "已确认", variant: "success" },
  },
  system: {
    online:    { label: "在线",   variant: "success" },
    offline:   { label: "离线",   variant: "default" },
    syncing:   { label: "同步中", variant: "brand" },
    warning:   { label: "警告",   variant: "warning" },
    error:     { label: "错误",   variant: "danger" },
  },
};

export function StatusBadge({ domain, value, className = "" }: StatusBadgeProps) {
  const d = config[domain];
  const c = d?.[value] || { label: value, variant: "default" as const };
  return <Badge variant={c.variant} className={className}>{c.label}</Badge>;
}
