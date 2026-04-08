import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getUser } from "./helpers/auth";
import { checkShareRateLimit } from "./helpers/rateLimit";
import { sanitizeMarkdown } from "./helpers/sanitize";
import { generateUniqueRoomCode } from "./helpers/roomCode";

export const create = mutation({
  args: {
    markdown: v.string(),
    metadata: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
    pin: v.optional(v.string()),
    expiresInMs: v.optional(v.number()),
  },
  returns: v.object({
    id: v.id("sharedQuizzes"),
    shareCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    await checkShareRateLimit(ctx, user._id);

    if (args.markdown.length > 5 * 1024 * 1024) {
      throw new ConvexError("Quiz file exceeds 5MB limit");
    }

    const sanitizedMarkdown = sanitizeMarkdown(args.markdown);
    const shareCode = await generateUniqueRoomCode(ctx, "sharedQuizzes", "by_shareCode");
    const now = Date.now();
    const defaultExpiry = 24 * 60 * 60 * 1000;

    const id = await ctx.db.insert("sharedQuizzes", {
      creatorId: user._id,
      markdown: sanitizedMarkdown,
      metadata: args.metadata,
      shareCode,
      pin: args.pin,
      expiresAt: now + (args.expiresInMs ?? defaultExpiry),
      createdAt: now,
    });

    return { id, shareCode };
  },
});

export const getByShareCode = query({
  args: {
    shareCode: v.string(),
    pin: v.optional(v.string()),
  },
  returns: v.union(
    v.object({
      _id: v.id("sharedQuizzes"),
      markdown: v.string(),
      metadata: v.object({
        title: v.string(),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      }),
      createdAt: v.number(),
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const quiz = await ctx.db
      .query("sharedQuizzes")
      .withIndex("by_shareCode", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!quiz) return null;
    if (quiz.expiresAt < Date.now()) return null;

    if (quiz.pin && quiz.pin !== args.pin) {
      throw new ConvexError("Invalid PIN");
    }

    return {
      _id: quiz._id,
      markdown: quiz.markdown,
      metadata: quiz.metadata,
      createdAt: quiz.createdAt,
      expiresAt: quiz.expiresAt,
    };
  },
});

export const listMyShares = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("sharedQuizzes"),
      metadata: v.object({
        title: v.string(),
        description: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      }),
      shareCode: v.string(),
      expiresAt: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const user = await getUser(ctx);

    const quizzes = await ctx.db
      .query("sharedQuizzes")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", user._id))
      .order("desc")
      .take(100);

    return quizzes.map((q) => ({
      _id: q._id,
      metadata: q.metadata,
      shareCode: q.shareCode,
      expiresAt: q.expiresAt,
      createdAt: q.createdAt,
    }));
  },
});

export const remove = mutation({
  args: { quizId: v.id("sharedQuizzes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);
    const quiz = await ctx.db.get(args.quizId);

    if (!quiz || quiz.creatorId !== user._id) {
      throw new ConvexError("Not authorized to delete this quiz");
    }

    await ctx.db.delete(args.quizId);
    return null;
  },
});
