import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { getUser, requireExamCreator } from "./helpers/auth";
import { generateUniqueRoomCode } from "./helpers/roomCode";

const examSettingsValidator = v.object({
  timeLimit: v.optional(v.number()),
  allowLateJoins: v.boolean(),
  lateJoinFullTime: v.boolean(),
  proctoringLevel: v.union(
    v.literal("standard"),
    v.literal("aggressive"),
    v.literal("visibility")
  ),
  enforceLogin: v.boolean(),
  teacherPin: v.optional(v.string()),
});

export const create = mutation({
  args: {
    quizId: v.id("sharedQuizzes"),
    settings: examSettingsValidator,
    apiKey: v.optional(v.string()),
    questions: v.optional(
      v.array(
        v.object({
          id: v.string(),
          text: v.string(),
          type: v.union(v.literal("mcq"), v.literal("short"), v.literal("long")),
          body: v.optional(v.string()),
          options: v.optional(v.array(v.object({ text: v.string() }))),
        })
      )
    ),
    correctAnswers: v.optional(
      v.array(
        v.object({
          questionId: v.string(),
          correctOptions: v.array(v.number()),
        })
      )
    ),
    referenceAnswers: v.optional(
      v.array(
        v.object({
          questionId: v.string(),
          referenceAnswer: v.string(),
        })
      )
    ),
  },
  returns: v.object({
    id: v.id("examSessions"),
    roomCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getUser(ctx);

    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.creatorId !== user._id) {
      throw new ConvexError("Quiz not found or not owned by you");
    }

    const roomCode = await generateUniqueRoomCode(ctx, "examSessions", "by_roomCode");
    const now = Date.now();

    const id = await ctx.db.insert("examSessions", {
      creatorId: user._id,
      quizId: args.quizId,
      status: "lobby",
      settings: args.settings,
      roomCode,
      createdAt: now,
      apiKey: args.apiKey,
      extraTimeMs: 0,
      questions: args.questions,
      correctAnswers: args.correctAnswers,
      referenceAnswers: args.referenceAnswers,
    });

    return { id, roomCode };
  },
});

