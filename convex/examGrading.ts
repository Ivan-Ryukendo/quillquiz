import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { gradeWithGemini, gradeWithOpenRouter } from "./helpers/grade";
import type { GradeItem } from "./helpers/grade";

export const getDataForGrading = internalQuery({
  args: {
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
  },
  returns: v.object({
    apiKey: v.union(v.string(), v.null()),
    textAnswers: v.array(
      v.object({
        answerId: v.id("examAnswers"),
        questionId: v.string(),
        textAnswer: v.string(),
      })
    ),
    referenceAnswers: v.array(
      v.object({
        questionId: v.string(),
        referenceAnswer: v.string(),
        question: v.string(),
        type: v.union(v.literal("short"), v.literal("long")),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const exam = await ctx.db.get(args.examId);
    if (!exam) return { apiKey: null, textAnswers: [], referenceAnswers: [] };

    const answers = await ctx.db
      .query("examAnswers")
      .withIndex("by_examId_and_participantId", (q) =>
        q.eq("examId", args.examId).eq("participantId", args.participantId)
      )
      .take(500);

    const textAnswers = answers
      .filter((a) => a.textAnswer && a.aiScore === undefined)
      .map((a) => ({
        answerId: a._id,
        questionId: a.questionId,
        textAnswer: a.textAnswer!,
      }));

    const refAnswers = (exam.referenceAnswers ?? [])
      .filter((ra) => textAnswers.some((ta) => ta.questionId === ra.questionId))
      .map((ra) => {
        const q = (exam.questions ?? []).find((q) => q.id === ra.questionId);
        return {
          questionId: ra.questionId,
          referenceAnswer: ra.referenceAnswer,
          question: q?.text ?? ra.questionId,
          type: (q?.type ?? "short") as "short" | "long",
        };
      });

    return {
      apiKey: exam.apiKey ?? null,
      textAnswers,
      referenceAnswers: refAnswers,
    };
  },
});

export const applyGrades = internalMutation({
  args: {
    grades: v.array(
      v.object({
        answerId: v.id("examAnswers"),
        score: v.number(),
        feedback: v.string(),
        keyMissing: v.array(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const grade of args.grades) {
      await ctx.db.patch(grade.answerId, {
        aiScore: grade.score,
        aiFeedback: grade.feedback,
        keyMissing: grade.keyMissing,
        gradedAt: now,
      });
    }
    return null;
  },
});

export const gradeExam = internalAction({
  args: {
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data = await ctx.runQuery(internal.examGrading.getDataForGrading, {
      examId: args.examId,
      participantId: args.participantId,
    });

    if (!data.apiKey || data.textAnswers.length === 0) return null;

    const items: GradeItem[] = data.textAnswers
      .map((ta) => {
        const ref = data.referenceAnswers.find(
          (ra) => ra.questionId === ta.questionId
        );
        if (!ref) return null;
        return {
          questionId: ta.questionId,
          question: ref.question,
          referenceAnswer: ref.referenceAnswer,
          textAnswer: ta.textAnswer,
          type: ref.type,
        };
      })
      .filter((item): item is GradeItem => item !== null);

    if (items.length === 0) return null;

    try {
      const results = data.apiKey.startsWith("AIza")
        ? await gradeWithGemini(data.apiKey, items)
        : await gradeWithOpenRouter(data.apiKey, items);

      const grades = results.map((r) => {
        const ta = data.textAnswers.find((a) => a.questionId === r.questionId);
        return {
          answerId: ta!.answerId,
          score: r.score,
          feedback: r.feedback,
          keyMissing: r.keyMissing,
        };
      });

      await ctx.runMutation(internal.examGrading.applyGrades, { grades });
    } catch (err) {
      console.error("gradeExam action failed:", err);
    }

    return null;
  },
});
