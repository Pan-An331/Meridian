/* ═══════════════════════════════════════════
   V3 D5 数据主权：导出 JSON 版本契约
   · 决策 D5（总控 R4 红线）：导出必须带 schemaVersion + 迁移映射表，数据是用户资产
   · v1 = V2 时期格式；v2 = V3 格式（当前，2026-08-03 起）
   ═══════════════════════════════════════════ */

/** 当前导出数据结构版本 */
export const EXPORT_SCHEMA_VERSION = 2;

/** 迁移映射表：旧版本 → 本版本的字段变化（导入/迁移时按此对照） */
export const EXPORT_MIGRATION_MAP: Record<number, { label: string; changes: string[] }> = {
  1: {
    label: "V2 时期导出格式（2026-08-02 前）",
    changes: [
      "新增 Task.theme 主题字段（预设：考研/竞赛/身材 + 自定义 ≤20 字）",
      "领域 competition 已并入 practice，原 competition 任务迁移为 practice + theme:竞赛（决策 D8）",
      "删除 Task 死字段：temperature / startTime / endTime / cognitiveLoad / schedulingHint（决策 D12）",
      "tags 剥离系统前缀 domain:* / theme:* / important:*（theme:* 值已回填 theme 字段）",
      "卡片形态不落库：计时/清单/学习/积累由数据推断",
    ],
  },
  2: {
    label: "V3 当前格式",
    changes: [],
  },
};

/** 导出文件头（JSON 顶层固定字段） */
export function buildExportHeader(exportedAt: string) {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    migrationMap: EXPORT_MIGRATION_MAP,
    exportedAt,
  };
}
