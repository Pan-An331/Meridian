/* ═══════════════════════════════════════════
   AIMessage — Task OS Design System
   统一的 AI / 用户消息展示组件
   ═══════════════════════════════════════════ */

interface AIMessageProps {
  /** 消息来源 */
  role: "ai" | "user";
  /** 消息内容 */
  content: string;
  /** 可选时间戳 */
  timestamp?: string;
  className?: string;
}

export function AIMessage({ role, content, timestamp, className = "" }: AIMessageProps) {
  const isAI = role === "ai";

  return (
    <div className={`flex ${isAI ? "justify-start" : "justify-end"} ${className}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isAI
          ? "bg-brand-50 text-gray-700 rounded-tl-md"
          : "bg-brand-600 text-white rounded-tr-md"
      }`}>
        {isAI && <span className="text-sm mr-1.5">🤖</span>}
        <span className="whitespace-pre-wrap">{content}</span>
        {timestamp && (
          <p className={`text-sm mt-1 ${isAI ? "text-gray-400" : "text-brand-200"}`}>
            {timestamp}
          </p>
        )}
      </div>
    </div>
  );
}
