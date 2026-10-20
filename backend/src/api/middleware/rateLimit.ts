import rateLimit from 'express-rate-limit';

/**
 * Standard rate limiter — configurable via env vars (#136).
 * Defaults: 100 requests per minute per IP.
 */
export const standardLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10)),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Strict rate limiter for heavy endpoints like leaderboard (#136).
 * Defaults: 10 requests per minute per IP.
 */
export const strictLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10)),
  max: parseInt(process.env.STRICT_RATE_LIMIT_MAX_REQUESTS ?? '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
