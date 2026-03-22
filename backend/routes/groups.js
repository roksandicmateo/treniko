// backend/routes/groups.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ── GET /api/groups — list all groups with member count ──────────────────────
router.get('/', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      `SELECT g.*,
              COUNT(gm.id)::int AS member_count
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE g.tenant_id = $1
       GROUP BY g.id
       ORDER BY g.name ASC`,
      [tenantId]
    );
    res.json({ success: true, groups: rows });
  } catch (e) {
    console.error('Get groups error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/groups/:id — group detail with members ──────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;

    const { rows: [group] } = await pool.query(
      'SELECT * FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const { rows: members } = await pool.query(
      `SELECT c.id, c.first_name, c.last_name, c.email, c.phone,
              c.is_active, c.is_archived,
              gm.joined_at,
              cs.total_sessions, cs.completed_sessions
       FROM group_members gm
       JOIN clients c ON c.id = gm.client_id
       LEFT JOIN client_statistics cs ON cs.client_id = c.id
       WHERE gm.group_id = $1
       ORDER BY c.last_name, c.first_name`,
      [group.id]
    );

    res.json({ success: true, group: { ...group, members } });
  } catch (e) {
    console.error('Get group error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/groups — create group ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [group] } = await pool.query(
      `INSERT INTO groups (tenant_id, name, description, color)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, name.trim(), description || null, color || '#0ea5e9']
    );
    res.status(201).json({ success: true, group });
  } catch (e) {
    console.error('Create group error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/groups/:id — update group ──────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, description, color } = req.body;

    const { rows: [group] } = await pool.query(
      `UPDATE groups SET name=$1, description=$2, color=$3, updated_at=NOW()
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [name, description || null, color || '#0ea5e9', req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json({ success: true, group });
  } catch (e) {
    console.error('Update group error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/groups/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rowCount } = await pool.query(
      'DELETE FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Group not found' });
    res.json({ success: true });
  } catch (e) {
    console.error('Delete group error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/groups/:id/members — add member ───────────────────────────────
router.post('/:id/members', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    // Verify group belongs to tenant
    const { rows: [group] } = await pool.query(
      'SELECT id FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Verify client belongs to tenant
    const { rows: [client] } = await pool.query(
      'SELECT id FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { rows: [member] } = await pool.query(
      `INSERT INTO group_members (group_id, client_id)
       VALUES ($1,$2)
       ON CONFLICT (group_id, client_id) DO NOTHING
       RETURNING *`,
      [req.params.id, clientId]
    );
    res.status(201).json({ success: true, member });
  } catch (e) {
    console.error('Add member error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/groups/:id/members/:clientId — remove member ────────────────
router.delete('/:id/members/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;

    // Verify group belongs to tenant
    const { rows: [group] } = await pool.query(
      'SELECT id FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    await pool.query(
      'DELETE FROM group_members WHERE group_id=$1 AND client_id=$2',
      [req.params.id, req.params.clientId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Remove member error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/groups/:id/members/:clientId/feed — member session feed ─────────
router.get('/:id/members/:clientId/feed', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 20, offset = 0 } = req.query;

    const { rows: sessions } = await pool.query(
      `SELECT ts.id, ts.session_date::text, ts.start_time, ts.end_time,
              ts.session_type, ts.notes, ts.status, ts.is_completed,
              c.first_name, c.last_name
       FROM training_sessions ts
       JOIN clients c ON c.id = ts.client_id
       WHERE ts.client_id = $1 AND ts.tenant_id = $2
       ORDER BY ts.session_date DESC, ts.start_time DESC
       LIMIT $3 OFFSET $4`,
      [req.params.clientId, tenantId, parseInt(limit), parseInt(offset)]
    );
    res.json({ success: true, sessions });
  } catch (e) {
    console.error('Member feed error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
