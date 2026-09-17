import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// 1. Safely initialize Redis (Graceful fallback for Local/Preview environments)
const getRedisClient = () => {
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      return Redis.fromEnv();
    }
  } catch (e) {
    console.warn("Redis environment variables missing or invalid.");
  }
  return null;
};

const redis = getRedisClient();

// 2. Dedicated AI Rate Limiter (Strict: 5 requests per minute)
export const aiRateLimiter = redis ? new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "@upstash/ratelimit/ai",
}) : { limit: async () => ({ success: true }) }; // Bypass if Redis is not configured

// 3. Generic Rate Limiter (Restored for auth/sync-user and standard APIs)
export const enforceRateLimit = async (identifier?: any, ...args: any[]) => {
  if (!redis) return { success: true }; // Bypass if Redis is not configured
  
  let id = "anonymous_user";
  
  // Dynamically extract IP if a Next.js Request object is passed
  if (typeof identifier === "string") {
    id = identifier;
  } else if (identifier && typeof identifier.headers?.get === "function") {
    id = identifier.headers.get("x-forwarded-for") || "127.0.0.1";
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "10 s"), // Standard: 20 requests per 10 seconds
    prefix: "@upstash/ratelimit/generic",
  });

  return await limiter.limit(id);
};
