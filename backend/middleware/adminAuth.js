'use strict';

/**
 * Authentication and authorization for the platform administration API.
 *
 * ── A separate realm, on purpose ────────────────────────────────────────────
 * This is NOT the trainer authentication in middleware/auth.js with an extra
 * flag. It is a second, parallel realm, and the separation is enforced by the
 * shape of the token rather than by a conditional someone can forget:
 *
 *   trainer token   { userId,  tenantId, email }        → resolves against users
 *   admin token     { adminId, role, typ:'platform_admin' } → platform_admins
 *
 * A trainer token presented here is refused before any database lookup: it has
 * no `adminId` and no `typ`. An admin token presented to the trainer gate is
 * refused there too, because that gate looks up `users` by `payload.userId`,
 * which an admin token does not carry — the lookup matches no row and the
 * request is rejected as an expired session.
 *
 * Both directions are asserted in tests/security/platformAdmin.test.js. They
 * are the property that stops this file becoming a privilege-escalation path
 * into every tenant in the system.
 *
 * ── Fail closed ─────────────────────────────────────────────────────────────
 * Every failure mode here — missing token, wrong realm, unknown admin,
 * deactivated admin, locked admin, token older than the last password change,
 * database error — results in a rejection. There is no branch that calls
 * next() without a verified, active administrator on req.admin.
 */

const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/** Marks a token as belonging to the administration realm. */
const ADMIN_TOKEN_TYPE = 'platform_admin';

/**
 * Privileged sessions are deliberately shorter-lived than a trainer's 24h.
 * An admin token is worth far more to an attacker, and staff sign in from a
 * desk rather than from a phone between clients.
 */
const ADMIN_TOKEN_TTL = '8h';

/** Role ranking. A role satisfies a requirement if it ranks at least as high. */
const ROLE_RANK = { viewer: 1, admin: 2, owner: 3 };

/**
 * Issue an administration token.
 * @param {{id: string, email: string, role: string}} admin
 */
const signAdminToken = (admin) =>
  jwt.sign(
    { adminId: admin.id, email: admin.email, role: admin.role, typ: ADMIN_TOKEN_TYPE },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: ADMIN_TOKEN_TTL }
  );

/**
 * Reject a token minted before the administrator last changed their password.
 *
 * Identical in intent to isTokenStillValid() in middleware/auth.js: without it
 * a stolen admin token survives the password change made in response to the
 * theft. See that function for why the change time is rounded up to the next
 * whole second.
 */
const tokenPredatesPasswordChange = (admin, payload) => {
  if (!admin.password_changed_at) return false;
  if (typeof payload.iat !== 'number') return true; // no issue time: cannot vouch for it
  const revokedBefore = Math.ceil(new Date(admin.password_changed_at).getTime() / 1000);
  return payload.iat < revokedBefore;
};

/**
 * Verify an administration token and attach the administrator to req.admin.
 */
const authenticateAdmin = (req, res, next) => {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'No administration token provided',
    });
  }

  // The algorithm is pinned for the same reason it is pinned for trainers: the
  // token is attacker-supplied, so its own `alg` header is the attacker's
  // choice to make.
  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, async (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token', message: 'Token verification failed' });
    }

    // Realm check, before any database work. A perfectly valid trainer token
    // stops here.
    if (!payload || payload.typ !== ADMIN_TOKEN_TYPE || !payload.adminId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This token is not valid for the administration API',
      });
    }

    try {
      const { rows } = await pool.query(
        `SELECT id, email, first_name, last_name, role, is_active,
                locked_until, password_changed_at
           FROM platform_admins
          WHERE id = $1`,
        [payload.adminId]
      );

      const admin = rows[0];

      // Account deleted since the token was issued.
      if (!admin) {
        return res.status(401).json({ error: 'Invalid token', message: 'Administrator not found' });
      }

      // Access revoked without deleting the account, or the audit trail it owns.
      if (!admin.is_active) {
        return res.status(403).json({ error: 'Forbidden', message: 'This administrator account is disabled' });
      }

      if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
        return res.status(403).json({ error: 'Forbidden', message: 'This administrator account is locked' });
      }

      if (tokenPredatesPasswordChange(admin, payload)) {
        return res.status(401).json({
          error: 'Invalid token',
          message: 'Session expired, please sign in again',
        });
      }

      // The role is taken from the DATABASE, never from the token. A role
      // changed or revoked five minutes ago must take effect on the next
      // request, not when an eight-hour token happens to expire.
      req.admin = {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role,
      };

      return next();
    } catch (e) {
      console.error('[authenticateAdmin] lookup failed:', e.message);
      return res.status(500).json({ error: 'Server error', message: 'Could not verify administrator' });
    }
  });
};

/**
 * Require at least the given role. Use as `requireAdminRole('admin')`.
 *
 * Ranked rather than exact so that adding a role above an existing one does not
 * silently drop permissions from everyone who already had them.
 */
const requireAdminRole = (minimum) => (req, res, next) => {
  if (!req.admin) {
    // Only reachable if this is mounted without authenticateAdmin in front.
    return res.status(401).json({ error: 'Authentication required', message: 'No administrator on request' });
  }

  const have = ROLE_RANK[req.admin.role] || 0;
  const need = ROLE_RANK[minimum] || Number.MAX_SAFE_INTEGER;

  if (have < need) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `This action requires the "${minimum}" role or higher`,
      requiredRole: minimum,
      yourRole: req.admin.role,
    });
  }

  return next();
};

module.exports = {
  authenticateAdmin,
  requireAdminRole,
  signAdminToken,
  ADMIN_TOKEN_TYPE,
  ADMIN_TOKEN_TTL,
  ROLE_RANK,
};
