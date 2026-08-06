import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// 只允许 http/https 外部地址，禁止内网/回环（SSRF 防护）
const BLOCKED_URL_PATTERNS = [/^https?:\/\/(127\.0\.0\.1|localhost|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i, /^file:/i, /^ftp:/i];

function isValidBaseUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (BLOCKED_URL_PATTERNS.some((p) => p.test(url))) return false;
  return true;
}

// GET /api/ai-config - get current AI config (mask apiKey)
// 注：连接测试逻辑已迁移到 /api/ai-config/test（前端"测试连接"按钮对应路由，2026-08-06 修复 404）
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const config = await prisma.aIConfig.findUnique({
    where: { userId: session.user.id },
  });

  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey.slice(0, 6) + "..." + config.apiKey.slice(-4),
    model: config.model,
  });
}

// PUT /api/ai-config - 保存 AI 配置
export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let provider, baseUrl, apiKey, model;
  try {
    const body = await req.json();
    provider = body.provider;
    baseUrl = body.baseUrl;
    apiKey = body.apiKey;
    model = body.model;
  } catch {
    return badRequest("请求格式错误");
  }

  if (!provider || !baseUrl || !model) {
    return badRequest("provider / baseUrl / model 不能为空");
  }
  if (!isValidBaseUrl(baseUrl)) return badRequest("baseUrl 必须是合法的 http/https 外部地址");

  const existing = await prisma.aIConfig.findUnique({
    where: { userId: session.user.id },
  });

  if (existing) {
    await prisma.aIConfig.update({
      where: { userId: session.user.id },
      // apiKey 留空 = 保持原值（修复：GET 只返回掩码，用户无需重输）
      data: { provider, baseUrl, model, ...(apiKey ? { apiKey } : {}) },
    });
  } else {
    if (!apiKey) return badRequest("首次配置必须提供 apiKey");
    await prisma.aIConfig.create({
      data: {
        userId: session.user.id,
        provider,
        baseUrl,
        apiKey,
        model,
      },
    });
  }

  return NextResponse.json({ success: true });
}
