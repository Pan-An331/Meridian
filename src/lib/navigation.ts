import type { ComponentType } from "react";
import {
  TodayIcon, InboxIcon, PlanIcon, ReviewIcon, ProjectIcon,
} from "@/components/ui/icons";

/* ═══════════════════════════════════════════
   导航单数据源 — 工作流顺序
   Inbox(理解) → Plan(规划) → Today(执行) → Review(复盘) → Project(整理)
   所有页面路径、宽度规则、快捷键顺序都从这里取，
   新增页面只改这一处（REVIEW P1-3）
   中英双语：labelZh/labelEn（默认中文：收纳/蓝图/此刻/复盘/项目）+ subZh/subEn
   ═══════════════════════════════════════════ */

export interface NavItem {
  href: string;
  labelZh: string;  // 中文显示名（默认）
  labelEn: string;  // English display name
  subZh: string;    // 中文副标题（sidebar 小字）
  subEn: string;    // English subtitle
  num: string;      // ① ② ③ ④
  Icon: ComponentType<{ size?: number; className?: string }>;
  isDefault?: boolean; // Today 默认落地
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/inbox",    labelZh: "收纳", labelEn: "Inbox",    subZh: "理解",     subEn: "Capture", num: "①", Icon: InboxIcon },
  { href: "/plan",     labelZh: "蓝图", labelEn: "Plan",     subZh: "规划",     subEn: "Plan",    num: "②", Icon: PlanIcon },
  { href: "/today",    labelZh: "此刻", labelEn: "Today",    subZh: "执行 · 驾驶舱", subEn: "Focus", num: "③", Icon: TodayIcon, isDefault: true },
  { href: "/review",   labelZh: "复盘", labelEn: "Review",   subZh: "复盘",     subEn: "Review",  num: "④", Icon: ReviewIcon },
  { href: "/projects", labelZh: "项目", labelEn: "Projects", subZh: "整理",     subEn: "Organize", num: "⑤", Icon: ProjectIcon },
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
