const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessionsController');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// All session routes require authentication
router.use(authenticateToken);

/**
 * GET /api/sessions
 * Get all sessions for the authenticated tenant
 * Query params: startDate, endDate, clientId
 */
router.get('/', sessionsController.getSessions);

/**
 * GET /api/sessions/:id
 * Get a single session by ID
 */
router.get('/:id', sessionsController.getSessionById);

/**
 * POST /api/sessions
 * Create a new training session
 */
router.post('/', sessionsController.createSession);

/**
 * PUT /api/sessions/:id
 * Update an existing session
 */
router.put('/:id', sessionsController.updateSession);

/**
 * DELETE /api/sessions/:id
 * Delete a training session
 */
router.delete('/:id', sessionsController.deleteSession);


// ── ADHOC_ATTENDEES ───────────────────────────────────────────────────────────

// GET /api/sessions/:id/attendees
router.get('/:id/attendees', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      `SELECT sa.id, sa.client_id, sa.status,
              c.first_name, c.last_name
       FROM session_attendees sa
       JOIN clients c ON c.id = sa.client_id
       WHERE sa.session_id = $1 AND sa.tenant_id = $2
       ORDER BY c.first_name, c.last_name`,
      [req.params.id, tenantId]
    );
    res.json({ success: true, attendees: rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/sessions/:id/attendees — add client to ad-hoc group session
router.post('/:id/attendees', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.body;
    await pool.query(
      `INSERT INTO session_attendees (session_id, client_id, tenant_id)
       VALUES ($1, $2, $3) ON CONFLICT (session_id, client_id) DO NOTHING`,
      [req.params.id, clientId, tenantId]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/sessions/:id/attendees/:clientId — update attendance status
router.put('/:id/attendees/:clientId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { status } = req.body;
    const { rows } = await pool.query(
      `UPDATE session_attendees SET status = $1
       WHERE session_id = $2 AND client_id = $3 AND tenant_id = $4
       RETURNING *`,
      [status, req.params.id, req.params.clientId, tenantId]
    );
    res.json({ success: true, attendee: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/sessions/:id/attendees/:clientId
router.delete('/:id/attendees/:clientId', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.user;
    await pool.query(
      'DELETE FROM session_attendees WHERE session_id=$1 AND client_id=$2 AND tenant_id=$3',
      [req.params.id, req.params.clientId, tenantId]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
