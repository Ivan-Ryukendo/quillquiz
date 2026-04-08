import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.string(),
    email: v.string(),
    authId: v.string(),
    createdAt: v.number(),
  })
    .index("by_authId", ["authId"])
    .index("by_email", ["email"]),

  sharedQuizzes: defineTable({
    creatorId: v.id("users"),
    markdown: v.string(),
    metadata: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
    shareCode: v.string(),
    pin: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_shareCode", ["shareCode"])
    .index("by_creatorId", ["creatorId"])
    .index("by_expiresAt", ["expiresAt"]),

  examSessions: defineTable({
    creatorId: v.id("users"),
    quizId: v.id("sharedQuizzes"),
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
      teacherPin: v.optional(v.string()),
    }),
    roomCode: v.string(),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_roomCode", ["roomCode"])
    .index("by_creatorId", ["creatorId"])
    .index("by_status", ["status"]),

  examParticipants: defineTable({
    examId: v.id("examSessions"),
    name: v.string(),
    userId: v.optional(v.id("users")),
    connectionId: v.string(),
    browserFingerprint: v.string(),
    status: v.union(
      v.literal("waiting"),
      v.literal("ready"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("kicked")
    ),
    joinedAt: v.number(),
    kickReason: v.optional(v.string()),
    flags: v.array(
      v.object({
        type: v.string(),
        timestamp: v.number(),
        details: v.string(),
      })
    ),
  })
    .index("by_examId", ["examId"])
    .index("by_examId_and_status", ["examId", "status"])
    .index("by_examId_and_connectionId", ["examId", "connectionId"])
    .index("by_examId_and_userId", ["examId", "userId"]),

  examAnswers: defineTable({
    examId: v.id("examSessions"),
    participantId: v.id("examParticipants"),
    questionId: v.string(),
    selectedOptions: v.optional(v.array(v.number())),
    textAnswer: v.optional(v.string()),
    submittedAt: v.number(),
  })
    .index("by_examId", ["examId"])
    .index("by_participantId", ["participantId"])
    .index("by_examId_and_questionId", ["examId", "questionId"])
    .index("by_examId_and_participantId", ["examId", "participantId"]),

  examMessages: defineTable({
    examId: v.id("examSessions"),
    senderId: v.id("users"),
    message: v.string(),
    sentAt: v.number(),
  }).index("by_examId", ["examId"]),

  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index("by_key", ["key"]),
});
