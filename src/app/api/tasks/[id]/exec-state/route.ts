import { NextRequest, NextResponse } from "next/server";
import { getServerSession, unauthorized } from "@/lib/api-utils";
import { getTaskExecutionState } from "@/lib/task/task-execution-state";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session) return unauthorized();
  const { id } = await params;
  const state = await getTaskExecutionState(id, session.user.id);
  return NextResponse.json(state);
}
