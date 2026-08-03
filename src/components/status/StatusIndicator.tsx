/* ═══════════════════════════════════════════
   StatusIndicator — Task OS Design System
   小圆点 + 标签 状态指示器
   ═══════════════════════════════════════════ */

type IndicatorColor = "gray" | "green" | "yellow" | "orange" | "red" | "indigo";

interface StatusIndicatorProps {
  color: IndicatorColor;
  label?: string;
  pulse?: boolean;
  className?: string;
}

const colorMap: Record<IndicatorColor, string> = {
  gray:   "bg-gray-300",
  green:  "bg-green-500",
  yellow: "bg-yellow-500",
  orange: "bg-orange-500",
  red:    "bg-red-500",
  indigo: "bg-brand-500",
};

export function StatusIndicator({ color, label, pulse = false, className = "" }: StatusIndicatorProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${colorMap[color]} ${pulse ? "animate-pulse" : ""}`} />
      {label && <span className="text-sm text-gray-500">{label}</span>}
    </span>
  );
}
