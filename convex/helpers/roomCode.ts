import { MutationCtx } from "../_generated/server";

const ROOM_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export async function generateUniqueRoomCode(
  ctx: MutationCtx,
  table: "sharedQuizzes" | "examSessions",
  indexName: "by_shareCode" | "by_roomCode"
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const field = indexName === "by_shareCode" ? "shareCode" : "roomCode";
    const existing = await ctx.db
      .query(table)
      .withIndex(indexName as any, (q: any) => q.eq(field, code))
      .unique();

    if (!existing) {
      return code;
    }
  }
  throw new Error("Failed to generate unique room code after 10 attempts");
}
