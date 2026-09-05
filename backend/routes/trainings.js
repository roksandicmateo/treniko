const express = require('express');
const { sendDbClientError } = require('../utils/dbErrors');
const router  = express.Router();
const { pool, getClient } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { attachUuidParamGuards } = require('../utils/routeGuards');
const { verifyExercisesOwned } = require('../utils/ownership');
const { isUuid } = require('../utils/validation');
const { wallClockSelect, applyWallClock, applyWallClockToAll } = require('../utils/wallClock');

router.use(authenticateToken);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500 (see utils/routeGuards.js).
attachUuidParamGuards(router);

// ─── Helper: load full training with exercises + sets ─────────────────────────
// Accepts either a pool or a checked-out client
async function loadFull(trainingId, tenantId, db) {
  const { rows: [t] } = await db.query(
    `SELECT t.*, ${wallClockSelect('t')}, c.first_name, c.last_name, c.email
     FROM trainings t
     JOIN clients c ON c.id = t.client_id
     WHERE t.id = $1 AND t.tenant_id = $2`,
    [trainingId, tenantId]
  );
  if (!t) return null;
  applyWallClock(t);

  const { rows: exRows } = await db.query(
    `SELECT te.*, e.name AS exercise_name, e.category, e.default_unit
     FROM training_exercises te
     JOIN exercises e ON e.id = te.exercise_id
     WHERE te.training_id = $1
     ORDER BY te.sort_order`,
    [trainingId]
  );

  // One query for every set in the training, not one per exercise. A programme
  // with twelve exercises used to cost thirteen round trips to render, and the
  // count grew with the size of the workout — so the slowest page was the one a
  // trainer opens with a client standing in front of them.
  if (exRows.length > 0) {
    const { rows: setRows } = await db.query(
      `SELECT * FROM training_sets
        WHERE training_exercise_id = ANY($1::uuid[])
        ORDER BY training_exercise_id, sort_order`,
      [exRows.map(ex => ex.id)]
    );

    const setsByExercise = new Map();
    for (const set of setRows) {
      const list = setsByExercise.get(set.training_exercise_id);
      if (list) list.push(set);
      else setsByExercise.set(set.training_exercise_id, [set]);
    }
    for (const ex of exRows) {
      ex.sets = setsByExercise.get(ex.id) || [];
    }
  }

  t.exercises = exRows;
  return t;
}

