const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');
const sessionsRoutes = require('./routes/sessions');
const trainingLogsRoutes = require('./routes/trainingLogs');
const subscriptionRoutes = require('./routes/subscriptions');
const { router: packagesRoutes, clientRouter: clientPackagesRoutes } = require('./routes/packages');
// Phase 2 routes
const exercisesRouter = require('./routes/exercises');
const dpaRoutes = require('./routes/dpa');
const profileRoutes = require('./routes/profile');
const exportRoutes = require('./routes/export');
const deletionRoutes = require('./routes/deletion');
const adminRoutes = require('./routes/admin');
const metricsRoutes = require('./routes/metrics');
const consentRoutes = require('./routes/consent');
const { requireDpa } = require('./middleware/requireDpa');
const { auditLogMiddleware, auditFailedLogin } = require('./middleware/auditLog');
const {
  helmetMiddleware, authRateLimiter, apiRateLimiter, exportRateLimiter, checkAccountLockout,
  passwordResetIpRateLimiter, passwordResetEmailRateLimiter, uploadRateLimiter,
  pageViewRateLimiter,
} = require('./middleware/security');
const { authenticateToken } = require('./middleware/auth');
const { runWithTenantContext } = require('./config/tenantContext');
const trainingsRouter = require('./routes/trainings');
const templatesRouter = require('./routes/templates');
const uploadsRouter   = require('./routes/uploads');
const dashboardRoutes = require('./routes/dashboard');
const groupsRoutes = require('./routes/groups');
const progressRoutes = require('./routes/progress');
const { clientRouter: paymentClientRouter, billingRouter } = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Core middleware ───────────────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://treniko.com',
      'https://www.treniko.com',
    ];
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowed.includes(origin)) return callback(null, true);

    // The rejected origin is attacker-controlled input. It used to be
    // interpolated into the error message, which the global handler then echoed
    // back in the response body — a reflection of caller input, and a 500 for
    // what is a routine policy decision. Log it, answer 403, echo nothing.
    console.warn(`[CORS] rejected origin: ${origin}`);
    const err = new Error('Origin not allowed');
    err.status = 403;
    err.expose = true;
    callback(err);
  },
  credentials: true,
}));
app.set('trust proxy', 1);
// Body-size caps. These match Express's own defaults; they are stated
// explicitly so the limit is a deliberate, reviewable decision rather than an
// implicit one, and so raising it later has to be argued for.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Request logging (development only) ───────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// ── Security / rate limiting / subscription middleware ────────────────────────
const { checkReadOnlyMode, checkSessionLimit, checkFeatureAccess } = require('./middleware/subscription');

// Paths under /api that must stay reachable without a token. Everything else
// below the authentication gate requires a valid JWT. Values are paths as seen
// *inside* the '/api' mount (Express strips the mount prefix from req.path).
const PUBLIC_API_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  // Migration 035. The anonymous page-view counter fires on public marketing
  // routes, before anybody has an account — requiring a token would mean
  // counting only people who already registered, which is the opposite of what
  // a signup funnel needs to measure.
  '/metrics/view',
]);
const isPublicApiPath = (req) => PUBLIC_API_PATHS.has(req.path);

// Wrap a middleware so it is skipped for the public auth endpoints. Used for
// the subscription checks, which are meaningless (and must not 401) on the
// routes a user calls before they have a token.
const skipPublicPaths = (middleware) => (req, res, next) =>
  isPublicApiPath(req) ? next() : middleware(req, res, next);

