// src/lib/date.ts — 统一本地时区日期工具
// ⚠️ 禁止直接用 toISOString().split("T")[0] 取"日期"：
// toISOString() 返回 UTC，在中国时区（UTC+8）每天 20:00 后本地"今天"≠UTC"今天"。
// 所有 YYYY-MM-DD 日期字符串的生成/解析必须走本模块。

/** 本地时区 YYYY-MM-DD */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 本地时区 YYYY-MM-DDTHH:mm:ss（无时区后缀，存库/展示用） */
export function localDateTimeStr(d: Date = new Date()): string {
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${localDateStr(d)}T${h}:${min}:${s}`;
}

/**
 * 把 "YYYY-MM-DD" 解析为本地时区零点 Date。
 * 不能直接用 new Date("YYYY-MM-DD") —— date-only 字符串按 UTC 解析，会偏移 8 小时。
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] || new Date().getFullYear();
  const m = (parts[1] || 1) - 1;
  const d = parts[2] || 1;
  return new Date(y, m, d, 0, 0, 0, 0);
}

/** 本地时区加减天数，返回 Date */
export function addDays(days: number, from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

/** 本地时区加减天数，返回 YYYY-MM-DD */
export function addDaysStr(days: number, from: Date = new Date()): string {
  return localDateStr(addDays(days, from));
}

/** 本地时区零点 */
export function startOfDay(d: Date = new Date()): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** 本地时区某天的 23:59:59.999 */
export function endOfDay(d: Date = new Date()): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}
