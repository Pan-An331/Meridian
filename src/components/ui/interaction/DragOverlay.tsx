/* ═══════════════════════════════════════════
   DragOverlay — Task OS Interaction System
   拖拽反馈视觉覆盖层
   不包含坐标计算/时间转换逻辑
   ═══════════════════════════════════════════ */

interface DragOverlayProps {
  /** 是否正在拖拽 */
  active: boolean;
  /** 任务标题 */
  title?: string;
  className?: string;
}

export function DragOverlay({ active, title, className = "" }: DragOverlayProps) {
  if (!active) return null;

  return (
    <div
      className={`fixed z-50 pointer-events-none bg-white rounded-lg shadow-xl border border-brand-200 px-3 py-2 text-sm font-medium text-gray-700 opacity-90 scale-105 ${className}`}
      style={{
        transition: "none",
      }}
    >
      {title || "拖拽中..."}
    </div>
  );
}
