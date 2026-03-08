const express = require('express');
const router  = express.Router();
const { pool, getClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// ─── Helper: load full training with exercises + sets ─────────────────────────
async function loadFull(trainingId, tenantId, client) {
  const { rows: [t] } = await client.query(
    `SELECT t.*, c.first_name, c.last_name, c.email
     FROM trainings t
     JOIN clients c ON c.id = t.client_id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [trainingId, tenantId]
  );
  if (!t) return null;

  const { rows: exRows } = await client.query(
    `SELECT te.*, e.name AS exercise_name, e.category, e.default_unit
     FROM training_exercises te
     JOIN exercises e ON e.id = te.exercise_id
     WHERE te.training_id = $1
     ORDER BY te.sort_order`,
    [trainingId]
  );

  for (const ex of exRows) {
    const { rows: sets } = await client.query(
      'SELECT * FROM training_sets WHERE training_exercise_id = $1 ORDER BY sort_order',
      [ex.id]
    );
    ex.sets = sets;
  }

  t.exercises = exRows;
  return t;
}

// ─── Helper: insert exercises + sets ─────────────────────────────────────────
async function insertExercises(client, trainingId, exercises) {
  if (!exercises || exercises.length === 0) return;
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const { rows: [te] } = await client.query(
      `INSERT INTO training_exercises (training_id, exercise_id, sort_order, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [trainingId, ex.exerciseId, i, ex.notes || null]
    );
    if (ex.sets && ex.sets.length > 0) {
      for (let j = 0; j < ex.sets.length; j++) {
        const s = ex.sets[j];
        await client.query(
          `INSERT INTO training_sets
             (training_exercise_id, sort_order, reps, weight, duration_seconds, distance, rpe, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [te.id, j,
           s.reps            || null,
           s.weight          || null,
           s.durationSeconds || null,
           s.distance        || null,
           s.rpe             || null,
           s.notes           || null]
        );
      }
    }
  }
}

// GET /api/trainings?clientId=&from=&to=
router.get('/', async (req, res) => {
  try {
    const { clientId, from, to } = req.query;
    const { tenantId } = req.user;
    let q = `SELECT t.*, c.first_name, c.last_name
             FROM trainings t
             JOIN clients c ON c.id = t.client_id
             WHERE t.tenant_id = $1`;
    const p = [tenantId];
    if (clientId) { p.push(clientId); q += ` AND t.client_id = $${p.length}`; }
    if (from)     { p.push(from);     q += ` AND t.start_time >= $${p.length}`; }
    if (to)       { p.push(to);       q += ` AND t.start_time <= $${p.length}`; }
    q += ' ORDER BY t.start_time DESC';
    const { rows } = await pool.query(q, p);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trainings/:id
router.get('/:id', async (req, res) => {
  try {
    const t = await loadFull(req.params.id, req.user.tenantId, pool);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trainings
router.post('/', async (req, res) => {
  const { tenantId } = req.user;
  const { clientId, title, workoutType, startTime, endTime, notes, location, exercises } = req.body;

  if (!clientId)  return res.status(400).json({ error: 'clientId is required' });
  if (!startTime) return res.status(400).json({ error: 'startTime is required' });
  if (!endTime)   return res.status(400).json({ error: 'endTime is required' });

  // Verify client belongs to this tenant and is active
  const { rows: [cl] } = await pool.query(
    'SELECT id, is_active FROM clients WHERE id=$1 AND tenant_id=$2',
    [clientId, tenantId]
  );
  if (!cl)           return res.status(404).json({ error: 'Client not found' });
  if (!cl.is_active) return res.status(400).json({ error: 'Client is inactive' });

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const { rows: [training] } = await dbClient.query(
      `INSERT INTO trainings (tenant_id, client_id, title, workout_type, start_time, end_time, notes, location, session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, clientId, title || null, workoutType || 'Gym', startTime, endTime, notes || null, location || null, req.body.sessionId || null]
    );
    await insertExercises(dbClient, training.id, exercises);
    await dbClient.query('COMMIT');
    const full = await loadFull(training.id, tenantId, dbClient);
    res.status(201).json(full);
  } catch (e) {
    await dbClient.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    dbClient.release();
  }
});

// PUT /api/trainings/:id
router.put('/:id', async (req, res) => {
  const { tenantId } = req.user;
  const { title, workoutType, startTime, endTime, notes, location, exercises, isCompleted } = req.body;

  const dbClient = await getClient();
  try {
    await dbClient.query('BEGIN');
    const { rows: [existing] } = await dbClient.query(
      'SELECT * FROM trainings WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (!existing) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    await dbClient.query(
      `UPDATE trainings SET
         title=$1, workout_type=$2, start_time=$3, end_time=$4,
         notes=$5, location=$6, is_completed=$7, updated_at=NOW()
       WHERE id=$8`,
      [
        title       !== undefined ? title       : existing.title,
        workoutType !== undefined ? workoutType : existing.workout_type,
        startTime   !== undefined ? startTime   : existing.start_time,
        endTime     !== undefined ? endTime     : existing.end_time,
        notes       !== undefined ? notes       : existing.notes,
        location    !== undefined ? location    : existing.location,
        isCompleted !== undefined ? isCompleted : existing.is_completed,
        req.params.id,
      ]
    );
    if (exercises !== undefined) {
      await dbClient.query('DELETE FROM training_exercises WHERE training_id=$1', [req.params.id]);
      await insertExercises(dbClient, req.params.id, exercises);
    }
    await dbClient.query('COMMIT');
    const full = await loadFull(req.params.id, tenantId, dbClient);
    res.json(full);
  } catch (e) {
    await dbClient.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally {
    dbClient.release();
  }
});

// DELETE /api/trainings/:id
router.delete('/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rowCount } = await pool.query(
      'DELETE FROM trainings WHERE id=$1 AND tenant_id=$2',
      [req.params.id, tenantId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// GET /api/trainings/by-session/:sessionId
router.get('/by-session/:sessionId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      `SELECT t.*, c.first_name, c.last_name
       FROM trainings t
       JOIN clients c ON c.id = t.client_id
       WHERE t.session_id = $1 AND t.tenant_id = $2`,
      [req.params.sessionId, tenantId]
    );
    res.json(rows[0] || null);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});
