import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { confirmDraftItems } from "@/lib/inbox/confirm-service";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let body: any;
  try { body = await req.json(); } catch { return badRequest("请求格式错误"); }

  const { draftId, confirmed } = body;
  if (!draftId) return badRequest("缺少 draftId");
  if (!Array.isArray(confirmed) || confirmed.length === 0) return badRequest("缺少确认的任务");

  try {
    const tasks = await confirmDraftItems(session.user.id, draftId, confirmed);
    return NextResponse.json({
      success: true,
      data: { created: tasks, total: tasks.length },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: { code: "CONFIRM_FAILED", message: "创建任务失败" } }, { status: 500 });
  }
}
