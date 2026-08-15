const express = require('express');
const router  = express.Router();
const { pool, getClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { attachUuidParamGuards } = require('../utils/routeGuards');
const { verifyExercisesOwned } = require('../utils/ownership');

router.use(authenticateToken);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500 (see utils/routeGuards.js).
attachUuidParamGuards(router);

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

  // Every await stays inside the try. Express 4 does not catch rejections from
  // an async handler: one escaping here would leave the request unanswered and
  // terminate the process.
  let dbClient;
  try {
    // Every referenced exercise must belong to this tenant (TR-MED-4). Checked
    // before the transaction opens so a rejected payload writes nothing at all.
    const owned = await verifyExercisesOwned(pool, exercises, tenantId);
    if (!owned.ok) return res.status(400).json({ error: owned.reason });

    dbClient = await getClient();
    await dbClient.query('BEGIN');
    const { rows: [tmpl] } = await dbClient.query(
      `INSERT INTO training_templates (tenant_id, name, workout_type, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [tenantId, name.trim(), workoutType || 'Gym', notes || null]
    );
    if (exercises && exercises.length > 0) {
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        // exercise_name is a legacy NOT NULL column from 005_phase2.sql that
        // migration 027 left in place; this insert never supplied it, so every
        // POST with exercises failed with 23502 (a pre-existing defect, found
        // while proving the ownership check above does not over-block). Filled
        // the same way routes/trainings.js fills its equivalent column.
        const { rows: [te] } = await dbClient.query(
          `INSERT INTO template_exercises (template_id, exercise_id, exercise_name, sort_order, notes)
           VALUES ($1,$2,$3,$4,$5) RETURNING *`,
          [tmpl.id, ex.exerciseId, ex.exerciseName || ex.name || 'Unknown', i, ex.notes || null]
        );
        if (ex.sets) {
          for (let j = 0; j < ex.sets.length; j++) {
            const s = ex.sets[j];
            // set_number is the same kind of legacy NOT NULL column as
            // exercise_name above; numbered from 1 exactly as trainings.js does.
            await dbClient.query(
              `INSERT INTO template_sets (template_exercise_id, set_number, sort_order, reps, weight, duration_seconds, distance, rpe)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [te.id, j + 1, j, s.reps || null, s.weight || null, s.durationSeconds || null, s.distance || null, s.rpe || null]
            );
          }
        }
      }
    }
    await dbClient.query('COMMIT');
    res.status(201).json(tmpl);
  } catch (e) {
    if (dbClient) await dbClient.query('ROLLBACK').catch(() => {});
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  } finally {
    if (dbClient) dbClient.release();
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
