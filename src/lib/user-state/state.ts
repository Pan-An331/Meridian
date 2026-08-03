import { prisma } from "@/lib/prisma";

export interface UserStateData {
  energy: string | null;
  focus: string | null;
  mood: string | null;
  stress: string | null;
  note: string | null;
  updatedAt: string | null;
}

/**
 * 获取当前用户状态（每种类型取最新一条）
 * 纯数据库操作，不与AI绑定
 */
export async function getCurrentUserState(userId: string): Promise<UserStateData> {
  const now = new Date();
  const all = await prisma.userState.findMany({
    where: { userId, OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
    orderBy: { createdAt: "desc" },
  });

  const get = (type: string) => all.find(s => s.stateType === type)?.value || null;
  const latest = all[0];

  return {
    energy: get("energy"),
    focus: get("focus"),
    mood: get("mood"),
    stress: get("stress"),
    note: get("note"),
    updatedAt: latest?.createdAt?.toISOString() || null,
  };
}

/**
 * 更新用户状态（每种类型创建新记录，不覆盖历史）
 */
export async function updateUserState(userId: string, data: Partial<Record<string, string>>) {
  const stateTypes: Record<string, string> = {
    energy: "energy",
    focus: "focus",
    mood: "mood",
    stress: "stress",
    note: "note",
  };

  // 修复：事务化，避免部分字段写入失败造成状态不一致
  // 修复：状态当日有效（validUntil），避免旧状态永远影响决策（主路径，前端 Today 页走这里）
  const validUntil = new Date(); validUntil.setHours(23, 59, 59, 999);
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(data)) {
      const stateType = stateTypes[key];
      if (stateType && value !== undefined && value !== null) {
        await tx.userState.create({
          data: {
            userId,
            stateType,
            value: String(value),
            source: "user",
            confidence: 0.9,
            decisionWeight: 0.7,
            validUntil,
          },
        });
      }
    }
  });
}
