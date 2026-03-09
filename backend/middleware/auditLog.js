// backend/middleware/auditLog.js  (NEW FILE)

const { pool } = require('../config/database');

/**
 * Map of route patterns to audit action names.
 * Checked in order — first match wins.
 */
const AUDIT_RULES = [
  // Auth
  { method: 'POST', pattern: /\/auth\/login$/,           action: 'login' },
  { method: 'POST', pattern: /\/auth\/register$/,        action: 'register' },

  // DPA
  { method: 'POST', pattern: /\/auth\/accept-dpa$/,      action: 'dpa_accepted' },

  // Clients — sensitive reads
  { method: 'GET',  pattern: /\/clients\/[^/]+$/,        action: 'client_profile_viewed' },
  { method: 'GET',  pattern: /\/clients$/,               action: 'client_list_viewed' },
  { method: 'POST', pattern: /\/clients$/,               action: 'client_created' },
  { method: 'PUT',  pattern: /\/clients\/[^/]+$/,        action: 'client_updated' },
  { method: 'DELETE', pattern: /\/clients\/[^/]+$/,      action: 'client_deleted' },

  // Consent
  { method: 'POST',   pattern: /\/clients\/[^/]+\/consent$/, action: 'consent_given' },
  { method: 'DELETE', pattern: /\/clients\/[^/]+\/consent$/, action: 'consent_withdrawn' },

  // Training logs — health data reads
  { method: 'GET',  pattern: /\/training-logs/,          action: 'training_log_read' },
  { method: 'POST', pattern: /\/training-logs/,          action: 'training_log_created' },

  // Trainings
  { method: 'GET',  pattern: /\/trainings\/[^/]+$/,      action: 'training_viewed' },
  { method: 'POST', pattern: /\/trainings$/,             action: 'training_created' },
  { method: 'DELETE', pattern: /\/trainings\/[^/]+$/,    action: 'training_deleted' },

  // Progress — health data
  { method: 'GET',  pattern: /\/progress/,               action: 'progress_read' },
  { method: 'POST', pattern: /\/progress/,               action: 'progress_entry_created' },
  { method: 'DELETE', pattern: /\/progress/,             action: 'progress_entry_deleted' },

  // Exports
  { method: 'GET',  pattern: /\/export/,                 action: 'data_exported' },

  // Deletions
  { method: 'POST', pattern: /\/request-deletion$/,      action: 'deletion_requested' },
  { method: 'POST', pattern: /\/cancel-deletion$/,       action: 'deletion_cancelled' },

  // Sessions
  { method: 'GET',  pattern: /\/sessions\/[^/]+$/,       action: 'session_viewed' },
  { method: 'DELETE', pattern: /\/sessions\/[^/]+$/,     action: 'session_deleted' },
];

/**
 * Extract entity_id from request path if present.
 * e.g. /api/clients/abc-123 → abc-123
 */
const extractEntityId = (path) => {
  const match = path.match(/\/([0-9a-f-]{36})/i);
  return match ? match[1] : null;
};

/**
 * Extract entity_type from action name.
 */
const extractEntityType = (action) => {
  if (action.includes('client'))   return 'client';
  if (action.includes('training')) return 'training';
  if (action.includes('session'))  return 'session';
  if (action.includes('progress')) return 'progress';
  if (action.includes('export'))   return 'export';
  if (action.includes('deletion')) return 'deletion';
  if (action.includes('consent'))  return 'client';
  if (action.includes('dpa'))      return 'trainer';
  if (action.includes('login') || action.includes('register')) return 'auth';
  return 'unknown';
};

/**
 * Async fire-and-forget audit log insert.
 * Never throws — audit failures must not block the request.
 */
const writeAuditLog = (trainerId, action, entityType, entityId, ip, userAgent) => {
  pool.query(
    `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [trainerId || null, action, entityType, entityId || null, ip || null, userAgent || null]
  ).catch(err => {
    console.error('[auditLog] Failed to write audit log:', err.message);
  });
};

/**
 * Middleware factory — returns middleware that logs matching requests.
 *
 * Usage in server.js:
 *   const { auditLogMiddleware } = require('./middleware/auditLog');
 *   app.use('/api', auditLogMiddleware);
 */
const auditLogMiddleware = (req, res, next) => {
  // Find matching rule
  const rule = AUDIT_RULES.find(r =>
    r.method === req.method && r.pattern.test(req.path)
  );

  if (!rule) return next();

  // Run after response so we know it succeeded (status < 400)
  res.on('finish', () => {
    // Only log successful requests
    if (res.statusCode >= 400) return;

    const trainerId = req.user?.userId || null;
    const ip = req.ip || req.connection?.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    const entityId = extractEntityId(req.path);
    const entityType = extractEntityType(rule.action);

    writeAuditLog(trainerId, rule.action, entityType, entityId, ip, userAgent);
  });

  next();
};

/**
 * Middleware for logging failed login attempts specifically.
 * Apply only to POST /api/auth/login.
 */
const auditFailedLogin = (req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode === 401 || res.statusCode === 403) {
      const ip = req.ip || req.connection?.remoteAddress || null;
      const userAgent = req.headers['user-agent'] || null;
      writeAuditLog(null, 'login_failed', 'auth', null, ip, userAgent);
    }
  });
  next();
};

module.exports = { auditLogMiddleware, auditFailedLogin };