app.use('/api', apiRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/login', checkAccountLockout);
app.use('/api/auth/register', authRateLimiter);
// The one endpoint where an unauthenticated caller can cause rows to be
// written. Tighter than the general /api allowance — see middleware/security.js.
app.use('/api/metrics/view', pageViewRateLimiter);
// Password reset: unauthenticated, and every call sends an email. Limited per
// IP and per target address (TR-MED-1). Mounted here so the limiters run before
// the router — express.json() above has already parsed the body the per-email
// key is derived from.
app.use('/api/auth/forgot-password', passwordResetIpRateLimiter, passwordResetEmailRateLimiter);
app.use('/api/auth/reset-password', passwordResetIpRateLimiter);
app.use('/api/export', exportRateLimiter);
app.use('/api', auditLogMiddleware);
app.use('/api/auth/login', auditFailedLogin);

// ── Platform administration ───────────────────────────────────────────────────
// Mounted deliberately ABOVE the trainer authentication gate and above the
// tenant-context middleware.
//
// Above the gate, because administrators are not trainers: they authenticate
// against platform_admins with their own token realm (middleware/adminAuth.js),
// and must not need a trainer account to sign in.
//
// Above the tenant context, because that is what makes the admin surface safe.
// No tenant context is ever established for these requests, so under the
// NOBYPASSRLS `treniko_app` role every RLS-protected table — clients, sessions,
// payments, training logs, progress — returns zero rows here. Platform staff
// see tenants, trainers, subscriptions and usage counts; they cannot read a
// trainer's clients. That boundary is enforced by PostgreSQL, not by care.
//
// Rate limiting and the request audit log are already mounted on '/api' above.
// ── Anonymous page views ──────────────────────────────────────────────────────
// Mounted above the trainer authentication gate, for the same structural reason
// the admin routes are: this request has no token and never will. It reads
// nothing, returns nothing, establishes no tenant context, and writes one row
// containing no personal data.
app.use('/api/metrics', metricsRoutes);

app.use('/api/admin', adminRoutes);

// ── Authentication gate ───────────────────────────────────────────────────────
// MUST stay above the subscription checks below. Those middlewares read
// req.user, and previously ran before any authenticateToken (which was applied
// per-router, further down), so req.user was always undefined and every plan
// limit, read-only lock and feature gate silently passed. Authenticating here
// means req.user is populated by the time they execute.
// Individual routers still apply authenticateToken themselves; that is
// harmless (re-verifying the same token) and keeps them safe in isolation.
app.use('/api', (req, res, next) =>
  isPublicApiPath(req) ? next() : authenticateToken(req, res, next)
);

// ── Database tenant context (Phase 4) ─────────────────────────────────────────
// Establishes the tenant context that PostgreSQL's row-level security policies
// read, for the remainder of this request. It runs immediately after
// authentication and takes its values ONLY from req.user — the verified JWT.
// A tenant id in a body, query string or route parameter has no path to this
// call, which is what makes the database boundary independent of the request.
app.use('/api', (req, res, next) => {
  if (!req.user) return next();
  return runWithTenantContext(
    { tenantId: req.user.tenantId, userId: req.user.userId },
    next
  );
});

app.use('/api', skipPublicPaths(checkReadOnlyMode));
// checkClientLimit is deliberately NOT mounted here. Mounted on '/api' it
// matched by path substring and fired on every POST under a client — payments,
// package assignment, consent — locking a capped trainer out of their existing
// book. It now guards only POST /api/clients, in routes/clients.js.
app.use('/api', skipPublicPaths(checkSessionLimit));

// ── Auth & profile ────────────────────────────────────────────────────────────
app.use('/api/auth', dpaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);

// ── Clients & related sub-routes ──────────────────────────────────────────────
app.use('/api/clients/:id/consent', consentRoutes);
app.use('/api/clients/:clientId', clientPackagesRoutes);       // packages sub-router
app.use('/api/clients/:clientId/payments', paymentClientRouter); // payments sub-router
app.use('/api/clients', authenticateToken, requireDpa, clientsRoutes);

// ── Billing overview ──────────────────────────────────────────────────────────
app.use('/api/billing', billingRouter);

// ── Packages (templates) ──────────────────────────────────────────────────────
app.use('/api/packages', packagesRoutes);

// ── Sessions ──────────────────────────────────────────────────────────────────
app.use('/api/sessions', authenticateToken, requireDpa, sessionsRoutes);

// ── Training logs ─────────────────────────────────────────────────────────────
app.use('/api/training-logs', checkFeatureAccess('training_logs'), trainingLogsRoutes);

// ── Subscriptions ─────────────────────────────────────────────────────────────
app.use('/api/subscriptions', subscriptionRoutes);

// ── Groups ────────────────────────────────────────────────────────────────────
app.use('/api/groups', authenticateToken, groupsRoutes);

// ── Progress ──────────────────────────────────────────────────────────────────
app.use('/api/progress', authenticateToken, progressRoutes);

// ── Phase 2 routes ────────────────────────────────────────────────────────────
app.use('/api/exercises', exercisesRouter);
app.use('/api/trainings', trainingsRouter);
app.use('/api/templates', templatesRouter);
// The upload limiter is mounted on the router, after the authentication gate
// above, so it can key on the authenticated user rather than a spoofable header.
app.use('/api/trainings', uploadRateLimiter, uploadsRouter);
// NOTE: the previous `app.use('/uploads', express.static(...))` mount was
// removed. It served every tenant's uploaded client photos to any caller who
// had a URL, with no authentication and no ownership check. Files are now
// served only via GET /api/trainings/:trainingId/images/:filename in
// routes/uploads.js, which requires a valid JWT, verifies the caller owns the
// parent training, and resolves the tenant directory from the token.

// ── Export & deletion ─────────────────────────────────────────────────────────
//
// The export endpoints are NOT behind checkFeatureAccess('export'), and must
// not be. /api/export is how a trainer — and, through them, their clients —
// exercises data portability (GDPR Art. 20) and gets their own records out of
// the product. Gating it on the plan meant every trainer on the Free plan, i.e.
// every new signup and every beta tester, got 403 from the "Export data" button
// in the profile menu.
//
// `has_export` on subscription_plans still governs the *analytics* exports if
// those are ever built; it does not govern a person's access to their own data.
app.use('/api/export', exportRoutes);
app.use('/api', deletionRoutes);

// ── Dashboard ─────────────────────────────────────────────────────────────────
app.use('/api/dashboard', dashboardRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist'
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Always log the full error server-side.
  console.error('Error:', err);

  if (res.headersSent) return next(err);

  // Previously the raw `err.message` was returned to the caller in every
  // environment. Anything that reached this handler — a driver error, a
  // filesystem path, a third-party API's response body — was disclosed
  // verbatim. Client errors (4xx) that the application raised deliberately are
  // still described, because that text is written for the caller; everything
  // else gets a generic message and detail is kept in the logs.
  const clientSafe = status < 500 && err.expose !== false && typeof err.message === 'string';

  res.status(status).json({
    error: clientSafe ? err.message : 'Internal Server Error',
    ...(isDevelopment && { message: err.message, stack: err.stack }),
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
// Only bind the port and schedule background jobs when this file is executed
// directly (`node server.js` / `npm start`). Importing the app — as the
// security test suite does — must not open a listener or kick off the deletion
// job, which runs immediately on load and permanently removes records.
const isMain = require.main === module;

if (isMain) {
// ── Last-resort crash guard ───────────────────────────────────────────────────
// Express 4 does not catch rejections thrown by an async route handler, and
// Node terminates the process on an unhandled rejection. That turns any single
// unguarded `await` into a remote kill switch: one request with a malformed id
// used to stop the API outright (verified — the process exited with code 1).
//
// Every known path is fixed at the source; every await in a handler now sits
// inside its own try/catch. This is the net beneath that work, not a substitute
// for it: an unknown path must degrade to one stuck request and a loud log
// entry, never to an outage. The request is deliberately left unanswered rather
// than guessed at, because at this point the handler's state is unknown.
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION — request left unanswered, process kept alive:', reason);
});

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║     TRENIKO Backend Server Started    ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(33)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(24)}║
║  URL: http://localhost:${PORT.toString().padEnd(19)}║
╚════════════════════════════════════════╝
  `);
  console.log('✅ Server is ready to accept requests\n');

  // Report whether the row-level security policies added by migration 029 are
  // actually being applied to the role we connected as. They are skipped for a
  // table's owner and for BYPASSRLS roles, and nothing in the application's
  // behaviour would reveal that — see config/rlsStatus.js.
  require('./config/rlsStatus').reportRlsStatus();
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  app.close(() => {
    console.log('HTTP server closed');
  });
});

require('./cron');
} // end if (isMain)

module.exports = app;