export const get = query({
  args: { examId: v.id("examSessions") },
  returns: v.union(
    v.object({
      _id: v.id("examSessions"),
      _creationTime: v.number(),
      creatorId: v.id("users"),
      quizId: v.id("sharedQuizzes"),
      status: v.union(
        v.literal("lobby"),
        v.literal("in_progress"),
        v.literal("paused"),
        v.literal("completed")
      ),
      settings: examSettingsValidator,
      roomCode: v.string(),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.examId);
  },
});

export const getByRoomCode = query({
  args: { roomCode: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("examSessions"),
      status: v.union(
        v.literal("lobby"),
        v.literal("in_progress"),
        v.literal("paused"),
        v.literal("completed")
      ),
      settings: v.object({
        timeLimit: v.optional(v.number()),
        allowLateJoins: v.boolean(),
        lateJoinFullTime: v.boolean(),
        proctoringLevel: v.union(
          v.literal("standard"),
          v.literal("aggressive"),
          v.literal("visibility")
        ),
        enforceLogin: v.boolean(),
      }),
      roomCode: v.string(),
      startedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const exam = await ctx.db
      .query("examSessions")
      .withIndex("by_roomCode", (q) => q.eq("roomCode", args.roomCode))
      .unique();

    if (!exam) return null;

    return {
      _id: exam._id,
      status: exam.status,
      settings: {
        timeLimit: exam.settings.timeLimit,
        allowLateJoins: exam.settings.allowLateJoins,
        lateJoinFullTime: exam.settings.lateJoinFullTime,
        proctoringLevel: exam.settings.proctoringLevel,
        enforceLogin: exam.settings.enforceLogin,
      },
      roomCode: exam.roomCode,
      startedAt: exam.startedAt,
    };
  },
});

export const start = mutation({
  args: { examId: v.id("examSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { exam } = await requireExamCreator(ctx, args.examId);

    if (exam.status !== "lobby") {
      throw new ConvexError("Exam can only be started from lobby state");
    }

    await ctx.db.patch(args.examId, {
      status: "in_progress",
      startedAt: Date.now(),
    });
    return null;
  },
});

export const pause = mutation({
  args: { examId: v.id("examSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { exam } = await requireExamCreator(ctx, args.examId);

    if (exam.status !== "in_progress") {
      throw new ConvexError("Can only pause an in-progress exam");
    }

    await ctx.db.patch(args.examId, { status: "paused" });
    return null;
  },
});

export const resume = mutation({
  args: { examId: v.id("examSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { exam } = await requireExamCreator(ctx, args.examId);

    if (exam.status !== "paused") {
      throw new ConvexError("Can only resume a paused exam");
    }

    await ctx.db.patch(args.examId, { status: "in_progress" });
    return null;
  },
});

export const end = mutation({
  args: { examId: v.id("examSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { exam } = await requireExamCreator(ctx, args.examId);

    if (exam.status === "completed") {
      throw new ConvexError("Exam is already completed");
    }

    await ctx.db.patch(args.examId, {
      status: "completed",
      endedAt: Date.now(),
    });
    return null;
  },
});

export const getActiveByQuizId = query({
  args: { quizId: v.id("sharedQuizzes") },
  returns: v.union(
    v.object({
      _id: v.id("examSessions"),
      roomCode: v.string(),
      status: v.union(
        v.literal("lobby"),
        v.literal("in_progress"),
        v.literal("paused"),
        v.literal("completed")
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("examSessions")
      .withIndex("by_quizId", (q) => q.eq("quizId", args.quizId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "lobby"),
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "paused")
        )
      )
      .first();

    if (!session) return null;
    return { _id: session._id, roomCode: session.roomCode, status: session.status };
  },
});

export const addExtraTime = mutation({
  args: {
    examId: v.id("examSessions"),
    extraMinutes: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { exam } = await requireExamCreator(ctx, args.examId);

    if (exam.status === "completed") {
      throw new ConvexError("Cannot add time to a completed exam");
    }
    if (!Number.isInteger(args.extraMinutes) || args.extraMinutes < 1 || args.extraMinutes > 120) {
      throw new ConvexError("Extra time must be a whole number between 1 and 120 minutes");
    }

    const current = exam.extraTimeMs ?? 0;
    await ctx.db.patch(args.examId, {
      extraTimeMs: current + args.extraMinutes * 60 * 1000,
    });
    return null;
  },
});

export const getForStudent = query({
  args: { examId: v.id("examSessions") },
  returns: v.union(
    v.object({
      _id: v.id("examSessions"),
      status: v.union(
        v.literal("lobby"),
        v.literal("in_progress"),
        v.literal("paused"),
        v.literal("completed")
      ),
      settings: v.object({
        timeLimit: v.optional(v.number()),
        allowLateJoins: v.boolean(),
        proctoringLevel: v.union(
          v.literal("standard"),
          v.literal("aggressive"),
          v.literal("visibility")
        ),
        enforceLogin: v.boolean(),
      }),
      roomCode: v.string(),
      startedAt: v.optional(v.number()),
      extraTimeMs: v.optional(v.number()),
      questions: v.optional(
        v.array(
          v.object({
            id: v.string(),
            text: v.string(),
            type: v.union(v.literal("mcq"), v.literal("short"), v.literal("long")),
            body: v.optional(v.string()),
            options: v.optional(v.array(v.object({ text: v.string() }))),
          })
        )
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId);
    if (!exam) return null;

    return {
      _id: exam._id,
      status: exam.status,
      settings: {
        timeLimit: exam.settings.timeLimit,
        allowLateJoins: exam.settings.allowLateJoins,
        proctoringLevel: exam.settings.proctoringLevel,
        enforceLogin: exam.settings.enforceLogin,
      },
      roomCode: exam.roomCode,
      startedAt: exam.startedAt,
      extraTimeMs: exam.extraTimeMs,
      questions: exam.questions,
    };
  },
});

export const getForTeacher = query({
  args: { examId: v.id("examSessions") },
  returns: v.union(
    v.object({
      _id: v.id("examSessions"),
      creatorId: v.id("users"),
      quizId: v.id("sharedQuizzes"),
      status: v.union(
        v.literal("lobby"),
        v.literal("in_progress"),
        v.literal("paused"),
        v.literal("completed")
      ),
      settings: examSettingsValidator,
      roomCode: v.string(),
      startedAt: v.optional(v.number()),
      endedAt: v.optional(v.number()),
      createdAt: v.number(),
      extraTimeMs: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId);
    if (!exam) return null;

    return {
      _id: exam._id,
      creatorId: exam.creatorId,
      quizId: exam.quizId,
      status: exam.status,
      settings: exam.settings,
      roomCode: exam.roomCode,
      startedAt: exam.startedAt,
      endedAt: exam.endedAt,
      createdAt: exam.createdAt,
      extraTimeMs: exam.extraTimeMs,
    };
  },
});
