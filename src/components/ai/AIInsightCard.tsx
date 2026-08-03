import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/* ═══════════════════════════════════════════
   AIInsightCard — Task OS Design System
   统一的 AI 洞察 / 建议卡片
   ═══════════════════════════════════════════ */

type InsightType = "suggestion" | "warning" | "info" | "conflict" | "tip";

interface AIInsightCardProps {
  type?: InsightType;
  title?: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const typeConfig: Record<InsightType, { icon: string; variant: "ai" | "success" | "warning"; badgeLabel: string }> = {
  suggestion: { icon: "💡", variant: "ai", badgeLabel: "建议" },
  warning:    { icon: "⚠️", variant: "warning", badgeLabel: "注意" },
  info:       { icon: "ℹ️", variant: "ai", badgeLabel: "信息" },
  conflict:   { icon: "⚡", variant: "warning", badgeLabel: "冲突" },
  tip:        { icon: "✨", variant: "success", badgeLabel: "提示" },
};

export function AIInsightCard({ type = "suggestion", title, description, action, className = "" }: AIInsightCardProps) {
  const cfg = typeConfig[type];

  return (
    <Card variant={cfg.variant} className={`${className}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-sm shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {title && <span className="text-sm font-medium text-gray-800">{title}</span>}
            <Badge variant={type === "warning" ? "warning" : "brand"}>{cfg.badgeLabel}</Badge>
          </div>
          <CardBody>
            {description}
          </CardBody>
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              {action.label} →
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
