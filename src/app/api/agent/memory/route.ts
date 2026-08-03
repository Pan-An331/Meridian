import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

// POST /api/agent/memory — 写入一条用户记忆（Review「应用建议」等入口）
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  let body: { content?: string; memoryType?: string; scope?: string; importance?: number };
  try { body = await req.json(); } catch { return badRequest("请求格式错误"); }
  const content = (body.content || "").trim();
  if (content.length < 5) return badRequest("记忆内容太短");
  const memory = await prisma.agentMemory.create({
    data: {
      userId: session.user.id,
      memoryType: body.memoryType || "preference",
      content,
      scope: body.scope || "global",
      importance: typeof body.importance === "number" ? Math.min(5, Math.max(1, body.importance)) : 3,
      source: "user",
      confidence: 0.9,
      status: "active",
      importanceScore: 0.5,
    },
  });
  return NextResponse.json({ success: true, memory: { id: memory.id, content: memory.content } });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const now = new Date();
  const where: any = {
    userId: session.user.id, active: true,
    OR: [{ validUntil: null }, { validUntil: { gte: now } }],
  };
  if (type) where.memoryType = type;
  const memories = await prisma.agentMemory.findMany({
    where, orderBy: [{ importance: "desc" }, { createdAt: "desc" }], take: 20,
  });
  return NextResponse.json(memories);
}
