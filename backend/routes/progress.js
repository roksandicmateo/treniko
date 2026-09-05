// backend/routes/progress.js
const express = require('express');
const { sendDbClientError } = require('../utils/dbErrors');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { attachUuidParamGuards } = require('../utils/routeGuards');
const { isUuid, parseBoundedInt } = require('../utils/validation');

router.use(authenticateToken);

// A malformed UUID in the path answers 404 instead of reaching PostgreSQL
// and surfacing as a 500 (see utils/routeGuards.js).
attachUuidParamGuards(router);

// ── GET /api/progress/client/:clientId ───────────────────────────────────────
router.get('/client/:clientId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId }  = req.params;
    // Bounded: an unparseable value produced NaN and a 500, and an arbitrarily
    // large one scanned the client's entire history on every call.
    const months = parseBoundedInt(req.query.months, { fallback: 6, max: 120 });

    const since = new Date();
    since.setMonth(since.getMonth() - months);
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

    // Summary stats for the period.
    //
    // ── What was wrong ────────────────────────────────────────────────────────
    // This was a single flat query that joined trainings -> training_exercises
    // -> training_sets and then summed the *training's* duration:
    //
    //     SUM(EXTRACT(EPOCH FROM (t.end_time - t.start_time))/3600)
    //     FROM trainings t JOIN training_exercises te … JOIN training_sets ts …
    //
    // The join multiplies each training into one row per set, so its duration
    // was added once per set. Eight one-hour sessions of three exercises × three
    // sets reported **72.0 h** instead of 8.0 — and the error grew with the
    // amount of work logged, which is the opposite of what a progress screen
    // should do.
    //
    // ── The fix ───────────────────────────────────────────────────────────────
    // Count each thing over the grain it belongs to. `logged` holds one row per
    // training, so its duration is summed exactly once no matter how many sets
    // hang off it; `set_rows` holds one row per set, which is the right grain
    // for the set and exercise counts. Nothing is divided by anything.
    //
    // The population is unchanged on purpose: as before, a completed training
    // counts only once it has at least one logged set. That keeps every tile
    // except Total Hours reporting exactly what it reported before.
    const { rows: [stats] } = await pool.query(`
      WITH logged AS (
        SELECT t.id, t.start_time, t.end_time
        FROM trainings t
        WHERE t.client_id    = $1
          AND t.tenant_id    = $2
          AND t.is_completed = true
          AND t.start_time  >= $3
          AND EXISTS (
            SELECT 1
            FROM training_exercises te
            JOIN training_sets ts ON ts.training_exercise_id = te.id
            WHERE te.training_id = t.id
          )
      ),
      set_rows AS (
        SELECT te.exercise_id, ts.id
        FROM logged l
        JOIN training_exercises te ON te.training_id = l.id
        JOIN training_sets ts      ON ts.training_exercise_id = te.id
      )
      SELECT
        (SELECT COUNT(*) FROM logged)::int                        AS total_sessions,
        (SELECT COUNT(DISTINCT exercise_id) FROM set_rows)::int    AS unique_exercises,
        COALESCE(
          (SELECT SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600) FROM logged),
          0
        )::numeric(10,1)                                           AS total_hours,
        (SELECT COUNT(*) FROM set_rows)::int                       AS total_sets
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
    if (sendDbClientError(res, e)) return;
    console.error('Progress error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/progress/overview ───────────────────────────────────────────────
router.get('/overview', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const months = parseBoundedInt(req.query.months, { fallback: 1, max: 120 });

    const since = new Date();
    since.setMonth(since.getMonth() - months);
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
    if (sendDbClientError(res, e)) return;
    console.error('Overview error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── GET /api/progress/:clientId/strength ─────────────────────────────────────
//
// Response contract — depended on by BOTH `StrengthProgress` and `PRSummary`:
//
//   {
//     "<exercise name>": {
//       "category": string | null,
//       "entries": [                       // chronological, oldest first
//         { "date": "YYYY-MM-DD",
//           "maxWeight": number,           // heaviest working set that day
//           "maxReps": number | null,
//           "estOneRM": number,            // best Epley estimate of the day
//           "totalVolume": number,         // Σ reps × weight
//           "setCount": number }
//       ]
//     }
//   }
//
// ── What was wrong ───────────────────────────────────────────────────────────
// The handler returned `{ "<exercise name>": [ …raw snake_case rows… ] }` — a
// bare array per exercise, with no `entries`, no `category`, and none of the
// derived numbers. Both components read `exercise.entries`, and on an array
// that resolves to **`Array.prototype.entries`**: a function, which is truthy,
// so the `|| []` fallback never fired and the next line threw
//
//     TypeError: entries.map is not a function
//
// taking the whole Progress section down behind the error boundary. `PRSummary`
// hit the same trap one line later with `.reduce`. Two independent consumers
// agreeing on a shape the server never sent is what makes this the server's
// bug, so the fix is here: the endpoint now returns the shape its consumers
// document, with the per-session numbers computed in SQL where the sets are.
//
// Only working sets count, which is what the endpoint has always claimed to
// mean ("working sets only" in the client) and what the personal-records query
// above already does. `set_type` defaults to 'working', so a row that predates
// the column is included rather than silently dropped.
router.get('/:clientId/strength', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;
    const months = parseBoundedInt(req.query.months, { fallback: 6, max: 120 });

    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceStr = since.toISOString().split('T')[0];

    const { rows } = await pool.query(`
      SELECT
        COALESCE(e.name, te.exercise_name, 'Unknown') AS exercise_name,
        MIN(e.category)                               AS category,
        DATE(t.start_time)::text                      AS session_date,
        MAX(ts.weight)::float                         AS max_weight,
        MAX(ts.reps)::int                             AS max_reps,
        -- Epley, per set, best of the day. Reps are capped at 30 the same way
        -- the client's own helper caps them; the formula degrades badly beyond
        -- that and a 50-rep set is not a strength record.
        MAX(ts.weight * (1 + LEAST(COALESCE(ts.reps, 0), 30) / 30.0))::float AS est_one_rm,
        COALESCE(SUM(COALESCE(ts.reps, 0) * ts.weight), 0)::float            AS total_volume,
        COUNT(ts.id)::int                             AS set_count
      FROM trainings t
      JOIN training_exercises te ON te.training_id = t.id
      LEFT JOIN exercises e ON e.id = te.exercise_id
      JOIN training_sets ts ON ts.training_exercise_id = te.id
      WHERE t.client_id=$1 AND t.tenant_id=$2
        AND t.is_completed=true
        AND DATE(t.start_time) >= $3
        AND ts.weight IS NOT NULL
        AND COALESCE(ts.set_type, 'working') IN ('working', 'topset', 'amrap')
      GROUP BY COALESCE(e.name, te.exercise_name, 'Unknown'), DATE(t.start_time)
      ORDER BY exercise_name, session_date
    `, [clientId, tenantId, sinceStr]);

    // `Object.create(null)` rather than `{}`: exercise names are user-supplied
    // keys, and a client who names an exercise "constructor" should get a data
    // row, not a collision with Object.prototype.
    const grouped = Object.create(null);
    for (const row of rows) {
      if (!grouped[row.exercise_name]) {
        grouped[row.exercise_name] = { category: row.category || null, entries: [] };
      }
      grouped[row.exercise_name].entries.push({
        date:        row.session_date,
        maxWeight:   row.max_weight,
        maxReps:     row.max_reps,
        estOneRM:    row.est_one_rm,
        totalVolume: row.total_volume,
        setCount:    row.set_count,
      });
    }
    res.json(grouped);
  } catch (e) {
    if (sendDbClientError(res, e)) return;
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

    // `date::text`, not the DATE column as the driver parses it: a DATE becomes
    // a JS Date at LOCAL midnight, which serialises to the previous day's
    // 22:00Z east of Greenwich — so a measurement taken on the 16th arrived in
    // the chart as the 15th. A calendar date has no instant to convert.
    //
    // The ordering is newest-first for the history table, and made total with
    // created_at and id: `ORDER BY date DESC` alone leaves same-day entries in
    // whatever order the executor produces, which is not a contract the
    // frontend can build a trend on. It sorts chronologically for itself
    // regardless (see ProgressChart) — this only makes the input stable.
    let query = `SELECT id, tenant_id, client_id, metric_name, value, unit,
                        date::text AS date, notes, source, created_at
                   FROM progress_entries WHERE client_id=$1 AND tenant_id=$2`;
    const params = [clientId, tenantId];
    if (metric) { query += ` AND metric_name=$3`; params.push(metric); }
    query += ` ORDER BY date DESC, created_at DESC, id DESC`;

    const { rows } = await pool.query(query, params);
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.metric_name]) grouped[row.metric_name] = [];
      grouped[row.metric_name].push(row);
    });
    res.json(grouped);
  } catch (e) {
    if (sendDbClientError(res, e)) return;
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

    // TR-MED-7. The row was stamped with the caller's tenant_id but clientId
    // came from the URL unverified, so a trainer could file progress entries
    // against a client id belonging to another tenant. The sibling GET handler
    // has always performed this check; the insert did not.
    if (!isUuid(clientId)) return res.status(400).json({ error: 'Invalid client id' });

    const { rows: [client] } = await pool.query(
      'SELECT id FROM clients WHERE id=$1 AND tenant_id=$2',
      [clientId, tenantId]
    );
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { rows: [entry] } = await pool.query(
      `INSERT INTO progress_entries (tenant_id, client_id, metric_name, value, unit, date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, clientId, finalMetricName, value, unit || 'kg', date || new Date().toISOString().split('T')[0], notes || null]
    );
    res.status(201).json({ success: true, entry });
  } catch (e) {
    if (sendDbClientError(res, e)) return;
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
    if (sendDbClientError(res, e)) return;
    console.error('Progress delete error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
