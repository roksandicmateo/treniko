const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * Reject tokens issued before the user's most recent password change.
 *
 * Without this, changing or resetting a password did not invalidate tokens that
 * had already been handed out, so an attacker holding a stolen JWT kept full
 * access for the remainder of its 24h lifetime — defeating the usual response
 * to an account compromise.
 *
 * Requires migration 024_token_invalidation.sql. If the column is missing the
 * request is refused rather than silently skipping the check, so a partial
 * deploy fails loudly instead of quietly dropping a security control.
 *
 * @returns {boolean} true when the token is still valid for this user.
 */
const isTokenStillValid = async (payload) => {
  const { rows } = await pool.query(
    'SELECT password_changed_at FROM users WHERE id = $1',
    [payload.userId]
  );

  // User no longer exists — the token refers to a deleted account.
  if (!rows.length) return false;

  const changedAt = rows[0].password_changed_at;
  if (!changedAt) return true; // never changed since the column was introduced

  if (typeof payload.iat !== 'number') return false;

  // `iat` has one-second resolution while password_changed_at has sub-second
  // resolution, so a token minted in the same second as the change would
  // otherwise compare as "not older" and survive. Rounding the change time up
  // to the next whole second resolves the ambiguity in the safe direction:
  // anything issued during that second is treated as pre-change.
  const revokedBefore = Math.ceil(new Date(changedAt).getTime() / 1000);
  return payload.iat >= revokedBefore;
};

/**
 * Middleware to verify JWT token and extract user/tenant information
 * Attaches user data to req.user for use in route handlers
 */
const authenticateToken = (req, res, next) => {
  // Get token from Authorization header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No token provided'
    });
  }

  // Verify token
  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }

    try {
      if (!(await isTokenStillValid(user))) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Session expired, please sign in again',
        });
      }
    } catch (e) {
      console.error('[authenticateToken] revocation check failed:', e.message);
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Unable to verify session',
      });
    }

    // Attach user info to request object
    req.user = {
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email
    };

    next();
  });
};

/**
 * Middleware to validate tenant access
 * Ensures user can only access data from their own tenant
 */
const validateTenantAccess = (req, res, next) => {
  const { tenantId } = req.user;
  
  // Check if tenant_id in request body/params matches user's tenant
  const requestTenantId = req.body.tenant_id || req.params.tenant_id;
  
  if (requestTenantId && requestTenantId !== tenantId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access to this tenant data is not allowed'
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  validateTenantAccess
};
