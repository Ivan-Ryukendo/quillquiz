import { query, mutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { requireExamCreator } from "./helpers/auth";

export const submit = mutation({
  args: {
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
    questionId: v.string(),
    selectedOptions: v.optional(v.array(v.number())),
    textAnswer: v.optional(v.string()),
  },
  returns: v.id("examAnswers"),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId);
    if (!exam || exam.status !== "in_progress") {
      throw new ConvexError("Exam is not in progress");
    }

    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.examId !== args.examId) {
      throw new ConvexError("Participant not found in this exam");
    }
    if (participant.status === "kicked" || participant.status === "completed") {
      throw new ConvexError("Cannot submit answers in current state");
    }

    const now = Date.now();
    if (exam.startedAt && exam.settings.timeLimit) {
      const examEnd = exam.startedAt + exam.settings.timeLimit;
      if (now > examEnd + 5000) {
        throw new ConvexError("Time is up");
      }
    }

    const existing = await ctx.db
      .query("examAnswers")
      .withIndex("by_examId_and_participantId", (q) =>
        q.eq("examId", args.examId).eq("participantId", args.participantId)
      )
      .take(500);

    const duplicate = existing.find((a) => a.questionId === args.questionId);
    if (duplicate) {
      throw new ConvexError("Answer already submitted for this question");
    }

    if (args.textAnswer && args.textAnswer.length > 5000) {
      throw new ConvexError("Answer exceeds maximum length of 5000 characters");
    }

    return await ctx.db.insert("examAnswers", {
      examId: args.examId,
      participantId: args.participantId,
      questionId: args.questionId,
      selectedOptions: args.selectedOptions,
      textAnswer: args.textAnswer,
      submittedAt: now,
    });
  },
});

export const listByParticipant = query({
  args: {
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
  },
  returns: v.array(
    v.object({
      _id: v.id("examAnswers"),
      questionId: v.string(),
      selectedOptions: v.optional(v.array(v.number())),
      textAnswer: v.optional(v.string()),
      submittedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_examId_and_participantId", (q) =>
        q.eq("examId", args.examId).eq("participantId", args.participantId)
      )
      .take(500);

    return answers.map((a) => ({
      _id: a._id,
      questionId: a.questionId,
      selectedOptions: a.selectedOptions,
      textAnswer: a.textAnswer,
      submittedAt: a.submittedAt,
    }));
  },
});

export const listAllForExam = query({
  args: { examId: v.id("examSessions") },
  returns: v.array(
    v.object({
      _id: v.id("examAnswers"),
      participantId: v.id("examParticipants"),
      questionId: v.string(),
      selectedOptions: v.optional(v.array(v.number())),
      textAnswer: v.optional(v.string()),
      submittedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    await requireExamCreator(ctx, args.examId);

    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(500);

    return answers.map((a) => ({
      _id: a._id,
      participantId: a.participantId,
      questionId: a.questionId,
      selectedOptions: a.selectedOptions,
      textAnswer: a.textAnswer,
      submittedAt: a.submittedAt,
    }));
  },
});

// INTERNAL: server-side grading only — never exposed to clients
export const getAnswersForGrading = internalQuery({
  args: { examId: v.id("examSessions") },
  returns: v.object({
    answers: v.array(
      v.object({
        _id: v.id("examAnswers"),
        participantId: v.id("examParticipants"),
        questionId: v.string(),
        selectedOptions: v.optional(v.array(v.number())),
        textAnswer: v.optional(v.string()),
      })
    ),
    quizMarkdown: v.string(),
  }),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId);
    if (!exam) throw new ConvexError("Exam not found");

    const quiz = await ctx.db.get(exam.quizId);
    if (!quiz) throw new ConvexError("Quiz not found");

    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_examId", (q) => q.eq("examId", args.examId))
      .take(500);

    return {
      answers: answers.map((a) => ({
        _id: a._id,
        participantId: a.participantId,
        questionId: a.questionId,
        selectedOptions: a.selectedOptions,
        textAnswer: a.textAnswer,
      })),
      quizMarkdown: quiz.markdown,
    };
  },
});

export const submitBatch = mutation({
  args: {
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        selectedOptions: v.optional(v.array(v.number())),
        textAnswer: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId);
    if (!exam || exam.status !== "in_progress") {
      throw new ConvexError("Exam is not in progress");
    }

    const participant = await ctx.db.get(args.participantId);
    if (!participant || participant.examId !== args.examId) {
      throw new ConvexError("Participant not found in this exam");
    }
    if (participant.status === "kicked" || participant.status === "completed") {
      throw new ConvexError("Cannot submit answers in current state");
    }

    if (args.answers.length === 0) return null;

    const now = Date.now();
    const totalTimeMs =
      (exam.settings.timeLimit ?? 0) + (exam.extraTimeMs ?? 0);
    if (exam.startedAt && exam.settings.timeLimit) {
      if (now > exam.startedAt + totalTimeMs + 5000) {
        throw new ConvexError("Time is up");
      }
    }

    const existing = await ctx.db
      .query("examAnswers")
      .withIndex("by_examId_and_participantId", (q) =>
        q.eq("examId", args.examId).eq("participantId", args.participantId)
      )
      .take(500);

    const submittedIds = new Set(existing.map((a) => a.questionId));
    const correctAnswers = exam.correctAnswers ?? [];

    for (const answer of args.answers) {
      if (submittedIds.has(answer.questionId)) continue;

      const textAnswer = answer.textAnswer
        ? answer.textAnswer.slice(0, 5000)
        : undefined;

      let isCorrect: boolean | undefined = undefined;
      if (answer.selectedOptions !== undefined) {
        const ca = correctAnswers.find(
          (c) => c.questionId === answer.questionId
        );
        if (ca) {
          const correct = [...ca.correctOptions].sort().join(",");
          const student = [...answer.selectedOptions].sort().join(",");
          isCorrect = correct === student;
        }
      }

      await ctx.db.insert("examAnswers", {
        examId: args.examId,
        participantId: args.participantId,
        questionId: answer.questionId,
        selectedOptions: answer.selectedOptions,
        textAnswer,
        submittedAt: now,
        isCorrect,
      });
    }

    await ctx.db.patch(args.participantId, { status: "completed" });

    if (exam.apiKey) {
      await ctx.scheduler.runAfter(0, internal.examGrading.gradeExam, {
        examId: args.examId,
        participantId: args.participantId,
      });
    }

    return null;
  },
});

export const getGradesForParticipant = query({
  args: {
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
  },
  returns: v.array(
    v.object({
      _id: v.id("examAnswers"),
      questionId: v.string(),
      selectedOptions: v.optional(v.array(v.number())),
      textAnswer: v.optional(v.string()),
      submittedAt: v.number(),
      isCorrect: v.optional(v.boolean()),
      aiScore: v.optional(v.number()),
      aiFeedback: v.optional(v.string()),
      keyMissing: v.optional(v.array(v.string())),
      gradedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_examId_and_participantId", (q) =>
        q.eq("examId", args.examId).eq("participantId", args.participantId)
      )
      .take(500);

    return answers.map((a) => ({
      _id: a._id,
      questionId: a.questionId,
      selectedOptions: a.selectedOptions,
      textAnswer: a.textAnswer,
      submittedAt: a.submittedAt,
      isCorrect: a.isCorrect,
      aiScore: a.aiScore,
      aiFeedback: a.aiFeedback,
      keyMissing: a.keyMissing,
      gradedAt: a.gradedAt,
    }));
  },
});
