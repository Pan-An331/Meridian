import { NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { refreshTodayDecision } from "@/lib/ai/today-decision";

export async function POST() {
  const session = await getServerSession();
  if (!session) return unauthorized();

  try {
    const result = await refreshTodayDecision(session.user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (e) { console.error("[today/refresh] failed:", e);
    return NextResponse.json({ error: "刷新失败" }, { status: 500 });
  }
}
