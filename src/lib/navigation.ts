import type { ComponentType } from "react";
import {
  TodayIcon, InboxIcon, PlanIcon, ReviewIcon, ProjectIcon,
} from "@/components/ui/icons";

/* ═══════════════════════════════════════════
   导航单数据源 — 工作流顺序
   Inbox(理解) → Plan(规划) → Today(执行) → Review(复盘) → Project(整理)
   所有页面路径、宽度规则、快捷键顺序都从这里取，
   新增页面只改这一处（REVIEW P1-3）
   ═══════════════════════════════════════════ */

export interface NavItem {
  href: string;
  label: string;
  sub: string;
  num: string;      // ① ② ③ ④
  Icon: ComponentType<{ size?: number; className?: string }>;
  isDefault?: boolean; // Today 默认落地
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/inbox",    label: "Inbox",   sub: "理解",        num: "①", Icon: InboxIcon },
  { href: "/plan",     label: "Plan",    sub: "规划",        num: "②", Icon: PlanIcon },
  { href: "/today",    label: "Today",   sub: "执行 · 驾驶舱", num: "③", Icon: TodayIcon, isDefault: true },
  { href: "/review",   label: "Review",  sub: "复盘",        num: "④", Icon: ReviewIcon },
  { href: "/projects", label: "Project", sub: "整理",        num: "⑤", Icon: ProjectIcon },
];

/** 快捷键循环顺序：工作流 5 页 + 设置 */
export const NAV_ORDER: string[] = [...NAV_ITEMS.map((i) => i.href), "/settings"];

/** 宽页面（侧栏 1160 / 顶栏 1280），其余窄页 720；Review 两栏化（V3 §7.2）后改全宽，与视觉稿 1100px 一致 */
export const WIDE_PATHS = ["/today", "/plan", "/week", "/projects", "/review"];

/** 激活判断：/week 兼容 Plan */
export function isActiveNav(pathname: string, href: string): boolean {
  return pathname === href || (href === "/plan" && pathname === "/week");
}

/** 当前路径是否宽页面 */
export function isWidePath(pathname: string): boolean {
  return WIDE_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
