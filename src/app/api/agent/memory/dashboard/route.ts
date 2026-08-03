import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { blockMemory, checkBlockedMemoryRevival } from "@/lib/ai/memory-manager";

// GET — read top memories + trust score
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const userId = session.user.id;

  const [topMemories, userModel, blockedRevivals] = await Promise.all([
    prisma.agentMemory.findMany({
      where: { userId, status: { not: "retired" } },
      orderBy: { importanceScore: "desc" },
      take: 15,
      select: {
        id: true,
        memoryType: true,
        content: true,
        confidence: true,
        source: true,
        dimension: true,
        status: true,
        evidenceCount: true,
        importanceScore: true,
        contextTags: true,
        createdAt: true,
        lastUsedAt: true,
      },
    }),
    prisma.userModel.findUnique({
      where: { userId },
      select: { trustScore: true, peakHours: true, dailyCapacity: true },
    }),
    checkBlockedMemoryRevival(userId),
  ]);

  const trustScore = userModel?.trustScore || 0.5;
  const peakHours = userModel?.peakHours ? JSON.parse(userModel.peakHours) : [];
  const dailyCapacity = userModel?.dailyCapacity || 0;

  return NextResponse.json({
    topMemories,
    trustScore,
    peakHours,
    dailyCapacity,
    blockedRevivals,
  });
}

// POST — block/unblock a memory, or add user declaration
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const userId = session.user.id;

  const { action, memoryId, content, memoryType } = await req.json();

  switch (action) {
    case "block":
    case "pin":
    case "unblock": {
      // 修复 P0-1：操作前校验记忆归属（IDOR），未命中返回 404
      const owned = await prisma.agentMemory.findFirst({ where: { id: memoryId, userId }, select: { id: true } });
      if (!owned) return NextResponse.json({ error: "记忆不存在" }, { status: 404 });
      if (action === "block") {
        await blockMemory(memoryId);
      } else if (action === "pin") {
        await prisma.agentMemory.update({ where: { id: memoryId }, data: { importanceScore: 10 } });
      } else {
        await prisma.agentMemory.update({ where: { id: memoryId }, data: { status: "active" } });
      }
      return NextResponse.json({ success: true });
    }

    case "declare":
      await prisma.agentMemory.create({
        data: {
          userId,
          memoryType: memoryType || "preference",
          content,
          source: "user_declaration",
          confidence: 1.0,
          status: "active",
          dimension: "preference",
        },
      });
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }
}
