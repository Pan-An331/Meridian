import {
  TodayIcon, InboxIcon, PlanIcon, ReviewIcon,
} from "@/components/ui/icons";

/* ═══════════════════════════════════════════
   共享导航项定义 — 工作流顺序
   Inbox(理解) → Plan(规划) → Today(执行) → Review(复盘)
   ═══════════════════════════════════════════ */

export interface NavItem {
  href: string;
  label: string;
  sub: string;
  num: string;      // ① ② ③ ④
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  isDefault?: boolean; // Today 默认落地
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/inbox",   label: "Inbox",  sub: "理解",   num: "①", Icon: InboxIcon },
  { href: "/plan",    label: "Plan",   sub: "规划",   num: "②", Icon: PlanIcon },
  { href: "/today",   label: "Today",  sub: "执行 · 驾驶舱", num: "③", Icon: TodayIcon, isDefault: true },
  { href: "/review",  label: "Review", sub: "复盘",   num: "④", Icon: ReviewIcon },
];

/** 激活判断：/week 兼容 Plan */
export function isActiveNav(pathname: string, href: string): boolean {
  return pathname === href || (href === "/plan" && pathname === "/week");
}
