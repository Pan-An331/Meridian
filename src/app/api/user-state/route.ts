import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { updateUserState, getCurrentUserState } from "@/lib/user-state/state";
import { prisma } from "@/lib/prisma";

// GET — 获取今日状态历史
export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const records = await prisma.userState.findMany({
    where: { userId: session.user.id, createdAt: { gte: today } },
    orderBy: { createdAt: "asc" },
    select: { stateType: true, value: true, createdAt: true },
  });

  // Group records by time bucket (each unique createdAt ≈ one update batch)
  const timeMap = new Map<string, Record<string, string>>();
  for (const r of records) {
    const timeKey = r.createdAt.toISOString();
    if (!timeMap.has(timeKey)) timeMap.set(timeKey, {});
    timeMap.get(timeKey)![r.stateType] = r.value;
  }

  const history = Array.from(timeMap.entries()).map(([time, states]) => ({
    time: new Date(time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    energy: states.energy || null,
    focus: states.focus || null,
    mood: states.mood || null,
    stress: states.stress || null,
  }));

  const current = await getCurrentUserState(session.user.id);

  return NextResponse.json({
    current: { energy: current.energy, focus: current.focus, mood: current.mood, stress: current.stress },
    updatedAt: current.updatedAt,
    history,
  });
}

// POST — 更新状态（每次创建新记录，不覆盖历史）
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  try {
    const body = await req.json();
    await updateUserState(session.user.id, body);
    return NextResponse.json({ success: true });
  } catch { return badRequest("状态更新失败"); }
}
