/* ═══════════════════════════════════════════
   Project 页优化 · 阶段 B：孤儿任务建议归属（suggestion）
   · 纯规则，零 AI 依赖（Project页优化-后端开发指令 §3）
   · 匹配：① 标题匹配（孤儿标题含目标节点名关键词）→ ② 主题匹配（theme 一致）
   · 拿不准 → null（产品红线：不强猜，前端显示"拖拽归位"）
   ═══════════════════════════════════════════ */

export type SuggestionReason = "title-match" | "theme-match";

export interface SuggestTarget {
  id: string;
  title: string;
  theme: string | null;
}

export interface Suggestion {
  targetId: string;
  targetTitle: string;
  reason: SuggestionReason;
}

/**
 * 标题匹配：孤儿标题包含目标节点标题关键词（≥2 字）→ 建议挂入
 * 保守：目标标题 <2 字不匹配（太泛）；孤儿标题与目标标题完全相同不匹配（自己）
 */
function titleMatch(orphanTitle: string, targetTitle: string): boolean {
  const t = targetTitle.trim();
  if (t.length < 2) return false;
  if (orphanTitle === t) return false;
  // 目标标题去掉常见后缀词后仍能作为关键词命中
  return orphanTitle.includes(t);
}

/**
 * 为单个孤儿任务计算建议挂入目标
 * @param orphan 孤儿任务 {title, theme}
 * @param targets 候选挂入节点（project/phase 级，按 sortOrder 顺序）
 * @returns suggestion 或 null（不强猜）
 */
export function suggestTarget(
  orphan: { title: string; theme: string | null },
  targets: SuggestTarget[]
): Suggestion | null {
  // ① 标题匹配：遍历 targets，命中第一个即返回（顺序优先 = 排序靠前的项目）
  for (const t of targets) {
    if (titleMatch(orphan.title, t.title)) {
      return { targetId: t.id, targetTitle: t.title, reason: "title-match" };
    }
  }
  // ② 主题匹配：孤儿 theme 与某目标 theme 一致
  if (orphan.theme) {
    for (const t of targets) {
      if (t.theme && t.theme === orphan.theme) {
        return { targetId: t.id, targetTitle: t.title, reason: "theme-match" };
      }
    }
  }
  // ③ 都无 → null（不强猜）
  return null;
}
