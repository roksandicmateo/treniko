const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/progress/:clientId?metric=Weight&from=2024-01-01&to=2024-12-31
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

    let q = 'SELECT * FROM progress_entries WHERE client_id=$1 AND tenant_id=$2';
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

// POST /api/progress/:clientId
router.post('/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const { metricName, value, unit, date, notes } = req.body;

    if (!metricName)              return res.status(400).json({ error: 'metricName is required' });
    if (value === undefined || value === null) return res.status(400).json({ error: 'value is required' });
    if (!unit)                    return res.status(400).json({ error: 'unit is required' });
    if (!date)                    return res.status(400).json({ error: 'date is required' });

    const { rows: [cl] } = await pool.query(
      'SELECT id FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!cl) return res.status(404).json({ error: 'Client not found' });

    const { rows: [entry] } = await pool.query(
      `INSERT INTO progress_entries (tenant_id, client_id, metric_name, value, unit, date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, clientId, metricName.trim(), value, unit.trim(), date, notes || null]
    );
    res.status(201).json(entry);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
