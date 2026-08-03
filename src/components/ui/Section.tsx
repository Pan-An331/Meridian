/* ═══════════════════════════════════════════
   Section — Task OS Design System
   页面内容区块容器，统一垂直间距
   ═══════════════════════════════════════════ */

type SectionSpacing = "sm" | "md" | "lg" | "xl";

interface SectionProps {
  spacing?: SectionSpacing;
  children: React.ReactNode;
  className?: string;
}

const spacingStyles: Record<SectionSpacing, string> = {
  sm: "space-y-2",
  md: "space-y-5",
  lg: "space-y-6",
  xl: "space-y-8",
};

export function Section({ spacing = "md", children, className = "" }: SectionProps) {
  return (
    <section className={`${spacingStyles[spacing]} ${className}`}>
      {children}
    </section>
  );
}
