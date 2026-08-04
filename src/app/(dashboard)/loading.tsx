/* Dashboard 路由级加载骨架屏（切页时显示，避免空白等待感）
   适配 Meridian 子午品牌：子夜蓝 + 正午金 点缀 */
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4">
      {/* 页头骨架 */}
      <div className="flex items-end justify-between">
        <div>
          <div className="h-7 w-40 rounded-lg bg-[var(--color-gray-100)]" />
          <div className="h-3 w-56 rounded-md bg-[var(--color-gray-100)] mt-2" />
        </div>
      </div>

      {/* 卡片骨架（主区域） */}
      <div className="rounded-[14px] border border-[var(--v2-border)] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
        <div className="h-4 w-1/3 rounded-md bg-[var(--color-gray-100)] mb-3" />
        <div className="h-3 w-full rounded-md bg-[var(--color-gray-100)] mb-2" />
        <div className="h-3 w-5/6 rounded-md bg-[var(--color-gray-100)] mb-2" />
        <div className="h-3 w-2/3 rounded-md bg-[var(--color-gray-100)]" />
      </div>

      {/* 次区域骨架 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-[14px] border border-[var(--v2-border)] bg-white p-4 h-28" />
        <div className="rounded-[14px] border border-[var(--v2-border)] bg-white p-4 h-28" />
      </div>
    </div>
  );
}
