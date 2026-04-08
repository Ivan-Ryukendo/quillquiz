import { query, mutation, internalQuery } from "./_generated/server";
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
