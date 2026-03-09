// backend/middleware/security.js  (NEW FILE)

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');

// ── Helmet — secure HTTP headers ─────────────────────────────────────────────
const helmetMiddleware = helmet({
  contentSecurityPolicy: false, // Disabled — frontend is served separately
  crossOriginEmbedderPolicy: false,
});

// ── Rate limiters ─────────────────────────────────────────────────────────────

// Strict limiter for auth routes (login, register)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many attempts. Please try again in 15 minutes.',
    code: 'rate_limit_exceeded'
  },
  skipSuccessfulRequests: false,
});

// General API limiter — broad protection
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.',
    code: 'rate_limit_exceeded'
  },
  skipSuccessfulRequests: true,
});

// Export endpoint — more restrictive (ZIP generation is expensive)
const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Export limit reached. You can export up to 10 times per hour.',
    code: 'export_rate_limit_exceeded'
  },
});

// ── Account lockout ───────────────────────────────────────────────────────────
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Middleware to check if account is locked before login.
 * Apply to POST /api/auth/login BEFORE the auth controller.
 */
const checkAccountLockout = async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next();

  try {
    const result = await pool.query(
      `SELECT failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    if (!result.rows.length) return next(); // Unknown email — let auth handle it

    const user = result.rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil(
        (new Date(user.locked_until) - new Date()) / 60000
      );
      return res.status(423).json({
        error: `Account temporarily locked due to too many failed login attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
        code: 'account_locked',
        locked_until: user.locked_until
      });
    }

    next();
  } catch (error) {
    console.error('[checkAccountLockout] error:', error);
    next(); // Don't block login on DB error
  }
};

/**
 * Call this after a FAILED login attempt to increment counter + lock if needed.
 */
const recordFailedLogin = async (email) => {
  if (!email) return;
  try {
    await pool.query(
      `UPDATE users
       SET
         failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
         locked_until = CASE
           WHEN COALESCE(failed_login_attempts, 0) + 1 >= $1
           THEN NOW() + INTERVAL '${LOCKOUT_DURATION_MINUTES} minutes'
           ELSE locked_until
         END
       WHERE email = $2`,
      [MAX_FAILED_ATTEMPTS, email.toLowerCase().trim()]
    );
  } catch (err) {
    console.error('[recordFailedLogin] error:', err.message);
  }
};

/**
 * Call this after a SUCCESSFUL login to reset the counter.
 */
const resetFailedLogins = async (email) => {
  if (!email) return;
  try {
    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0, locked_until = NULL
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );
  } catch (err) {
    console.error('[resetFailedLogins] error:', err.message);
  }
};

module.exports = {
  helmetMiddleware,
  authRateLimiter,
  apiRateLimiter,
  exportRateLimiter,
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLogins,
};
