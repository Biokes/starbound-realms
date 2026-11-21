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

/**
 * Address-aware rate limiter for routes with :address param (#236).
 * Limits by wallet address in addition to IP, preventing a single address
 * from circumventing limits by changing IPs.
 * Defaults: 50 requests per minute per address.
 */
export const addressLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10)),
  max: parseInt(process.env.ADDRESS_RATE_LIMIT_MAX_REQUESTS ?? '50', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests for this address, please try again later.' },
  keyGenerator: (req) => {
    // Use the :address param if present, otherwise fall back to IP
    return req.params.address || req.ip || 'unknown';
  },
});
