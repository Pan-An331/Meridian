import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const profile = await prisma.userProfile.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json(profile || { exists: false });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  let body: any;
  try { body = await req.json(); } catch { return badRequest("请求格式错误"); }

  // 修复 IDOR/批量赋值：只允许写入白名单字段，userId 等不可被客户端覆盖
  const ALLOWED = ["identity", "wakeTime", "sleepTime", "availableSlots", "fixedBlocks", "peakEnergy", "lowEnergy", "preferences", "longTermGoals", "notes"] as const;
  const data: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (Object.keys(data).length === 0) return badRequest("没有可保存的字段");

  const existing = await prisma.userProfile.findUnique({ where: { userId: session.user.id } });
  if (existing) {
    await prisma.userProfile.update({ where: { userId: session.user.id }, data });
  } else {
    await prisma.userProfile.create({ data: { userId: session.user.id, ...data } });
  }
  return NextResponse.json({ success: true });
}
