// backend/routes/groups.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ── GET /api/groups ──────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      `SELECT g.*, COUNT(gm.id)::int AS member_count
       FROM groups g
       LEFT JOIN group_members gm ON gm.group_id = g.id
       WHERE g.tenant_id = $1
       GROUP BY g.id ORDER BY g.name ASC`,
      [tenantId]
    );
    res.json({ success: true, groups: rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/groups/:id ──────────────────────────────────────────────────────
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
              c.is_active, c.is_archived, gm.joined_at,
              cs.total_sessions, cs.completed_sessions
       FROM group_members gm
       JOIN clients c ON c.id = gm.client_id
       LEFT JOIN client_statistics cs ON cs.client_id = c.id
       WHERE gm.group_id = $1
       ORDER BY c.last_name, c.first_name`,
      [group.id]
    );
    res.json({ success: true, group: { ...group, members } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/groups ─────────────────────────────────────────────────────────
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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── PUT /api/groups/:id ──────────────────────────────────────────────────────
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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
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
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/groups/:id/members ─────────────────────────────────────────────
router.post('/:id/members', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });
    const { rows: [group] } = await pool.query('SELECT id FROM groups WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const { rows: [client] } = await pool.query('SELECT id FROM clients WHERE id=$1 AND tenant_id=$2', [clientId, tenantId]);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    const { rows: [member] } = await pool.query(
      `INSERT INTO group_members (group_id, client_id) VALUES ($1,$2)
       ON CONFLICT (group_id, client_id) DO NOTHING RETURNING *`,
      [req.params.id, clientId]
    );
    res.status(201).json({ success: true, member });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── DELETE /api/groups/:id/members/:clientId ─────────────────────────────────
router.delete('/:id/members/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows: [group] } = await pool.query('SELECT id FROM groups WHERE id=$1 AND tenant_id=$2', [req.params.id, tenantId]);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    await pool.query('DELETE FROM group_members WHERE group_id=$1 AND client_id=$2', [req.params.id, req.params.clientId]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/groups/:id/members/:clientId/feed ───────────────────────────────
// Returns individual sessions + group sessions for this client
router.get('/:id/members/:clientId/feed', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 20 } = req.query;

    // Individual sessions
    const { rows: individual } = await pool.query(
      `SELECT ts.id, ts.session_date::text, ts.start_time, ts.end_time,
              ts.session_type, ts.notes, ts.status, ts.is_completed,
              NULL::uuid AS group_session_id, NULL AS group_name, NULL AS group_color,
              'individual' AS session_kind
       FROM training_sessions ts
       WHERE ts.client_id = $1 AND ts.tenant_id = $2`,
      [req.params.clientId, tenantId]
    );

    // Group sessions this client attended
    const { rows: groupSessions } = await pool.query(
      `SELECT gs.id, gs.session_date::text, gs.start_time, gs.end_time,
              gs.session_type, gs.notes, gsa.status, (gsa.status = 'completed') AS is_completed,
              gs.id AS group_session_id, g.name AS group_name, g.color AS group_color,
              'group' AS session_kind
       FROM group_session_attendance gsa
       JOIN group_sessions gs ON gs.id = gsa.group_session_id
       JOIN groups g ON g.id = gs.group_id
       WHERE gsa.client_id = $1 AND gs.tenant_id = $2`,
      [req.params.clientId, tenantId]
    );

    const all = [...individual, ...groupSessions]
      .sort((a, b) => b.session_date.localeCompare(a.session_date) || b.start_time.localeCompare(a.start_time))
      .slice(0, parseInt(limit));

    res.json({ success: true, sessions: all });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── POST /api/groups/:id/sessions — create ONE group session ──────────────────
router.post('/:id/sessions', async (req, res) => {
  const client = await pool.connect();
  try {
    const { tenantId } = req.user;
    const { sessionDate, startTime, endTime, sessionType, notes } = req.body;
    if (!sessionDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'sessionDate, startTime, endTime are required' });
    }

    const { rows: [group] } = await client.query(
      'SELECT * FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const { rows: members } = await client.query(
      `SELECT c.id FROM group_members gm
       JOIN clients c ON c.id = gm.client_id
       WHERE gm.group_id = $1`,
      [group.id]
    );
    if (members.length === 0) {
      return res.status(400).json({ error: 'Group has no members' });
    }

    await client.query('BEGIN');

    // ONE group session record
    const { rows: [groupSession] } = await client.query(
      `INSERT INTO group_sessions (tenant_id, group_id, session_date, start_time, end_time, session_type, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, group.id, sessionDate, startTime, endTime, sessionType || null, notes || null]
    );

    // Attendance record per member
    for (const member of members) {
      await client.query(
        `INSERT INTO group_session_attendance (group_session_id, client_id)
         VALUES ($1,$2)`,
        [groupSession.id, member.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      groupSession: { ...groupSession, group_name: group.name, group_color: group.color },
      memberCount: members.length
    });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Create group session error:', e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/groups/:id/sessions — group session history with attendance ──────
router.get('/:id/sessions', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 50 } = req.query;

    const { rows: [group] } = await pool.query(
      'SELECT * FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const { rows: sessions } = await pool.query(
      `SELECT gs.*,
              COUNT(gsa.id)::int AS total_members,
              COUNT(CASE WHEN gsa.status = 'completed' THEN 1 END)::int AS completed,
              COUNT(CASE WHEN gsa.status = 'no_show'   THEN 1 END)::int AS no_shows,
              COUNT(CASE WHEN gsa.status = 'cancelled' THEN 1 END)::int AS cancelled,
              COUNT(CASE WHEN gsa.status = 'scheduled' THEN 1 END)::int AS scheduled
       FROM group_sessions gs
       LEFT JOIN group_session_attendance gsa ON gsa.group_session_id = gs.id
       WHERE gs.group_id = $1 AND gs.tenant_id = $2
       GROUP BY gs.id
       ORDER BY gs.session_date DESC, gs.start_time DESC
       LIMIT $3`,
      [req.params.id, tenantId, parseInt(limit)]
    );

    // Per-session member details
    const sessionsWithMembers = await Promise.all(sessions.map(async (s) => {
      const { rows: members } = await pool.query(
        `SELECT gsa.id, gsa.status, gsa.training_id, gsa.client_id,
                c.first_name, c.last_name
         FROM group_session_attendance gsa
         JOIN clients c ON c.id = gsa.client_id
         WHERE gsa.group_session_id = $1
         ORDER BY c.last_name, c.first_name`,
        [s.id]
      );
      return { ...s, members };
    }));

    // This month stats
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const { rows: [stats] } = await pool.query(
      `SELECT
         COUNT(DISTINCT gs.id)::int AS sessions_this_month,
         COUNT(CASE WHEN gsa.status = 'completed' THEN 1 END)::int AS total_completed,
         COUNT(CASE WHEN gsa.status = 'no_show'   THEN 1 END)::int AS total_no_shows
       FROM group_sessions gs
       LEFT JOIN group_session_attendance gsa ON gsa.group_session_id = gs.id
       WHERE gs.group_id = $1 AND gs.tenant_id = $2 AND gs.session_date >= $3`,
      [req.params.id, tenantId, monthStart]
    );

    res.json({ success: true, sessions: sessionsWithMembers, stats });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── PUT /api/groups/:id/sessions/:sessionId/attendance/:clientId ─────────────
// Update individual member attendance status
router.put('/:id/sessions/:sessionId/attendance/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { status } = req.body;

    // Verify group belongs to tenant
    const { rows: [group] } = await pool.query(
      'SELECT id FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const { rows: [attendance] } = await pool.query(
      `UPDATE group_session_attendance SET status=$1
       WHERE group_session_id=$2 AND client_id=$3
       RETURNING *`,
      [status, req.params.sessionId, req.params.clientId]
    );
    if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });
    res.json({ success: true, attendance });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── GET /api/groups/sessions/calendar — for calendar display ─────────────────
// Returns group sessions formatted for FullCalendar
router.get('/sessions/calendar', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    let q = `SELECT gs.*, g.name AS group_name, g.color AS group_color,
                    COUNT(gsa.id)::int AS member_count
             FROM group_sessions gs
             JOIN groups g ON g.id = gs.group_id
             LEFT JOIN group_session_attendance gsa ON gsa.group_session_id = gs.id
             WHERE gs.tenant_id = $1`;
    const params = [tenantId];

    if (startDate) { params.push(startDate); q += ` AND gs.session_date >= $${params.length}`; }
    if (endDate)   { params.push(endDate);   q += ` AND gs.session_date <= $${params.length}`; }

    q += ' GROUP BY gs.id, g.name, g.color ORDER BY gs.session_date, gs.start_time';

    const { rows } = await pool.query(q, params);
    res.json({ success: true, sessions: rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});


// ── GET /api/groups/:id/sessions/:sessionId — full detail ────────────────────
router.get('/:id/sessions/:sessionId', async (req, res) => {
  try {
    const { tenantId } = req.user;

    const { rows: [session] } = await pool.query(
      `SELECT gs.*, g.name AS group_name, g.color AS group_color
       FROM group_sessions gs
       JOIN groups g ON g.id = gs.group_id
       WHERE gs.id=$1 AND gs.tenant_id=$2`,
      [req.params.sessionId, tenantId]
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const { rows: attendance } = await pool.query(
      `SELECT gsa.id, gsa.status, gsa.notes, gsa.client_id,
              c.first_name, c.last_name, c.email
       FROM group_session_attendance gsa
       JOIN clients c ON c.id = gsa.client_id
       WHERE gsa.group_session_id = $1
       ORDER BY c.last_name, c.first_name`,
      [req.params.sessionId]
    );

    res.json({ success: true, session: { ...session, attendance } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// ── PUT /api/groups/:id/sessions/:sessionId — save log + attendance ───────────
router.put('/:id/sessions/:sessionId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { tenantId } = req.user;
    const { exercises, workoutType, location, notes, sessionType, status, attendance } = req.body;

    const { rows: [group] } = await client.query(
      'SELECT id FROM groups WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!group) return res.status(404).json({ error: 'Group not found' });

    await client.query('BEGIN');

    // Update group session
    const { rows: [session] } = await client.query(
      `UPDATE group_sessions SET
         exercises=$1, workout_type=$2, location=$3, notes=$4,
         session_type=$5, status=$6, updated_at=NOW()
       WHERE id=$7 AND tenant_id=$8 RETURNING *`,
      [
        exercises ? JSON.stringify(exercises) : null,
        workoutType || 'Gym',
        location || null,
        notes || null,
        sessionType || null,
        status || 'scheduled',
        req.params.sessionId,
        tenantId
      ]
    );
    if (!session) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Session not found' }); }

    // Update attendance statuses
    if (attendance && Array.isArray(attendance)) {
      for (const a of attendance) {
        await client.query(
          `UPDATE group_session_attendance SET status=$1, notes=$2
           WHERE group_session_id=$3 AND client_id=$4`,
          [a.status, a.notes || null, req.params.sessionId, a.clientId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, session });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
