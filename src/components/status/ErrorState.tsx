import { Button } from "@/components/ui/Button";

/* ═══════════════════════════════════════════
   ErrorState — Task OS Design System
   统一错误状态展示
   ═══════════════════════════════════════════ */

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  message = "加载失败",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <div className={`text-center py-8 ${className}`}>
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-3">
        <span className="text-lg">⚠️</span>
      </div>
      <p className="text-sm text-gray-500">{message}</p>
      {onRetry && (
        <Button variant="primary" size="sm" className="mt-3" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}
