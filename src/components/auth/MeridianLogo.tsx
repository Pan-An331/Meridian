/* ═══════════════════════════════════════════
   MeridianLogo — C 方案「断口双点」（锚点 v6 · Axis Anchored）
   · 白色断口环 + 金色中轴/锚点/原点（深蓝渐变底上使用）
   · 规格：圆环 3.5（12 点断口）/ 8 刻度 / 金轴 3.5 穿出 / 锚点 r3 / 原点 r3.5
   · 品牌定稿 2026-08-04
   ═══════════════════════════════════════════ */

export default function MeridianLogo({
  size = 44,
  ring = "#ffffff",
  gold = "#F59E0B",
  className,
}: {
  size?: number;
  ring?: string;
  gold?: string;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className={className} aria-label="Meridian · 子午">
      {/* 断口圆环（12 点为中轴裂开） */}
      <path d="M 56.3 14.5 A 36 36 0 1 1 43.7 14.5" stroke={ring} strokeWidth="9" />
      {/* 8 刻度：12 金 + 3/6/9 + 四象限（深蓝/白） */}
      <line x1="50" y1="24" x2="50" y2="14" stroke={gold} strokeWidth="10" strokeLinecap="round" />
      <line x1="86" y1="50" x2="76" y2="50" stroke={ring} strokeWidth="10" strokeLinecap="round" />
      <line x1="50" y1="86" x2="50" y2="76" stroke={ring} strokeWidth="10" strokeLinecap="round" />
      <line x1="14" y1="50" x2="24" y2="50" stroke={ring} strokeWidth="10" strokeLinecap="round" />
      <line x1="75.5" y1="24.5" x2="71.2" y2="28.8" stroke={ring} strokeWidth="7.5" strokeLinecap="round" />
      <line x1="75.5" y1="75.5" x2="71.2" y2="71.2" stroke={ring} strokeWidth="7.5" strokeLinecap="round" />
      <line x1="24.5" y1="75.5" x2="28.8" y2="71.2" stroke={ring} strokeWidth="7.5" strokeLinecap="round" />
      <line x1="24.5" y1="24.5" x2="28.8" y2="28.8" stroke={ring} strokeWidth="7.5" strokeLinecap="round" />
      {/* 金色中轴穿出断口 + 环外锚点 + 环心原点 */}
      <line x1="50" y1="26" x2="50" y2="9" stroke={gold} strokeWidth="9" strokeLinecap="round" />
      <circle cx="50" cy="7" r="7.5" fill={gold} />
      <circle cx="50" cy="50" r="9" fill={gold} />
    </svg>
  );
}
