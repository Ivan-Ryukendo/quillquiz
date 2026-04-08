import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./helpers/auth";

export const getOrCreate = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.tokenIdentifier))
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("users", {
      name: identity.name ?? identity.email ?? "Anonymous",
      email: identity.email ?? "",
      authId: identity.tokenIdentifier,
      createdAt: Date.now(),
    });
  },
});

export const me = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.string(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.tokenIdentifier))
      .unique();

    if (!user) return null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  },
});
