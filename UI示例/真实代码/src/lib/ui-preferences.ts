"use client";

/* ═══════════════════════════════════════════
   UI Preferences — 导航方案 + Focus Card 版式
   存取 localStorage，首版即可用，后续可迁移 UserProfile
   ═══════════════════════════════════════════ */

export type NavMode = "side" | "top";
export type FcLayout = 1 | 2; // 1 = 一栏（放大） 2 = 两栏（左信息/右内容）

const NAV_KEY = "taskos.nav";
const LAYOUT_KEY = "taskos.fcLayout";

export const NAV_DEFAULT: NavMode = "side";
export const LAYOUT_DEFAULT: FcLayout = 1;

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function safeSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function getNavMode(): NavMode {
  const v = safeGet(NAV_KEY);
  return v === "top" ? "top" : NAV_DEFAULT;
}

export function setNavMode(mode: NavMode) {
  safeSet(NAV_KEY, mode);
}

export function getFcLayout(): FcLayout {
  const v = safeGet(LAYOUT_KEY);
  return v === "2" ? 2 : LAYOUT_DEFAULT;
}

export function setFcLayout(layout: FcLayout) {
  safeSet(LAYOUT_KEY, String(layout));
}
