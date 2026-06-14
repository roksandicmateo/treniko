// backend/routes/progress.js
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ── GET /api/progress/client/:clientId ───────────────────────────────────────
router.get('/client/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId }  = req.params;
    const { months = 6 } = req.query;

    const since = new Date();
    since.setMonth(since.getMonth() - parseInt(months));
    const sinceStr = since.toISOString().split('T')[0];

    const { rows: [client] } = await pool.query(
      'SELECT id, first_name, last_name FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Strength progress per exercise per date
    const { rows: strengthData } = await pool.query(`
      SELECT
        COALESCE(e.id, te.id)                         AS exercise_id,
        COALESCE(e.name, te.exercise_name, 'Unknown') AS exercise_name,
        DATE(t.start_time)::text AS session_date,
        MAX(ts.weight)::float     AS max_weight,
        MAX(ts.reps)              AS max_reps,
        SUM(ts.reps * COALESCE(ts.weight, 1))::float AS volume,
        COUNT(ts.id)::int         AS total_sets
      FROM trainings t
      JOIN training_exercises te ON te.training_id = t.id
      LEFT JOIN exercises e      ON e.id = te.exercise_id
      JOIN training_sets ts      ON ts.training_exercise_id = te.id
      WHERE t.client_id   = $1
        AND t.tenant_id   = $2
        AND t.is_completed = true
        AND DATE(t.start_time) >= $3
        AND ts.set_type IN ('working','topset','amrap')
        AND ts.weight IS NOT NULL
      GROUP BY COALESCE(e.id, te.id), COALESCE(e.name, te.exercise_name, 'Unknown'), DATE(t.start_time)
      ORDER BY COALESCE(e.name, te.exercise_name, 'Unknown'), session_date
    `, [clientId, tenantId, sinceStr]);

    // Session frequency per week
    const { rows: frequencyData } = await pool.query(`
      SELECT
        DATE_TRUNC('week', t.start_time)::date::text AS week_start,
        COUNT(*)::int AS session_count,
        COALESCE(SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time))/60)::int, 0) AS total_minutes
      FROM trainings t
      WHERE t.client_id   = $1
        AND t.tenant_id   = $2
        AND t.is_completed = true
        AND t.start_time  >= $3
      GROUP BY DATE_TRUNC('week', t.start_time)
      ORDER BY week_start
    `, [clientId, tenantId, sinceStr]);

    // Personal records (all time best per exercise)
    const { rows: personalRecords } = await pool.query(`
      SELECT DISTINCT ON (COALESCE(e.id::text, te.id::text))
        COALESCE(e.id, te.id)                         AS exercise_id,
        COALESCE(e.name, te.exercise_name, 'Unknown') AS exercise_name,
        ts.weight::float AS max_weight,
        ts.reps,
        DATE(t.start_time)::text AS achieved_date
      FROM trainings t
      JOIN training_exercises te ON te.training_id = t.id
      LEFT JOIN exercises e      ON e.id = te.exercise_id
      JOIN training_sets ts      ON ts.training_exercise_id = te.id
      WHERE t.client_id   = $1
        AND t.tenant_id   = $2
        AND t.is_completed = true
        AND ts.weight IS NOT NULL
        AND ts.set_type IN ('working','topset','amrap')
      ORDER BY COALESCE(e.id::text, te.id::text), ts.weight DESC NULLS LAST
    `, [clientId, tenantId]);

    // Summary stats for the period
    const { rows: [stats] } = await pool.query(`
      SELECT
        COUNT(DISTINCT t.id)::int           AS total_sessions,
        COUNT(DISTINCT te.exercise_id)::int AS unique_exercises,
        COALESCE(SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time))/3600)::numeric(10,1), 0) AS total_hours,
        COUNT(ts.id)::int                   AS total_sets
      FROM trainings t
      JOIN training_exercises te ON te.training_id = t.id
      JOIN training_sets ts      ON ts.training_exercise_id = te.id
      WHERE t.client_id   = $1
        AND t.tenant_id   = $2
        AND t.is_completed = true
        AND t.start_time  >= $3
    `, [clientId, tenantId, sinceStr]);

    // Exercises with weight data (for filter dropdown)
    const { rows: exercises } = await pool.query(`
      SELECT DISTINCT COALESCE(e.id, te.id) AS id, COALESCE(e.name, te.exercise_name, 'Unknown') AS name, e.category
      FROM trainings t
      JOIN training_exercises te ON te.training_id = t.id
      LEFT JOIN exercises e      ON e.id = te.exercise_id
      JOIN training_sets ts      ON ts.training_exercise_id = te.id
      WHERE t.client_id   = $1
        AND t.tenant_id   = $2
        AND t.is_completed = true
        AND ts.weight IS NOT NULL
      ORDER BY COALESCE(e.name, te.exercise_name, 'Unknown')
    `, [clientId, tenantId]);

    res.json({ success: true, client, stats, strengthData, frequencyData, personalRecords, exercises });
  } catch (e) {
    console.error('Progress error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/progress/overview ───────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { months = 1 } = req.query;

    const since = new Date();
    since.setMonth(since.getMonth() - parseInt(months));
    const sinceStr = since.toISOString().split('T')[0];

    const { rows: dailySessions } = await pool.query(`
      SELECT
        DATE(t.start_time)::text AS date,
        COUNT(*)::int AS count
      FROM trainings t
      WHERE t.tenant_id   = $1
        AND t.is_completed = true
        AND t.start_time  >= $2
      GROUP BY DATE(t.start_time)
      ORDER BY date
    `, [tenantId, sinceStr]);

    const { rows: topClients } = await pool.query(`
      SELECT
        c.id, c.first_name, c.last_name,
        COUNT(t.id)::int AS session_count,
        MAX(t.start_time)::date::text AS last_session
      FROM clients c
      JOIN trainings t ON t.client_id = c.id
      WHERE t.tenant_id   = $1
        AND t.is_completed = true
        AND t.start_time  >= $2
      GROUP BY c.id, c.first_name, c.last_name
      ORDER BY session_count DESC
      LIMIT 5
    `, [tenantId, sinceStr]);

    const { rows: [overview] } = await pool.query(`
      SELECT
        COUNT(DISTINCT t.id)::int        AS total_sessions,
        COUNT(DISTINCT t.client_id)::int AS active_clients,
        COALESCE(SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time))/3600)::numeric(10,1), 0) AS total_hours
      FROM trainings t
      WHERE t.tenant_id   = $1
        AND t.is_completed = true
        AND t.start_time  >= $2
    `, [tenantId, sinceStr]);

    res.json({ success: true, dailySessions, topClients, overview });
  } catch (e) {
    console.error('Overview error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/progress/:clientId/strength ─────────────────────────────────────
router.get('/:clientId/strength', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { months = 6 } = req.query;

    const since = new Date();
    since.setMonth(since.getMonth() - parseInt(months));
    const sinceStr = since.toISOString().split('T')[0];

    const { rows } = await pool.query(`
      SELECT
        COALESCE(e.name, te.exercise_name, 'Unknown') AS exercise_name,
        DATE(t.start_time)::text AS session_date,
        MAX(ts.weight)::float AS max_weight,
        MAX(ts.reps) AS max_reps
      FROM trainings t
      JOIN training_exercises te ON te.training_id = t.id
      LEFT JOIN exercises e ON e.id = te.exercise_id
      JOIN training_sets ts ON ts.training_exercise_id = te.id
      WHERE t.client_id=$1 AND t.tenant_id=$2
        AND t.is_completed=true
        AND DATE(t.start_time) >= $3
        AND ts.weight IS NOT NULL
      GROUP BY COALESCE(e.name, te.exercise_name, 'Unknown'), DATE(t.start_time)
      ORDER BY exercise_name, session_date
    `, [clientId, tenantId, sinceStr]);

    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.exercise_name]) grouped[row.exercise_name] = [];
      grouped[row.exercise_name].push(row);
    });
    res.json(grouped);
  } catch (e) {
    console.error('Strength error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/progress/:clientId ─────────────────────────────────────────────
router.get('/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { metric } = req.query;

    let query = `SELECT * FROM progress_entries WHERE client_id=$1 AND tenant_id=$2`;
    const params = [clientId, tenantId];
    if (metric) { query += ` AND metric_name=$3`; params.push(metric); }
    query += ` ORDER BY date DESC`;

    const { rows } = await pool.query(query, params);
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.metric_name]) grouped[row.metric_name] = [];
      grouped[row.metric_name].push(row);
    });
    res.json(grouped);
  } catch (e) {
    console.error('Progress get error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/progress/:clientId ─────────────────────────────────────────────
router.post('/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { metric_name, metricName, value, unit, date, notes } = req.body;
    const finalMetricName = metric_name || metricName;

    if (!finalMetricName || value === undefined) {
      return res.status(400).json({ error: 'metric_name and value required' });
    }

    const { rows: [entry] } = await pool.query(
      `INSERT INTO progress_entries (tenant_id, client_id, metric_name, value, unit, date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, clientId, finalMetricName, value, unit || 'kg', date || new Date().toISOString().split('T')[0], notes || null]
    );
    res.status(201).json({ success: true, entry });
  } catch (e) {
    console.error('Progress post error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/progress/:clientId/:entryId ───────────────────────────────────
router.delete('/:clientId/:entryId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId, entryId } = req.params;

    await pool.query(
      `DELETE FROM progress_entries WHERE id=$1 AND client_id=$2 AND tenant_id=$3`,
      [entryId, clientId, tenantId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Progress delete error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
