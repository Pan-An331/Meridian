"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

/* ═══════════════════════════════════════════
   ThemeContext V3 — 四轴独立主题
   brand · ai · page · semantic 各自独立选择
   ═══════════════════════════════════════════ */

/* ── Axis types ── */

export type BrandId = "indigo" | "sunset" | "ocean" | "forest" | "midnight";
export type AIId = "indigo" | "sunset" | "ocean" | "forest" | "midnight";
export type PageId = "light" | "warm" | "dark";
export type SemId = "indigo" | "sunset" | "ocean" | "forest" | "midnight";

export interface ThemeMeta {
  id: string;
  name: string;
  color: string;
}

export const BRAND_LIST: ThemeMeta[] = [
  { id: "indigo", name: "靛蓝", color: "var(--color-brand-600)" },
  { id: "sunset", name: "日落", color: "#ea580c" },
  { id: "ocean", name: "深海", color: "#0d9488" },
  { id: "forest", name: "森林", color: "#10b981" },
  { id: "midnight", name: "午夜", color: "var(--v2-purple)" },
];

export const AI_LIST: ThemeMeta[] = [
  { id: "indigo", name: "靛蓝", color: "var(--color-brand-600)" },
  { id: "sunset", name: "日落", color: "#ea580c" },
  { id: "ocean", name: "深海", color: "#0d9488" },
  { id: "forest", name: "森林", color: "#10b981" },
  { id: "midnight", name: "午夜", color: "var(--v2-purple)" },
];

export const PAGE_LIST: ThemeMeta[] = [
  { id: "light", name: "浅色", color: "var(--color-gray-50)" },
  { id: "warm", name: "暖色", color: "#fef7ed" },
  { id: "dark", name: "深色", color: "#0f172a" },
];

export const SEM_LIST: ThemeMeta[] = [
  { id: "indigo", name: "靛蓝", color: "var(--color-brand-600)" },
  { id: "sunset", name: "日落", color: "#ea580c" },
  { id: "ocean", name: "深海", color: "#0ea5e9" },
  { id: "forest", name: "森林", color: "#059669" },
  { id: "midnight", name: "午夜", color: "#6366f1" },
];

/* ── One-click full presets ── */

const FULL_PRESET_MAP: Record<string, { brand: BrandId; ai: AIId; page: PageId; semantic: SemId; name: string }> = {
  indigo: { brand: "indigo", ai: "indigo", page: "light", semantic: "indigo", name: "靛蓝 Indigo" },
  sunset: { brand: "sunset", ai: "sunset", page: "warm", semantic: "sunset", name: "日落 Sunset" },
  ocean: { brand: "ocean", ai: "ocean", page: "light", semantic: "ocean", name: "深海 Ocean" },
  forest: { brand: "forest", ai: "forest", page: "light", semantic: "forest", name: "森林 Forest" },
  midnight: { brand: "midnight", ai: "midnight", page: "light", semantic: "midnight", name: "午夜 Midnight" },
};

export function getFullPresetMap() { return FULL_PRESET_MAP; }

/* ── Context ── */

