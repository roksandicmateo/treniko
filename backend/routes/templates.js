const express = require('express');
const router  = express.Router();
const { pool, getClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM training_templates WHERE tenant_id=$1 ORDER BY name',
      [req.user.tenantId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/templates/:id
router.get('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows: [tmpl] } = await pool.query(
      'SELECT * FROM training_templates WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!tmpl) return res.status(404).json({ error: 'Not found' });

    const { rows: exRows } = await pool.query(
      `SELECT te.*, e.name AS exercise_name, e.category, e.default_unit
       FROM template_exercises te
       JOIN exercises e ON e.id = te.exercise_id
       WHERE te.template_id=$1 ORDER BY te.sort_order`,
      [req.params.id]
    );
    for (const ex of exRows) {
      const { rows: sets } = await pool.query(
        'SELECT * FROM template_sets WHERE template_exercise_id=$1 ORDER BY sort_order',
        [ex.id]
      );
      ex.sets = sets;
    }
    tmpl.exercises = exRows;
    res.json(tmpl);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/templates
router.post('/', async (req, res) => {
  const { tenantId } = req.user;
  const { name, workoutType, notes, exercises } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const { rows: [tmpl] } = await dbClient.query(
      `INSERT INTO training_templates (tenant_id, name, workout_type, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, name.trim(), workoutType || 'Gym', notes || null]
    );
    if (exercises && exercises.length > 0) {
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        const { rows: [te] } = await dbClient.query(
          `INSERT INTO template_exercises (template_id, exercise_id, sort_order, notes)
           VALUES ($1,$2,$3,$4) RETURNING *`,
          [tmpl.id, ex.exerciseId, i, ex.notes || null]
        );
        if (ex.sets) {
          for (let j = 0; j < ex.sets.length; j++) {
            const s = ex.sets[j];
            await dbClient.query(
              `INSERT INTO template_sets (template_exercise_id, sort_order, reps, weight, duration_seconds, distance, rpe)
               VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [te.id, j, s.reps || null, s.weight || null, s.durationSeconds || null, s.distance || null, s.rpe || null]
            );
          }
        }
      }
    }
    await dbClient.query('COMMIT');
    res.status(201).json(tmpl);
  } catch (e) {
    await dbClient.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    dbClient.release();
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rowCount } = await pool.query(
      'DELETE FROM training_templates WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
