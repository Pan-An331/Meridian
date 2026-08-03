import { Button } from "@/components/ui/Button";

/* ═══════════════════════════════════════════
   EmptyState — Task OS Design System
   统一空状态展示
   ═══════════════════════════════════════════ */

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon = "📋",
  title = "暂无数据",
  description = "完成几个任务后就能看到内容了",
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-sm text-gray-400 font-medium">{title}</p>
      <p className="text-sm text-gray-300 mt-1">{description}</p>
      {action && (
        <Button variant="primary" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
