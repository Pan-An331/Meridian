/* ═══════════════════════════════════════════
   V3 信息架构 · 领域/主题色彩系统（前端先行实施）
   · 领域 7 类封顶（competition 已并入 practice + theme:竞赛，显示层迁移）
   · 主题 = 独立字段（考研橙/竞赛粉/身材青绿 + 自定义选色）
   · resolveTheme：tags 的 theme:* 前缀优先 → 标题关键词兜底 → 留空不强猜
   ═══════════════════════════════════════════ */

export const DOMAINS = {
  course:      { label: "课程",        border: "#475569", bg: "#E2E8F0" },
  learning:    { label: "学习成长",    border: "#3B82F6", bg: "#DBEAFE" },
  practice:    { label: "专业实践",    border: "#7C3AED", bg: "#EDE9FE" },
  health:      { label: "健康生活",    border: "#16A34A", bg: "#F0FDF4" },
  life:        { label: "个人事务",    border: "#CA8A04", bg: "#FEFCE8" },
  external:    { label: "社团/外部",   border: "#92400E", bg: "#FEF3C7" },
  other:       { label: "未分类",      border: "#CBD5E1", bg: "#F8FAFC" },
} as const;
export type DomainKey = keyof typeof DOMAINS;

/* V3 主题表：预设 3 个（考研/竞赛/身材）+ 自定义（选色）默认灰 */
export const THEMES: Record<string, { color: string; deep: string; bg: string }> = {
  考研: { color: "#F97316", deep: "#C2410C", bg: "#FFF7ED" },
  竞赛: { color: "#DB2777", deep: "#BE185D", bg: "#FDF2F8" },
  身材: { color: "#0D9488", deep: "#0F766E", bg: "#F0FDFA" },
};
export type ThemeKey = keyof typeof THEMES;

/** 主题默认灰（自定义主题未指定/未知主题兜底） */
export const THEME_FALLBACK = { color: "#6B7280", deep: "#4B5563", bg: "#F3F4F6" };

export function themeColor(theme: string | null | undefined) {
  if (!theme) return null;
  return THEMES[theme] ?? THEME_FALLBACK;
}

/**
 * 主题推断（V3 B1 resolveTheme）：tags 的 theme:* 前缀优先 → 标题关键词兜底 → null（不强猜）
 */
const THEME_TAG_PREFIX = "theme:";
const THEME_TITLE_MAP: [RegExp, string][] = [
  [/考研|数学|英语|政治|专业课|背单词/, "考研"],
  [/电赛|竞赛|比赛|PCB|电路|单片机|FPGA|原理图|布线/, "竞赛"],
  [/健身|身材|跑步|运动|减肥|锻炼/, "身材"],
];

export function resolveTheme(
  tags: string | null | undefined,
  title: string,
  category?: string | null | undefined,
): string | null {
  if (tags) {
    for (const tag of tags.split(",").map((t) => t.trim()).filter(Boolean)) {
      if (tag.startsWith(THEME_TAG_PREFIX) && tag.length > THEME_TAG_PREFIX.length) {
        const t = tag.slice(THEME_TAG_PREFIX.length).trim();
        if (t) return t;
      }
    }
  }
  for (const [pattern, theme] of THEME_TITLE_MAP) {
    if (pattern.test(title)) return theme;
  }
  return null; // 拿不准留空（V3：不强猜）
}

const TAG_MAP: Record<string, DomainKey> = {
  "课程": "course", "上课": "course", "作业": "course",
  "学习": "learning", "阅读": "learning",
  "项目": "practice", "开发": "practice", "创作": "practice",
  "健身": "health", "跑步": "health", "运动": "health",
  "生活": "life", "娱乐": "life", "购物": "life",
  "外部": "external", "社团": "external", "行政": "external",
};

// 数组顺序代表匹配优先级，越靠前优先级越高
const TITLE_MAP: [RegExp, DomainKey][] = [
  [/电赛|电子大赛|西门子杯|数学建模/, "practice"],
  [/嵌入式|PCB|电路|单片机|FPGA/, "practice"],
  [/编程|算法|LeetCode|代码/, "learning"],
  [/数学|英语|考研|阅读/, "learning"],
  [/健身|跑步|运动|冥想|睡眠/, "health"],
];

export function resolveDomain(tags: string | null | undefined, title: string): DomainKey {
  if (tags) {
    const parts = tags.split(",").map(t => t.trim());
    for (const tag of parts) {
      if (tag.startsWith("domain:") && DOMAINS[tag.slice(7) as DomainKey]) return tag.slice(7) as DomainKey;
    }
    for (const tag of parts) { if (TAG_MAP[tag]) return TAG_MAP[tag]; }
  }
  for (const [pattern, domain] of TITLE_MAP) {
    if (pattern.test(title)) return domain;
  }
  return "other";
}

export function domainColor(key: DomainKey) { return DOMAINS[key]; }

/**
 * 分类归一化：历史数据/LLM 输出可能是大写枚举（COURSE/LEARNING/...），
 * 统一收敛为 DOMAINS 小写 key。V3 D8：competition → practice（显示层迁移）。
 */
const CATEGORY_UPPER_TO_LOWER: Record<string, DomainKey> = {
  COURSE: "course",
  LEARNING: "learning",
  PRACTICE: "practice",
  COMPETITION: "practice", // V3 D8：竞赛并入专业实践
  HEALTH: "health",
  PERSONAL: "life",
  EXTERNAL: "external",
  UNCATEGORIZED: "other",
};

export function normalizeCategory(cat: string | null | undefined): DomainKey {
  if (!cat) return "other";
  const trimmed = cat.trim();
  if (DOMAINS[trimmed as DomainKey]) return trimmed as DomainKey;
  if (CATEGORY_UPPER_TO_LOWER[trimmed]) return CATEGORY_UPPER_TO_LOWER[trimmed];
  // V3 D8：存量 competition 小写值迁移
  if (trimmed.toLowerCase() === "competition") return "practice";
  // 小写兜底（如 "Life" / "Health" 等杂值）
  const lower = trimmed.toLowerCase();
  if (DOMAINS[lower as DomainKey]) return lower as DomainKey;
  return "other";
}

export function formatParentLabel(title: string, max = 10): string {
  const t = title.length > max ? title.slice(0, max) + "…" : title;
  return "#" + t;
}
