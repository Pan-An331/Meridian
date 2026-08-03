import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { executeConfirmedTool } from "@/lib/ai/executor";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let tool: string, args: Record<string, any>;
  try { const body = await req.json(); tool = body.tool; args = body.args || {}; } catch { return badRequest("请求格式错误"); }
  if (!tool) return badRequest("缺少 tool 参数");

  try {
    // delete_task: use saved taskId, no re-resolve
    // The taskId was resolved in the first pass and saved in confirmation.data.args
    const result = await executeConfirmedTool(session.user.id, tool, args);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: "执行失败" }, { status: 500 });
  }
}
