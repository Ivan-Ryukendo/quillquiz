import { MutationCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

interface RateLimitConfig {
  key: string;
  maxAttempts: number;
  windowMs: number;
}

export async function checkRateLimit(
  ctx: MutationCtx,
  config: RateLimitConfig
): Promise<void> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", config.key))
    .unique();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key: config.key,
      count: 1,
      windowStart: now,
    });
    return;
  }

  const windowExpired = now - existing.windowStart > config.windowMs;

  if (windowExpired) {
    await ctx.db.patch(existing._id, {
      count: 1,
      windowStart: now,
    });
    return;
  }

  if (existing.count >= config.maxAttempts) {
    throw new ConvexError(
      `Rate limit exceeded. Try again in ${Math.ceil(
        (config.windowMs - (now - existing.windowStart)) / 1000
      )} seconds.`
    );
  }

  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
  });
}

export async function checkJoinRateLimit(
  ctx: MutationCtx,
  ip: string
): Promise<void> {
  await checkRateLimit(ctx, {
    key: `join:${ip}`,
    maxAttempts: 10,
    windowMs: 60_000,
  });

  const failKey = `join_fail:${ip}`;
  const failRecord = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", failKey))
    .unique();

  if (failRecord) {
    const blockExpired = Date.now() - failRecord.windowStart > 15 * 60_000;
    if (!blockExpired && failRecord.count >= 5) {
      throw new ConvexError(
        "Too many failed join attempts. Blocked for 15 minutes."
      );
    }
  }
}

export async function recordFailedJoin(
  ctx: MutationCtx,
  ip: string
): Promise<void> {
  await checkRateLimit(ctx, {
    key: `join_fail:${ip}`,
    maxAttempts: 999,
    windowMs: 15 * 60_000,
  });
}

export async function checkShareRateLimit(
  ctx: MutationCtx,
  userId: string
): Promise<void> {
  await checkRateLimit(ctx, {
    key: `share:${userId}`,
    maxAttempts: 10,
    windowMs: 60 * 60_000,
  });
}
