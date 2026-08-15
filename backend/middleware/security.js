// backend/middleware/security.js  (NEW FILE)

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');

// ── Helmet — secure HTTP headers ─────────────────────────────────────────────
//
// CSP was disabled outright on the grounds that this is a JSON API and the SPA
// is hosted separately. The first half of that is the reason to HAVE a policy,
// not to omit one: this service returns JSON and image bytes and never HTML, so
// it can commit to the strictest possible policy without any risk of breaking a
// page — nothing it serves is supposed to load a script, a frame or a font.
//
// The policy that matters for the application's own pages still belongs to
// whatever serves the frontend bundle; this one only covers responses from the
// API, and closes the gap where a stored file or an error page could be framed
// or used as a script source.
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'none'"],
      'form-action': ["'none'"],
      'img-src': ["'self'"], // the authenticated training-image endpoint
    },
  },
  // A pure API is never meant to be framed, so refuse outright rather than
  // allowing same-origin framing.
  frameguard: { action: 'deny' },
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
//
// `skipSuccessfulRequests` was true, which meant this limiter only ever counted
// requests that FAILED. Active testing confirmed the consequence: 210
// successful reads of an expensive endpoint in one burst were all served, with
// the limiter never engaging. Anyone with a valid token could pull data or
// drive expensive statistics queries without limit, and the only traffic being
// restrained was traffic the application had already rejected.
//
// This is the same defect that made the password-reset endpoint unlimited
// (TR-MED-1): a limiter whose counting rule excludes the requests that matter.
// Every request now counts, and the allowance is raised so ordinary bursty use
// — a dashboard view firing several requests at once — stays comfortable.
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.',
    code: 'rate_limit_exceeded'
  },
  skipSuccessfulRequests: false,
});

// ── Password-reset limiters (Phase 2B / TR-MED-1) ────────────────────────────
//
// POST /api/auth/forgot-password previously had no effective limit at all. It
// was covered only by apiRateLimiter, which is configured with
// `skipSuccessfulRequests: true` — and the handler deliberately answers 200 on
// every path (including unknown emails and its own catch block) so it cannot be
// used to enumerate accounts. Every response therefore "succeeded" and nothing
// was ever counted, leaving an unauthenticated endpoint that sends an email per
// call: free mail-bombing of any address, at the account's own Brevo expense.
//
// Two limiters, because one key is not enough:
//   - per IP    stops one attacker cycling through many victim addresses
//   - per email stops many IPs (or a botnet) flooding a single victim
// Both are needed; either alone leaves the other attack open.

const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const passwordResetIpRateLimiter = rateLimit({
  windowMs: PASSWORD_RESET_WINDOW_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Count every request. Not counting successes is what made the original
  // limiter inert on an endpoint that always returns 200.
  skipSuccessfulRequests: false,
  message: {
    error: 'Too many password reset requests. Please try again later.',
    code: 'rate_limit_exceeded',
  },
});

const passwordResetEmailRateLimiter = rateLimit({
  windowMs: PASSWORD_RESET_WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  // Key on the target address so a victim cannot be flooded from many sources.
  // The bucket exists whether or not the address is registered, so a 429 says
  // nothing about whether an account exists.
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.toLowerCase().trim()
      : '';
    return email ? `email:${email}` : `ip:${req.ip}`;
  },
  message: {
    error: 'Too many password reset requests for this address. Please try again later.',
    code: 'rate_limit_exceeded',
  },
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

// ── Upload limiter (Phase 3) ─────────────────────────────────────────────────
//
// Uploads were covered only by the general /api limiter (200/min), but they are
// not general requests: each one may carry 10 files of 10MB, so that allowance
// is ~200GB/hour of writes to the server's disk from a single authenticated
// account. Storage is not quota'd per tenant, so filling the volume is a
// denial of service against every tenant at once.
//
// Keyed by user rather than by IP: these routes are authenticated, so the
// account is the meaningful identity, and it cannot be changed by spoofing a
// header. The IP is used only as a fallback if the key is somehow missing.
const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: (req) => (req.user?.userId ? `user:${req.user.userId}` : `ip:${req.ip}`),
  // Only the write path is limited; listing and fetching images are ordinary
  // reads already covered by the general limiter.
  skip: (req) => req.method !== 'POST',
  message: {
    error: 'Upload limit reached. Please try again later.',
    code: 'upload_rate_limit_exceeded',
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
  passwordResetIpRateLimiter,
  passwordResetEmailRateLimiter,
  uploadRateLimiter,
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLogins,
};
