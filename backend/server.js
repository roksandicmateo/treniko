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
const { checkReadOnlyMode, checkClientLimit, checkSessionLimit } = require('./middleware/subscription');

app.use('/api', apiRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/login', checkAccountLockout);
app.use('/api/auth/register', authRateLimiter);
app.use('/api/export', exportRateLimiter);
app.use('/api', auditLogMiddleware);
app.use('/api/auth/login', auditFailedLogin);
app.use('/api', checkReadOnlyMode);
app.use('/api', checkClientLimit);
app.use('/api', checkSessionLimit);

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
app.use('/api/training-logs', trainingLogsRoutes);

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
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

// ── Export & deletion ─────────────────────────────────────────────────────────
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
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
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
module.exports = app;