const express = require('express');
const router = express.Router();
const sessionsController = require('../controllers/sessionsController');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { attachUuidParamGuards } = require('../utils/routeGuards');
const { isUuid } = require('../utils/validation');

// All session routes require authentication
router.use(authenticateToken);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500 (see utils/routeGuards.js).
attachUuidParamGuards(router);

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
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid session id' });

    // `c.tenant_id = $2` is not redundant. The join previously trusted that any
    // attendee row carrying our tenant_id could only reference our own client,
    // which is exactly the assumption the unchecked insert below used to break:
    // a row written with the caller's tenant_id but another tenant's client_id
    // made this query return that client's name. The insert is fixed, and this
    // filter means a stale or future bad row still cannot leak a foreign name.
    const { rows } = await pool.query(
      `SELECT sa.id, sa.client_id, sa.status,
              c.first_name, c.last_name
       FROM session_attendees sa
       JOIN clients c ON c.id = sa.client_id AND c.tenant_id = $2
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

    // TR-MED-6. This insert used to take :id and clientId straight from the
    // request and stamp them with the caller's own tenant_id, verifying
    // neither. That let a trainer attach ANOTHER tenant's client to ANOTHER
    // tenant's session — and because the row then carried the attacker's
    // tenant_id, GET /attendees read it straight back and returned the victim
    // client's name. It was a cross-tenant read, not just a dangling reference.
    if (!isUuid(req.params.id)) return res.status(400).json({ error: 'Invalid session id' });
    if (!isUuid(clientId))      return res.status(400).json({ error: 'Invalid client id' });

    const { rows: [session] } = await pool.query(
      'SELECT id FROM training_sessions WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { rows: [client] } = await pool.query(
      'SELECT id FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });

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
