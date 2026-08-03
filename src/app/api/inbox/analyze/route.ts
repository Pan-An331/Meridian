import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { analyzeInboxInput } from "@/lib/ai/parser";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  let content: string;
  try { const body = await req.json(); content = body.content; } catch { return badRequest("请求格式错误"); }
  if (!content || typeof content !== "string" || content.trim().length < 1) return badRequest("请输入内容");

  try {
    // analyzeInboxInput 内置 AI 优先 + 规则降级，始终返回可用结果
    const result = await analyzeInboxInput(session.user.id, content.trim());

    // 草稿落库改为非阻塞：仅用于 confirm 状态标记；前端 localStorage 已持久化草稿，
    // 落库失败（SQLite 锁竞争）不再拖慢 AI 整理响应（原实现会阻塞 5-8s）
    prisma.taskDraft.create({
      data: {
        id: result.draftId,
        userId: session.user.id,
        content: content.trim(),
        status: "WAIT_CONFIRM",
        items: {
          create: result.items.map((item) => ({
            title: item.title,
            category: item.category || null,
            taskType: item.taskType,
            dataJson: JSON.stringify(item),
          })),
        },
      },
    }).catch((e) => console.error("[inbox/analyze] draft persist failed:", e.message));

    return NextResponse.json({ success: true, data: result });
  } catch (e) {
    // 仅在极端异常（如数据库崩溃）时才会到这里
    const message = e instanceof Error ? e.message : "分析失败";
    return NextResponse.json({ success: false, error: { code: "PARSE_FAILED", message } }, { status: 422 });
  }
}
