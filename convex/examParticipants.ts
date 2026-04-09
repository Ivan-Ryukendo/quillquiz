import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireExamCreator } from "./helpers/auth";
import { checkJoinRateLimit, recordFailedJoin } from "./helpers/rateLimit";
import { Id } from "./_generated/dataModel";

const flagValidator = v.object({
  type: v.string(),
  timestamp: v.number(),
  details: v.string(),
});

export const join = mutation({
  args: {
    roomCode: v.string(),
    name: v.string(),
    connectionId: v.string(),
    browserFingerprint: v.string(),
    userId: v.optional(v.id("users")),
    ip: v.string(),
    pin: v.optional(v.string()),
  },
  returns: v.object({
    participantId: v.id("examParticipants"),
    examId: v.id("examSessions"),
  }),
  handler: async (ctx, args) => {
    await checkJoinRateLimit(ctx, args.ip);

    const exam = await ctx.db
      .query("examSessions")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode))
      .unique();

    if (!exam) {
      await recordFailedJoin(ctx, args.ip);
      throw new ConvexError("Invalid room code");
    }

    if (exam.settings.teacherPin && exam.settings.teacherPin !== args.pin) {
      await recordFailedJoin(ctx, args.ip);
      throw new ConvexError("Invalid PIN");
    }

    if (exam.status === "completed") {
      throw new ConvexError("This exam has already ended");
    }

    if (exam.status === "in_progress" && !exam.settings.allowLateJoins) {
      throw new ConvexError("This exam does not allow late joins");
    }

    if (exam.settings.enforceLogin && !args.userId) {
      throw new ConvexError("This exam requires you to be logged in");
    }

    if (args.userId) {
      const existingByUser = await ctx.db
        .query("examParticipants")
        .withIndex("by_examId_and_userId", (q) =>
          q.eq("examId", exam._id).eq("userId", args.userId!)
        )
        .unique();

      if (existingByUser && existingByUser.status !== "kicked") {
        const flags = [
          ...existingByUser.flags,
          {
            type: "duplicate_connection",
            timestamp: Date.now(),
            details: `New connection replaced previous (connectionId: ${args.connectionId})`,
          },
        ];

        await ctx.db.patch(existingByUser._id, {
          connectionId: args.connectionId,
          browserFingerprint: args.browserFingerprint,
          flags,
        });

        return { participantId: existingByUser._id, examId: exam._id };
      }
    }

    const status = exam.status === "in_progress" ? "in_progress" : "waiting";

    const participantId = await ctx.db.insert("examParticipants", {
      examId: exam._id,
      name: args.name,
      userId: args.userId,
      connectionId: args.connectionId,
      browserFingerprint: args.browserFingerprint,
      status,
      joinedAt: Date.now(),
      flags: [],
    });

    return { participantId, examId: exam._id };
  },
});

export const setReady = mutation({
  args: { participantId: v.id("examParticipants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.status !== "waiting") {
      throw new ConvexError("Cannot set ready from current state");
    }

    await ctx.db.patch(args.participantId, { status: "ready" });
    return null;
  },
});

export const listByExam = query({
  args: { examId: v.id("examSessions") },
  returns: v.array(
    v.object({
      _id: v.id("examParticipants"),
      name: v.string(),
      userId: v.optional(v.id("users")),
      status: v.union(
        v.literal("waiting"),
        v.literal("ready"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("kicked")
      ),
      joinedAt: v.number(),
      flags: v.array(flagValidator),
    })
  ),
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("examParticipants")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(500);

    return participants.map((p) => ({
      _id: p._id,
      name: p.name,
      userId: p.userId,
      status: p.status,
      joinedAt: p.joinedAt,
      flags: p.flags,
    }));
  },
});

export const kick = mutation({
  args: {
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireExamCreator(ctx, args.examId);

    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.examId !== args.examId) {
      throw new ConvexError("Participant not found in this exam");
    }

    await ctx.db.patch(args.participantId, {
      status: "kicked",
      kickReason: args.reason,
    });
    return null;
  },
});

export const addFlag = mutation({
  args: {
    participantId: v.id("examParticipants"),
    type: v.string(),
    details: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new ConvexError("Participant not found");
    }

    const flags = [
      ...participant.flags,
      {
        type: args.type,
        timestamp: Date.now(),
        details: args.details,
      },
    ];

    await ctx.db.patch(args.participantId, { flags });
    return null;
  },
});

export const getParticipant = query({
  args: { participantId: v.id("examParticipants") },
  returns: v.union(
    v.object({
      _id: v.id("examParticipants"),
      examId: v.id("examSessions"),
      name: v.string(),
      status: v.union(
        v.literal("waiting"),
        v.literal("ready"),
        v.literal("in_progress"),
        v.literal("completed"),
        v.literal("kicked")
      ),
      kickReason: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const p = await ctx.db.get(args.participantId);
    if (!p) return null;
    return {
      _id: p._id,
      examId: p.examId,
      name: p.name,
      status: p.status,
      kickReason: p.kickReason,
    };
  },
});

export const markCompleted = mutation({
  args: { participantId: v.id("examParticipants") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new ConvexError("Participant not found");
    if (participant.status !== "in_progress") {
      throw new ConvexError("Cannot mark completed from current state");
    }
    await ctx.db.patch(args.participantId, { status: "completed" });
    return null;
  },
});
