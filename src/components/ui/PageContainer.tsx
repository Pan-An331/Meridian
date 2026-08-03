/* ═══════════════════════════════════════════
   PageContainer — Task OS Design System
   统一页面容器，控制各页面内容最大宽度
   ═══════════════════════════════════════════ */

type PageWidth = "today" | "plan" | "inbox" | "review" | "settings" | "full";

interface PageContainerProps {
  width?: PageWidth;
  children: React.ReactNode;
  className?: string;
}

const widthStyles: Record<PageWidth, string> = {
  today: "max-w-2xl",
  plan: "max-w-7xl",
  inbox: "max-w-2xl",
  review: "max-w-2xl",
  settings: "max-w-lg",
  full: "",
};

export function PageContainer({ width = "today", children, className = "" }: PageContainerProps) {
  return (
    <div className={`mx-auto ${widthStyles[width]} ${className}`}>
      {children}
    </div>
  );
}
