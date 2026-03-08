const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/exercises?search=bench&category=Strength
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    const { tenantId } = req.user;
    let query = 'SELECT * FROM exercises WHERE tenant_id = $1';
    const params = [tenantId];
    if (search)   { params.push(`%${search}%`);  query += ` AND name ILIKE $${params.length}`; }
    if (category) { params.push(category);        query += ` AND category = $${params.length}`; }
    query += ' ORDER BY name ASC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/exercises
router.post('/', async (req, res) => {
  try {
    const { name, category, defaultUnit, description } = req.body;
    const { tenantId } = req.user;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await pool.query(
      `INSERT INTO exercises (tenant_id, name, category, default_unit, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [tenantId, name.trim(), category || 'Strength', defaultUnit || 'Kg', description || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/exercises/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, defaultUnit, description } = req.body;
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      `UPDATE exercises SET name=$1, category=$2, default_unit=$3, description=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [name, category, defaultUnit, description, req.params.id, tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/exercises/:id
router.delete('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rowCount } = await pool.query(
      'DELETE FROM exercises WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    if (e.code === '23503') return res.status(400).json({ error: 'Exercise is used in trainings and cannot be deleted' });
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
