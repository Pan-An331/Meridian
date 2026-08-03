import { Button } from "@/components/ui/Button";

/* ═══════════════════════════════════════════
   AIAction — Task OS Design System
   统一的 AI 操作按钮组
   ═══════════════════════════════════════════ */

/** 单个操作按钮定义 */
export interface AIActionItem {
  key: string;
  label: string;
  variant?: "primary" | "ai-action" | "ghost" | "danger";
  onClick?: () => void;
}

interface AIActionProps {
  /** 操作按钮列表 */
  actions: AIActionItem[];
  /** 布局方向 */
  direction?: "row" | "col";
  className?: string;
}

export function AIAction({ actions, direction = "row", className = "" }: AIActionProps) {
  return (
    <div className={`flex gap-2 ${direction === "col" ? "flex-col" : "flex-row flex-wrap"} ${className}`}>
      {actions.map((a) => (
        <Button
          key={a.key}
          variant={a.variant || "ai-action"}
          size="sm"
          // 修复：无 onClick 的按钮禁用（防止"看起来能点实际没反应"）
          onClick={a.onClick}
          disabled={!a.onClick}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}

/* ── Preset action sets ── */

/** 确认/拒绝操作组 */
export const confirmActions: AIActionItem[] = [
  { key: "accept", label: "确认执行", variant: "primary" },
  { key: "reject", label: "拒绝", variant: "ghost" },
];

/** 接受/修改/拒绝操作组 */
export const reviewActions: AIActionItem[] = [
  { key: "accept", label: "接受建议", variant: "primary" },
  { key: "modify", label: "修改后再看", variant: "ai-action" },
  { key: "reject", label: "不需要", variant: "ghost" },
];
