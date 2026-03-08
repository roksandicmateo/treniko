const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/progress/:clientId
// Manual body metric entries grouped by metric name
// Query: ?metric=Weight&from=2024-01-01&to=2024-12-31
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { metric, from, to } = req.query;

    const { rows: [cl] } = await pool.query(
      'SELECT id FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!cl) return res.status(404).json({ error: 'Client not found' });

    let q = `SELECT * FROM progress_entries
             WHERE client_id=$1 AND tenant_id=$2 AND source='manual'`;
    const p = [clientId, tenantId];

    if (metric) { p.push(metric); q += ` AND metric_name = $${p.length}`; }
    if (from)   { p.push(from);   q += ` AND date >= $${p.length}`; }
    if (to)     { p.push(to);     q += ` AND date <= $${p.length}`; }
    q += ' ORDER BY metric_name, date ASC';

    const { rows } = await pool.query(q, p);
    const grouped = rows.reduce((acc, r) => {
      if (!acc[r.metric_name]) acc[r.metric_name] = [];
      acc[r.metric_name].push(r);
      return acc;
    }, {});

    res.json(grouped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/progress/:clientId/strength
// Auto-derived strength stats from training_sets
// Only counts working/topset/backoff/drop/amrap sets (not warmup)
// Returns: { "Bench Press": { exerciseId, category, defaultUnit, entries: [...] } }
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:clientId/strength', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { exerciseId, from, to } = req.query;

    const { rows: [cl] } = await pool.query(
      'SELECT id FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!cl) return res.status(404).json({ error: 'Client not found' });

    let q = `
      SELECT
        e.id                                                        AS exercise_id,
        e.name                                                      AS exercise_name,
        e.category,
        e.default_unit,
        DATE(t.start_time)                                          AS date,
        MAX(ts.weight)                                              AS max_weight,
        SUM(COALESCE(ts.reps, 1) * COALESCE(ts.weight, 0))         AS total_volume,
        COUNT(ts.id)                                                AS set_count,
        SUM(ts.reps)                                                AS total_reps,
        MAX(ts.weight * (1 + LEAST(COALESCE(ts.reps, 1), 30) / 30.0)) AS est_one_rm,
        MAX(ts.rpe)                                                 AS max_rpe
      FROM trainings t
      JOIN training_exercises te ON te.training_id = t.id
      JOIN exercises e           ON e.id = te.exercise_id
      JOIN training_sets ts      ON ts.training_exercise_id = te.id
      WHERE t.client_id = $1
        AND t.tenant_id = $2
        AND ts.weight IS NOT NULL
        AND ts.weight > 0
        AND (ts.set_type IS NULL OR ts.set_type IN ('working','topset','backoff','drop','amrap'))
    `;
    const p = [clientId, tenantId];

    if (exerciseId) { p.push(exerciseId); q += ` AND e.id = $${p.length}`; }
    if (from)       { p.push(from);       q += ` AND DATE(t.start_time) >= $${p.length}`; }
    if (to)         { p.push(to);         q += ` AND DATE(t.start_time) <= $${p.length}`; }

    q += ` GROUP BY e.id, e.name, e.category, e.default_unit, DATE(t.start_time)
           ORDER BY e.name, date ASC`;

    const { rows } = await pool.query(q, p);

    const grouped = rows.reduce((acc, r) => {
      if (!acc[r.exercise_name]) {
        acc[r.exercise_name] = {
          exerciseId:  r.exercise_id,
          category:    r.category,
          defaultUnit: r.default_unit,
          entries:     [],
        };
      }
      acc[r.exercise_name].entries.push({
        date:        r.date,
        maxWeight:   parseFloat(r.max_weight),
        totalVolume: parseFloat(r.total_volume),
        setCount:    parseInt(r.set_count),
        totalReps:   parseInt(r.total_reps),
        estOneRM:    parseFloat(r.est_one_rm).toFixed(1),
        maxRpe:      r.max_rpe ? parseFloat(r.max_rpe) : null,
      });
      return acc;
    }, {});

    res.json(grouped);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/progress/:clientId
// Add a manual progress entry — append-only, never editable per spec
// Body: { metricName, value, unit, date, notes }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { metricName, value, unit, date, notes } = req.body;

    if (!metricName) return res.status(400).json({ error: 'metricName is required' });
    if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });
    if (!unit)       return res.status(400).json({ error: 'unit is required' });
    if (!date)       return res.status(400).json({ error: 'date is required' });

    const { rows: [cl] } = await pool.query(
      'SELECT id FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!cl) return res.status(404).json({ error: 'Client not found' });

    const { rows: [entry] } = await pool.query(
      `INSERT INTO progress_entries
         (tenant_id, client_id, metric_name, value, unit, date, notes, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manual') RETURNING *`,
      [tenantId, clientId, metricName.trim(), value, unit.trim(), date, notes || null]
    );
    res.status(201).json(entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/progress/:clientId/:entryId
// Only manual entries can be deleted — derived entries are historical records
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:clientId/:entryId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId, entryId } = req.params;

    const { rowCount } = await pool.query(
      `DELETE FROM progress_entries
       WHERE id=$1 AND client_id=$2 AND tenant_id=$3 AND source='manual'`,
      [entryId, clientId, tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Entry not found or not deletable' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
