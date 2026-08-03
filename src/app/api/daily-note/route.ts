import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized, badRequest } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { localDateStr } from "@/lib/date";

// GET /api/daily-note?date=2026-07-23 or /api/daily-note?range=week
export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const userId = session.user.id;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const range = searchParams.get("range");

  if (date) {
    // Single day
    const note = await prisma.dailyNote.findUnique({
      where: { userId_date: { userId, date } },
    });
    return NextResponse.json({ date, content: note?.content || "" });
  }

  if (range === "week" || range === "month") {
    const now = new Date();
    let startDate: Date;
    if (range === "week") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
    }
    const startDateStr = localDateStr(startDate);
    const endDateStr = localDateStr(now);

    const notes = await prisma.dailyNote.findMany({
      where: {
        userId,
        date: { gte: startDateStr, lte: endDateStr },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(notes);
  }

  return badRequest("请提供 date 或 range 参数");
}

// PUT /api/daily-note - save note for a date
export async function PUT(req: NextRequest) {
  const session = await getServerSession();
  if (!session) return unauthorized();

  const userId = session.user.id;

  try {
    const { date, content } = await req.json();
    if (!date) return badRequest("请提供日期");

    const note = await prisma.dailyNote.upsert({
      where: { userId_date: { userId, date } },
      update: { content: content || "" },
      create: { userId, date, content: content || "" },
    });

    return NextResponse.json(note);
  } catch {
    return badRequest("保存失败");
  }
}