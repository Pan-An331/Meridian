import { describe, expect, it } from "vitest";
import { EXPORT_SCHEMA_VERSION, EXPORT_MIGRATION_MAP, buildExportHeader } from "@/lib/export-version";

/* V3 D5 数据主权：导出 JSON 版本契约单测（决策 D5 / 总控 R4 红线） */

describe("EXPORT_SCHEMA_VERSION · 导出版本号", () => {
  it("当前版本为 2（V3 格式）", () => {
    expect(EXPORT_SCHEMA_VERSION).toBe(2);
  });
});

describe("EXPORT_MIGRATION_MAP · 迁移映射表", () => {
  it("包含 v1→v2 迁移说明（V3 关键变更都在）", () => {
    const v1 = EXPORT_MIGRATION_MAP[1];
    expect(v1).toBeDefined();
    const all = v1.changes.join("\n");
    expect(all).toContain("competition"); // D8 领域并入 practice
    expect(all).toContain("theme");       // D9 主题字段
    expect(all).toContain("temperature"); // D12 死字段删除
    expect(all).toContain("domain:");
  });
  it("当前版本 v2 无迁移变更", () => {
    expect(EXPORT_MIGRATION_MAP[2].changes).toHaveLength(0);
  });
});

describe("buildExportHeader · 导出文件头", () => {
  it("含 schemaVersion + migrationMap + exportedAt", () => {
    const h = buildExportHeader("2026-08-03T00:00:00.000Z");
    expect(h.schemaVersion).toBe(2);
    expect(h.migrationMap[1]).toBeDefined();
    expect(h.exportedAt).toBe("2026-08-03T00:00:00.000Z");
  });
});
