import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { fetchWithTimeout } from "@/lib/ai/client";

/* ═══════════════════════════════════════════
   POST /api/ai-config/test — AI 连接测试
   前端"测试连接"按钮的对应后端（2026-08-06 修复：
   此前前端调 /test 但路由不存在 → 永远 404"连接失败"）
   ═══════════════════════════════════════════ */

// 只允许 http/https 外部地址，禁止内网/回环（SSRF 防护）
const BLOCKED_URL_PATTERNS = [/^https?:\/\/(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i, /^file:/i, /^ftp:/i];

function isValidBaseUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (BLOCKED_URL_PATTERNS.some((p) => p.test(url))) return false;
  return true;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let baseUrl, apiKey, model;
  try {
    const body = await req.json();
    baseUrl = body.baseUrl;
    apiKey = body.apiKey;
    model = body.model;
  } catch {
    return badRequest("请求格式错误");
  }
  if (!baseUrl || !apiKey || !model) return badRequest("配置不完整");
  if (!isValidBaseUrl(baseUrl)) return badRequest("baseUrl 必须是合法的 http/https 外部地址");

  const start = Date.now();
  try {
    const res = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
    }, 15000);
    if (!res.ok) {
      // 附带服务端返回的错误详情（如 401 密钥无效 / 404 模型不存在）
      let detail = "";
      try {
        const d = await res.json();
        detail = d?.error?.message ? `: ${String(d.error.message).slice(0, 120)}` : "";
      } catch { /* 非 JSON 响应忽略 */ }
      return NextResponse.json({ ok: false, error: { message: `HTTP ${res.status}${detail}` } }, { status: 502 });
    }
    return NextResponse.json({ ok: true, latency: Date.now() - start });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "连接失败";
    return NextResponse.json({ ok: false, error: { message: msg } }, { status: 502 });
  }
}
