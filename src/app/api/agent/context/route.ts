import { NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { buildAgentContext } from "@/lib/ai/context";

export async function GET() {
  const session = await getServerSession();
  if (!session) return unauthorized();
  try {
    const ctx = await buildAgentContext(session.user.id);
    return NextResponse.json(ctx);
  } catch (e) {
    console.error("[agent/context]", e);
    return NextResponse.json({ error: "构建上下文失败" }, { status: 500 });
  }
}
