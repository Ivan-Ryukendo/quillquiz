import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireExamCreator } from "./helpers/auth";

export const send = mutation({
  args: {
    examId: v.id("examSessions"),
    message: v.string(),
  },
  returns: v.id("examMessages"),
  handler: async (ctx, args) => {
    const { user } = await requireExamCreator(ctx, args.examId);

    if (args.message.trim().length === 0) {
      throw new ConvexError("Message cannot be empty");
    }

    return await ctx.db.insert("examMessages", {
      examId: args.examId,
      senderId: user._id,
      message: args.message.trim(),
      sentAt: Date.now(),
    });
  },
});

export const listByExam = query({
  args: { examId: v.id("examSessions") },
  returns: v.array(
    v.object({
      _id: v.id("examMessages"),
      message: v.string(),
      sentAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("examMessages")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .order("asc")
      .take(500);

    return messages.map((m) => ({
      _id: m._id,
      message: m.message,
      sentAt: m.sentAt,
    }));
  },
});
