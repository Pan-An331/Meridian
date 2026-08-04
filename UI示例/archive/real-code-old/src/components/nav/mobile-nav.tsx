"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isActiveNav } from "@/components/nav/nav-items";

/* ═══════════════════════════════════════════
   MobileNav V2 — iOS 26 浮动底部胶囊
   · 只放 4 个主 Tab（设置移入页头齿轮，不再占 tab 位）
   ═══════════════════════════════════════════ */

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}
    >
      <div
        className="pointer-events-auto flex items-center gap-1 px-2 py-2 rounded-full
                    backdrop-blur-xl shadow-lg border transition-all duration-200"
        style={{
          background: "rgba(255,255,255,0.72)",
          borderColor: "rgba(255,255,255,0.3)",
          boxShadow: "var(--shadow-mobile-nav)",
        }}
      >
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = isActiveNav(pathname, href);
          return (
            <Link key={href} href={href}
              className="relative flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ease-out select-none"
              style={{ width: 64, height: 52 }}>
              {isActive && (
                <span className="absolute inset-1 rounded-full transition-all duration-200" style={{ background: "var(--grad-brand)" }} />
              )}
              <span className="relative z-10 transition-colors duration-200" style={{ width: 22, height: 22 }}>
                <Icon size={22} className={isActive ? "text-white" : "text-gray-400"} />
              </span>
              <span className={`relative z-10 text-[10px] font-medium leading-none transition-colors duration-200 ${isActive ? "text-white" : "text-gray-400"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