// ─── Helper: insert exercises + sets ─────────────────────────────────────────
async function insertExercises(dbClient, trainingId, exercises) {
  if (!exercises || exercises.length === 0) return;
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const { rows: [te] } = await dbClient.query(
      `INSERT INTO training_exercises (training_id, exercise_id, exercise_name, sort_order, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [trainingId, ex.exerciseId, ex.exerciseName || ex.name || 'Unknown', i, ex.notes || null]
    );
    if (ex.sets && ex.sets.length > 0) {
      for (let j = 0; j < ex.sets.length; j++) {
        const s = ex.sets[j];
        await dbClient.query(
          `INSERT INTO training_sets
             (training_exercise_id, set_number, sort_order, reps, weight, duration_seconds, distance, rpe, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [te.id, j + 1, j,
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

// GET /api/trainings/by-session/:sessionId  ← MUST be before /:id
router.get('/by-session/:sessionId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { rows } = await pool.query(
      `SELECT t.*, ${wallClockSelect('t')}, c.first_name, c.last_name
       FROM trainings t
       JOIN clients c ON c.id = t.client_id
       WHERE t.session_id = $1 AND t.tenant_id = $2`,
      [req.params.sessionId, tenantId]
    );
    res.json(rows[0] ? applyWallClock(rows[0]) : null);
  } catch (e) {
    if (sendDbClientError(res, e)) return;
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trainings?clientId=&from=&to=&search=&page=&limit=
router.get('/', async (req, res) => {
  try {
    const { clientId, from, to, search } = req.query;
    const page  = Math.max(1, parseInt(req.query.page  || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50')));
    const offset = (page - 1) * limit;
    const { tenantId } = req.user;

    let q = `SELECT t.*, ${wallClockSelect('t')}, c.first_name, c.last_name
             FROM trainings t
             JOIN clients c ON c.id = t.client_id
             WHERE t.tenant_id = $1`;
    const p = [tenantId];

    if (clientId) { p.push(clientId); q += ` AND t.client_id = $${p.length}`; }
    if (from)     { p.push(from);     q += ` AND t.start_time >= $${p.length}`; }
    if (to)       { p.push(to);       q += ` AND t.start_time <= $${p.length}`; }
    if (search)   {
      p.push(`%${search.toLowerCase()}%`);
      q += ` AND (LOWER(c.first_name || ' ' || c.last_name) LIKE $${p.length} OR LOWER(t.title) LIKE $${p.length} OR LOWER(t.workout_type) LIKE $${p.length})`;
    }

    // Count total for pagination metadata
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM (${q}) sub`, p
    );
    const total = parseInt(countResult.rows[0].count);

    q += ` ORDER BY t.start_time DESC LIMIT $${p.length + 1} OFFSET $${p.length + 2}`;
    p.push(limit, offset);

    const { rows } = await pool.query(q, p);
    res.json({
      data: applyWallClockToAll(rows),
      total, page, limit, pages: Math.ceil(total / limit),
    });
  } catch (e) {
    if (sendDbClientError(res, e)) return;
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trainings/:id  — uses pool directly (pool.query works fine for reads)
router.get('/:id', async (req, res) => {
  try {
    const t = await loadFull(req.params.id, req.user.tenantId, pool);
    if (!t) return res.status(404).json({ error: 'Not found' });
    res.json(t);
  } catch (e) {
    if (sendDbClientError(res, e)) return;
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
  // Validated before it reaches Postgres: a non-UUID raised 22P02 from the
  // lookup below, which used to sit outside the try block (see next comment).
  if (!isUuid(clientId)) return res.status(400).json({ error: 'Invalid clientId' });

  // Everything that can reject lives inside this try.
  //
  // The client lookup and the ownership check used to run BEFORE it. Express 4
  // does not catch rejections from an async handler, so a rejected query here
  // became an unhandled rejection: the request received no response at all, and
  // Node's default behaviour for an unhandled rejection is to terminate the
  // process. A single POST with a malformed clientId therefore took the API
  // down — verified against a running instance, which exited with code 1.
  let dbClient;
  try {
    const { rows: [cl] } = await pool.query(
      'SELECT id, is_active FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!cl)           return res.status(404).json({ error: 'Client not found' });
    if (!cl.is_active) return res.status(400).json({ error: 'Client is inactive' });

    // Exercise references come from the request body and are written into
    // training_exercises, which is later read back through a JOIN on `exercises`
    // that has no tenant filter of its own. Validate ownership here (TR-MED-4).
    const owned = await verifyExercisesOwned(pool, exercises, tenantId);
    if (!owned.ok) return res.status(400).json({ error: owned.reason });

    dbClient = await getClient();
    await dbClient.query('BEGIN');
    const { rows: [training] } = await dbClient.query(
      `INSERT INTO trainings (tenant_id, client_id, title, workout_type, start_time, end_time, notes, location, session_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenantId, clientId, title || null, workoutType || 'Gym', startTime, endTime,
       notes || null, location || null, req.body.sessionId || null]
    );
    await insertExercises(dbClient, training.id, exercises);
    await dbClient.query('COMMIT');
    // Read back through the pool, not through `dbClient`.
    //
    // The tenant context this client carries is established by the wrapper in
    // config/database.js when the caller issues BEGIN, with SET LOCAL semantics
    // — so PostgreSQL discards it at the COMMIT above. A read issued on this
    // client afterwards therefore runs with NO tenant context, and once
    // row-level security is enforced every policy denies it: loadFull returned
    // null and the endpoint answered 201 with an empty body.
    // `pool.query` is wrapped to establish the context per query, so it is the
    // correct way to read outside an explicit transaction.
    const full = await loadFull(training.id, tenantId, pool);
    res.status(201).json(full);
  } catch (e) {
    if (dbClient) await dbClient.query('ROLLBACK').catch(() => {});
    if (sendDbClientError(res, e)) return;
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  } finally {
    if (dbClient) dbClient.release();
  }
});

// PUT /api/trainings/:id
router.put('/:id', async (req, res) => {
  const { tenantId } = req.user;
  const { title, workoutType, startTime, endTime, notes, location, exercises, isCompleted } = req.body;

  // As in POST, every await stays inside the try: an unhandled rejection here
  // would leave the request unanswered and terminate the process.
  let dbClient;
  try {
    // Same check as POST — an update can introduce foreign exercise references
    // just as easily as a create (TR-MED-4).
    const owned = await verifyExercisesOwned(pool, exercises, tenantId);
    if (!owned.ok) return res.status(400).json({ error: owned.reason });

    dbClient = await getClient();
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
    // Same reason as the create path above: the transaction-scoped tenant
    // context is gone once COMMIT has run, so this read goes through the pool.
    const full = await loadFull(req.params.id, tenantId, pool);
    res.json(full);
  } catch (e) {
    if (dbClient) await dbClient.query('ROLLBACK').catch(() => {});
    if (sendDbClientError(res, e)) return;
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  } finally {
    if (dbClient) dbClient.release();
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
    if (sendDbClientError(res, e)) return;
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
