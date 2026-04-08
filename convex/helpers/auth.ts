import { QueryCtx, MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { Id } from "../_generated/dataModel";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  return identity;
}

export async function getUser(ctx: QueryCtx | MutationCtx) {
  const identity = await requireAuth(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", identity.tokenIdentifier))
    .unique();
  if (!user) {
    throw new ConvexError("User profile not found. Please complete signup.");
  }
  return user;
}

export async function requireExamCreator(
  ctx: QueryCtx | MutationCtx,
  examId: Id<"examSessions">
) {
  const user = await getUser(ctx);
  const exam = await ctx.db.get(examId);
  if (!exam) {
    throw new ConvexError("Exam session not found");
  }
  if (exam.creatorId !== user._id) {
    throw new ConvexError("Only the exam creator can perform this action");
  }
  return { user, exam };
}
