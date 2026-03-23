import type { Request, Response, NextFunction } from "express";

// Simple in-memory rate limiter per user ID
// For a production app, use Redis or express-rate-limit package.
interface RateLimitData {
  count: number;
  resetTime: number;
}

const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS = 30;     // maximum 30 requests per minute

const userStore = new Map<string, RateLimitData>();

// Garbage clean up to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of userStore.entries()) {
    if (now > data.resetTime) {
      userStore.delete(key);
    }
  }
}, WINDOW_MS * 5); // Clean up every 5 minutes

export function RateLimiter(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;

  // Skip if no user ID (e.g. auth routes)
  if (!userId) {
    return next();
  }

  const now = Date.now();
  let data = userStore.get(userId);

  if (!data) {
    // First request
    userStore.set(userId, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  if (now > data.resetTime) {
    // Window expired, reset tracker
    data.count = 1;
    data.resetTime = now + WINDOW_MS;
    userStore.set(userId, data);
    return next();
  }

  data.count++;
  if (data.count > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: "Rate limit hit. Too many requests, please try again later.",
      retryAfter: Math.ceil((data.resetTime - now) / 1000)
    });
  }

  userStore.set(userId, data);
  next();
}
