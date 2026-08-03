"use client";

/* ═══════════════════════════════════════════
   UI Preferences — 导航方案 + Focus Card 版式
   存取 localStorage，首版即可用，后续可迁移 UserProfile
   · 事件名常量 + 订阅函数（接收方做类型守卫）
   ═══════════════════════════════════════════ */

export type NavMode = "side" | "top";
export type FcLayout = 1 | 2; // 1 = 一栏（放大） 2 = 两栏（左信息/右内容）

const NAV_KEY = "taskos.nav";
const LAYOUT_KEY = "taskos.fcLayout";

export const NAV_DEFAULT: NavMode = "side";
export const LAYOUT_DEFAULT: FcLayout = 1;

export const NAV_CHANGE_EVENT = "taskos:nav-change";
export const FCLAYOUT_CHANGE_EVENT = "taskos:fclayout-change";

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

/* ── 跨组件广播：设置页改动 → 壳 / Today 立即响应 ── */

function isNavMode(v: unknown): v is NavMode {
  return v === "side" || v === "top";
}

function isFcLayout(v: unknown): v is FcLayout {
  return v === 1 || v === 2;
}

export function listenNavMode(cb: (mode: NavMode) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (isNavMode(detail)) cb(detail);
  };
  window.addEventListener(NAV_CHANGE_EVENT, handler);
  return () => window.removeEventListener(NAV_CHANGE_EVENT, handler);
}

export function listenFcLayout(cb: (layout: FcLayout) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (isFcLayout(detail)) cb(detail);
  };
  window.addEventListener(FCLAYOUT_CHANGE_EVENT, handler);
  return () => window.removeEventListener(FCLAYOUT_CHANGE_EVENT, handler);
}
