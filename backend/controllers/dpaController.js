// ─────────────────────────────────────────────────────────────
// FILE 1: backend/controllers/dpaController.js  (NEW FILE)
// ─────────────────────────────────────────────────────────────

const { pool } = require('../config/database');

/**
 * POST /api/auth/accept-dpa
 * Records DPA acceptance for the authenticated trainer.
 * Called immediately after registration before dashboard access.
 */
const acceptDpa = async (req, res) => {
  const trainerId = req.user.userId;
  const ip = req.ip || req.connection.remoteAddress;
  const version = '1.0';

  try {
    // Insert consent record
    await pool.query(
      `INSERT INTO trainer_consents (trainer_id, ip_address, version)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [trainerId, ip, version]
    );

    // Mark user as DPA accepted
    await pool.query(
      `UPDATE users
       SET dpa_accepted = TRUE, dpa_accepted_at = NOW()
       WHERE id = $1`,
      [trainerId]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'dpa_accepted', 'trainer', $1, $2)`,
      [trainerId, ip]
    );

    return res.status(200).json({
      success: true,
      message: 'DPA acceptance recorded.'
    });
  } catch (error) {
    console.error('acceptDpa error:', error);
    return res.status(500).json({ error: 'Failed to record DPA acceptance.' });
  }
};

/**
 * GET /api/auth/dpa-status
 * Returns whether the current trainer has accepted the DPA.
 */
const getDpaStatus = async (req, res) => {
  const trainerId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT dpa_accepted, dpa_accepted_at FROM users WHERE id = $1`,
      [trainerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const { dpa_accepted, dpa_accepted_at } = result.rows[0];
    return res.status(200).json({ dpa_accepted, dpa_accepted_at });
  } catch (error) {
    console.error('getDpaStatus error:', error);
    return res.status(500).json({ error: 'Failed to fetch DPA status.' });
  }
};

module.exports = { acceptDpa, getDpaStatus };


// ─────────────────────────────────────────────────────────────
// FILE 2: backend/middleware/requireDpa.js  (NEW FILE)
// ─────────────────────────────────────────────────────────────
//
// const { pool } = require('../config/database');
//
// const requireDpa = async (req, res, next) => {
//   const trainerId = req.user?.userId;
//   if (!trainerId) return res.status(401).json({ error: 'Unauthorised.' });
//
//   try {
//     const result = await pool.query(
//       'SELECT dpa_accepted FROM users WHERE id = $1',
//       [trainerId]
//     );
//
//     if (!result.rows.length || !result.rows[0].dpa_accepted) {
//       return res.status(403).json({
//         error: 'dpa_required',
//         message: 'You must accept the Data Processing Agreement before continuing.'
//       });
//     }
//
//     next();
//   } catch (error) {
//     console.error('requireDpa error:', error);
//     return res.status(500).json({ error: 'Failed to verify DPA status.' });
//   }
// };
//
// module.exports = { requireDpa };
//
// NOTE: The above is shown as a comment block so you can copy it into
// its own file. Instructions below tell you exactly what to do.
