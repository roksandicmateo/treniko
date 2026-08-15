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
const consentRoutes = require('./routes/consent');
const { requireDpa } = require('./middleware/requireDpa');
const { auditLogMiddleware, auditFailedLogin } = require('./middleware/auditLog');
const { helmetMiddleware, authRateLimiter, apiRateLimiter, exportRateLimiter, checkAccountLockout } = require('./middleware/security');
const { authenticateToken } = require('./middleware/auth');
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
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const { checkReadOnlyMode, checkClientLimit, checkSessionLimit, checkFeatureAccess } = require('./middleware/subscription');

// Paths under /api that must stay reachable without a token. Everything else
// below the authentication gate requires a valid JWT. Values are paths as seen
// *inside* the '/api' mount (Express strips the mount prefix from req.path).
const PUBLIC_API_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
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
app.use('/api/export', exportRateLimiter);
app.use('/api', auditLogMiddleware);
app.use('/api/auth/login', auditFailedLogin);

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

app.use('/api', skipPublicPaths(checkReadOnlyMode));
app.use('/api', skipPublicPaths(checkClientLimit));
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
app.use('/api/trainings', uploadsRouter);
// NOTE: the previous `app.use('/uploads', express.static(...))` mount was
// removed. It served every tenant's uploaded client photos to any caller who
// had a URL, with no authentication and no ownership check. Files are now
// served only via GET /api/trainings/:trainingId/images/:filename in
// routes/uploads.js, which requires a valid JWT, verifies the caller owns the
// parent training, and resolves the tenant directory from the token.

// ── Export & deletion ─────────────────────────────────────────────────────────
app.use('/api/export', checkFeatureAccess('export'), exportRoutes);
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
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
// Only bind the port and schedule background jobs when this file is executed
// directly (`node server.js` / `npm start`). Importing the app — as the
// security test suite does — must not open a listener or kick off the deletion
// job, which runs immediately on load and permanently removes records.
const isMain = require.main === module;

if (isMain) {
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