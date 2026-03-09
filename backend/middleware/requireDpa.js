const { pool } = require('../config/database');

/**
 * Middleware — blocks API access if trainer has not accepted the DPA.
 * Apply to all routes that require DPA acceptance (everything except
 * /api/auth/login, /api/auth/register, /api/auth/accept-dpa).
 */
const requireDpa = async (req, res, next) => {
  const trainerId = req.user?.userId;
  if (!trainerId) return res.status(401).json({ error: 'Unauthorised.' });

  try {
    const result = await pool.query(
      'SELECT dpa_accepted FROM users WHERE id = $1',
      [trainerId]
    );

    if (!result.rows.length || !result.rows[0].dpa_accepted) {
      return res.status(403).json({
        error: 'dpa_required',
        message: 'You must accept the Data Processing Agreement before continuing.'
      });
    }

    next();
  } catch (error) {
    console.error('requireDpa error:', error);
    return res.status(500).json({ error: 'Failed to verify DPA status.' });
  }
};

module.exports = { requireDpa };
