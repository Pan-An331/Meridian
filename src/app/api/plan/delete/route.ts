import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { deletePlanItem } from "@/lib/plan/service";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let taskId: string;
  try { taskId = (await req.json()).taskId; } catch { return badRequest("请求格式错误"); }
  if (!taskId) return badRequest("需要 taskId");

  const result = await deletePlanItem(session.user.id, taskId);
  return NextResponse.json({ success: true, ...result });
}
