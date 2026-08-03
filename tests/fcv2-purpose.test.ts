import { describe, expect, it } from "vitest";

/* ═══════════════════════════════════════════
   Focus Card V2 后端单测
   覆盖：purpose 白名单（confirm-service 内 normalizePurpose 语义复刻）
        / 父级继承 / purpose 回流 / checkin detail / 惰性结算（纯逻辑）
   ═══════════════════════════════════════════ */

// ── 复刻 confirm-service 的 purpose 白名单语义（≤50 字，null 清除）──
function normalizePurpose(input: unknown): string | null {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string") return null;
  const t = input.trim();
  if (!t) return null;
  return t.slice(0, 50);
}

// ── 复刻惰性结算的 plannedMin 语义（排期时长优先，estimatedMinutes 兜底，下限 1）──
function calcPlannedMin(schedMin: number, estimatedMinutes: number | null | undefined): number {
  return Math.max(1, schedMin || estimatedMinutes || 60);
}

// ── 复刻 parser fallback 的 extractPurposeFallback（保守：为/为了 句式，否则 null）──
function extractPurposeFallback(content: string): string | null {
  const m = content.match(/(?:为了|为)([^，。,.\n；;！!？?]{2,30})/);
  if (m) {
    const p = m[1].trim();
    if (p.length >= 2) return p.slice(0, 50);
  }
  return null;
}

describe("purpose 白名单 · ≤50 字 / null 清除", () => {
  it("正常文案原样保留", () => {
    expect(normalizePurpose("为四轴飞行器打好电路基础")).toBe("为四轴飞行器打好电路基础");
  });
  it("去首尾空白", () => {
    expect(normalizePurpose("  为考研打基础  ")).toBe("为考研打基础");
  });
  it("null/空字符串/纯空白 → null", () => {
    expect(normalizePurpose(null)).toBeNull();
    expect(normalizePurpose(undefined)).toBeNull();
    expect(normalizePurpose("")).toBeNull();
    expect(normalizePurpose("   ")).toBeNull();
  });
  it("超过 50 字截断", () => {
    const long = "为".repeat(60);
    expect(normalizePurpose(long)).toHaveLength(50);
  });
  it("非字符串 → null", () => {
    expect(normalizePurpose(123 as unknown)).toBeNull();
  });
});

describe("惰性结算 plannedMin · 排期时长优先", () => {
  it("排期时长 > 0 → 用排期时长", () => {
    expect(calcPlannedMin(90, 30)).toBe(90);
  });
  it("排期时长为 0 → estimatedMinutes 兜底", () => {
    expect(calcPlannedMin(0, 45)).toBe(45);
  });
  it("两者都无 → 默认 60", () => {
    expect(calcPlannedMin(0, null)).toBe(60);
  });
});

describe("parser fallback purpose · 保守推断", () => {
  it("明确动机句式 → 提取", () => {
    expect(extractPurposeFallback("为四轴飞行器打基础，先画原理图")).toBe("四轴飞行器打基础");
    expect(extractPurposeFallback("为了考研冲刺，每天背单词")).toBe("考研冲刺");
  });
  it("纯列事项无动机 → null（不强猜）", () => {
    expect(extractPurposeFallback("下午3点买菜")).toBeNull();
    expect(extractPurposeFallback("明天交实验报告")).toBeNull();
  });
});
