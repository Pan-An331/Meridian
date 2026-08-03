/* ═══════════════════════════════════════════
   StatusMeter — Task OS Design System
   数值进度展示（精力/专注/压力等）
   只展示，不计算
   ═══════════════════════════════════════════ */

type MeterColor = "green" | "yellow" | "red" | "indigo";

interface StatusMeterProps {
  label: string;
  value: number;
  max?: number;
  color?: MeterColor;
  suffix?: string;
  className?: string;
}

const barColors: Record<MeterColor, string> = {
  green:  "bg-green-400",
  yellow: "bg-yellow-400",
  red:    "bg-red-400",
  indigo: "bg-brand-500",
};

export function StatusMeter({ label, value, max = 100, color = "indigo", suffix, className = "" }: StatusMeterProps) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-sm text-gray-500 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm text-gray-500 w-10 text-right shrink-0">
        {value}{suffix || ""}
      </span>
    </div>
  );
}
