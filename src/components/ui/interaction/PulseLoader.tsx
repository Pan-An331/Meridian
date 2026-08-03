/* ═══════════════════════════════════════════
   PulseLoader — Task OS Interaction System
   统一脉冲加载动画
   ═══════════════════════════════════════════ */

interface PulseLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "w-1.5 h-1.5 gap-1",
  md: "w-2 h-2 gap-1.5",
  lg: "w-3 h-3 gap-2",
};

export function PulseLoader({ size = "md", className = "" }: PulseLoaderProps) {
  return (
    <span className={`inline-flex items-center ${sizes[size]} ${className}`}>
      <span className="w-full h-full rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-full h-full rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-full h-full rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}