interface ThemeContextValue {
  brand: BrandId;
  ai: AIId;
  page: PageId;
  semantic: SemId;
  setBrand: (id: BrandId) => void;
  setAI: (id: AIId) => void;
  setPage: (id: PageId) => void;
  setSemantic: (id: SemId) => void;
  setFullPreset: (preset: string) => void;
  brandMeta: ThemeMeta;
  aiMeta: ThemeMeta;
  pageMeta: ThemeMeta;
  semMeta: ThemeMeta;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ── Storage keys ── */

const STORAGE_KEY = "task-os-theme-v3";

interface StoredTheme {
  brand: BrandId;
  ai: AIId;
  page: PageId;
  semantic: SemId;
}

function getStoredTheme(): StoredTheme {
  if (typeof window === "undefined") return { brand: "indigo", ai: "indigo", page: "light", semantic: "indigo" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        brand: BRAND_LIST.some(t => t.id === parsed.brand) ? parsed.brand : "indigo",
        ai: AI_LIST.some(t => t.id === parsed.ai) ? parsed.ai : "indigo",
        page: PAGE_LIST.some(t => t.id === parsed.page) ? parsed.page : "light",
        semantic: SEM_LIST.some(t => t.id === parsed.semantic) ? parsed.semantic : "indigo",
      };
    }
  } catch {}
  // Try migrate from v2
  try {
    const v2 = localStorage.getItem("task-os-theme-v2");
    if (v2) {
      const parsed = JSON.parse(v2);
      localStorage.removeItem("task-os-theme-v2");
      return {
        brand: BRAND_LIST.some(t => t.id === parsed.brand) ? parsed.brand : "indigo",
        ai: AI_LIST.some(t => t.id === parsed.ai) ? parsed.ai : "indigo",
        page: PAGE_LIST.some(t => t.id === parsed.page) ? parsed.page : "light",
        semantic: "indigo",
      };
    }
  } catch {}
  return { brand: "indigo", ai: "indigo", page: "light", semantic: "indigo" };
}

function saveTheme(theme: StoredTheme) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(theme)); } catch {}
}

function applyTheme(theme: StoredTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme-brand", theme.brand);
  document.documentElement.setAttribute("data-theme-ai", theme.ai);
  document.documentElement.setAttribute("data-theme-page", theme.page);
  document.documentElement.setAttribute("data-theme-sem", theme.semantic);

  const brandMeta = BRAND_LIST.find(t => t.id === theme.brand);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && brandMeta) meta.setAttribute("content", brandMeta.color);
}

/* ── Provider ── */

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<StoredTheme>({ brand: "indigo", ai: "indigo", page: "light", semantic: "indigo" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
    setMounted(true);
  }, []);

  const updateAndApply = useCallback((partial: Partial<StoredTheme>) => {
    setThemeState(prev => {
      const next = { ...prev, ...partial };
      applyTheme(next);
      saveTheme(next);
      return next;
    });
  }, []);

  const setBrand = useCallback((id: BrandId) => updateAndApply({ brand: id }), [updateAndApply]);
  const setAI = useCallback((id: AIId) => updateAndApply({ ai: id }), [updateAndApply]);
  const setPage = useCallback((id: PageId) => updateAndApply({ page: id }), [updateAndApply]);
  const setSemantic = useCallback((id: SemId) => updateAndApply({ semantic: id }), [updateAndApply]);

  const setFullPreset = useCallback((preset: string) => {
    const p = FULL_PRESET_MAP[preset];
    if (p) updateAndApply({ brand: p.brand, ai: p.ai, page: p.page, semantic: p.semantic });
  }, [updateAndApply]);

  const brandMeta = BRAND_LIST.find(t => t.id === theme.brand) || BRAND_LIST[0];
  const aiMeta = AI_LIST.find(t => t.id === theme.ai) || AI_LIST[0];
  const pageMeta = PAGE_LIST.find(t => t.id === theme.page) || PAGE_LIST[0];
  const semMeta = SEM_LIST.find(t => t.id === theme.semantic) || SEM_LIST[0];

  if (!mounted) {
    return (
      <ThemeContext.Provider value={{
        brand: "indigo" as BrandId, ai: "indigo" as AIId, page: "light" as PageId, semantic: "indigo" as SemId,
        setBrand: () => {}, setAI: () => {}, setPage: () => {}, setSemantic: () => {}, setFullPreset: () => {},
        brandMeta: BRAND_LIST[0], aiMeta: AI_LIST[0], pageMeta: PAGE_LIST[0], semMeta: SEM_LIST[0],
      }}>
        <div style={{ visibility: "hidden" }}>{children}</div>
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{
      brand: theme.brand, ai: theme.ai, page: theme.page, semantic: theme.semantic,
      setBrand, setAI, setPage, setSemantic, setFullPreset,
      brandMeta, aiMeta, pageMeta, semMeta,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}