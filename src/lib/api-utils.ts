import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function getServerSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session as { user: { id: string; email: string; name?: string } };
}

export function unauthorized() {
  return NextResponse.json({ error: "未登录" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}