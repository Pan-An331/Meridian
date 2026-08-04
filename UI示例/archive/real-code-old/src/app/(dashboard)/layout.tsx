import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

/* ═══════════════════════════════════════════
   Dashboard Layout V2 — 导航壳（真实代码）
   · 默认落地页改为 /today（执行驾驶舱）
   · 其余由 DashboardShell 按设置渲染 侧栏 / 顶栏
   ═══════════════════════════════════════════ */

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardShell userName={session.user.name || session.user.email || ""}>
      {children}
    </DashboardShell>
  );
}
