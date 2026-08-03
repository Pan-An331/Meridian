import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const now = new Date();
  const states = await prisma.userState.findMany({
    where: { userId: session.user.id, OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
    orderBy: { createdAt: "desc" }, take: 20,
  });
  return NextResponse.json(states);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  let body: any;
  try { body = await req.json(); } catch { return badRequest("请求格式错误"); }
  if (!body.stateType || !body.value) return badRequest("stateType和value不能为空");
  // 修复 P1-13：stateType 白名单（防任意字符串污染决策引擎）
  const VALID_STATE_TYPES = ["energy", "focus", "mood", "stress", "note"];
  if (!VALID_STATE_TYPES.includes(body.stateType)) return badRequest("无效的 stateType");

  // 修复 P1-12：状态当日有效，避免旧状态永不过期
  const validUntil = new Date(); validUntil.setHours(23, 59, 59, 999);
  const state = await prisma.userState.create({
    data: {
      userId: session.user.id,
      stateType: body.stateType,
      value: body.value,
      impactLevel: body.impactLevel || null,
      impactHint: body.impactHint || null,
      source: "user", // 修复：客户端不可伪装 ai 来源
      confidence: 0.9,
      decisionWeight: 0.5,
      validUntil,
    },
  });
  return NextResponse.json(state);
}
