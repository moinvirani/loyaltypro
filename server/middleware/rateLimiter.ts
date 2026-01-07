import type { Request, Response, NextFunction } from 'express';

/**
 * In-memory store for rate limiting
 * Maps IP addresses to their request count and reset time
 */
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

/**
 * Clean up old entries every hour to prevent memory leaks
 * Removes entries where resetAt time has passed
 */
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  });
}, 60 * 60 * 1000);

/**
 * Create a rate limiter middleware
 *
 * @param options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param options.maxRequests - Maximum number of requests allowed in the window
 * @returns Express middleware function
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Use IP address as identifier
    // In production behind a proxy, use X-Forwarded-For header
    const identifier = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown';

    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[identifier] || store[identifier].resetAt < now) {
      store[identifier] = {
        count: 1,
        resetAt: now + options.windowMs,
      };
      return next();
    }

    // Increment counter
    store[identifier].count++;

    // Check if limit exceeded
    if (store[identifier].count > options.maxRequests) {
      const retryAfter = Math.ceil((store[identifier].resetAt - now) / 1000);

      console.warn(`⚠️ Rate limit exceeded for ${identifier}: ${store[identifier].count} requests`);

      return res.status(429).json({
        error: 'Too many requests',
        message: `You have exceeded the rate limit. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      });
    }

    // Allow request
    next();
  };
}
