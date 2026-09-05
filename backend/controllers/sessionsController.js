const { queryWithTenant, getClient } = require('../config/database');
const { sendDbClientError } = require('../utils/dbErrors');
const packageUsage = require('../services/packageUsageService');
const { captureError } = require('../config/errorMonitor');
const { statusConsumesSession } = packageUsage;

const SESSION_SELECT = `
  ts.id, ts.client_id,
  ts.session_date::text as session_date,
  ts.start_time, ts.end_time,
  ts.session_type, ts.notes,
  ts.is_completed, ts.status,
  ts.created_at, ts.updated_at,
  c.first_name as client_first_name,
  c.last_name as client_last_name
`;

/**
 * Run a read either on the pool (with tenant context) or inside a caller's
 * transaction. Conflict checking is used from both, and running it on the pool
 * from inside a transaction would read a snapshot that does not include the
 * caller's own uncommitted changes.
 */
const runRead = (db, tenantId) => (text, params) =>
  db ? db.query(text, params) : queryWithTenant(text, params, tenantId);

/**
 * Overlapping bookings.
 *
 * ── The remaining race, stated plainly ───────────────────────────────────────
 * This is a check followed by a write. Both now happen inside one transaction
 * (see createSession and updateSession), which is a real improvement — the
 * check reads the caller's own uncommitted changes and a failure rolls the
 * whole thing back — but READ COMMITTED does not stop two concurrent
 * transactions from each finding the slot free and both inserting.
 *
 * A database-level EXCLUDE constraint would close it, and it is deliberately
 * NOT used here, for a reason that outranks the race: overlapping sessions are
 * legitimate in this product. `force` exists precisely so a trainer can book
 * two people at once when they mean to, group sessions overlap individual ones
 * by design, and a constraint cannot tell an intentional overlap from an
 * accidental one. Enforcing it in the database would make a supported workflow
 * impossible in order to prevent something that needs two trainers, one
 * account and the same second.
 *
 * The exposure is therefore: a single trainer, two devices, the same slot,
 * within the same instant — and the outcome is a double booking they can see
 * on their own calendar and fix. Recorded here rather than left implicit; if
 * client-side booking is ever added, this becomes real and wants a partial
 * exclusion constraint over non-forced individual sessions.
 */
const checkConflicts = async (tenantId, sessionDate, startTime, endTime, excludeId = null, db = null) => {
  // Check individual sessions
  let query = `
    SELECT ts.id, ts.start_time, ts.end_time, ts.session_type,
           c.first_name, c.last_name, ts.client_id
    FROM training_sessions ts
    JOIN clients c ON ts.client_id = c.id
    WHERE ts.tenant_id = $1
      AND ts.session_date = $2
      AND ts.status NOT IN ('cancelled', 'no_show')
      AND (ts.start_time < $4 AND ts.end_time > $3)
  `;
  const params = [tenantId, sessionDate, startTime, endTime];
  if (excludeId) { query += ` AND ts.id != $${params.length + 1}`; params.push(excludeId); }
  const read = runRead(db, tenantId);
  const result = await read(query, params);

  // Also check group sessions for conflicts
  const groupQuery = `
    SELECT gs.id, gs.start_time, gs.end_time, 'group' as session_type,
           g.name as first_name, '' as last_name, null as client_id
    FROM group_sessions gs
    JOIN groups g ON g.id = gs.group_id
    WHERE gs.tenant_id = $1
      AND gs.session_date = $2
      AND gs.status NOT IN ('cancelled')
      AND (gs.start_time < $4 AND gs.end_time > $3)
  `;
  const groupResult = await read(groupQuery, [tenantId, sessionDate, startTime, endTime]);

  return [...result.rows, ...groupResult.rows];
};

// ── Package usage follows session completion ──────────────────────────────────
//
// A session-based package is the trainer's core unit of business: "10 sessions
// for 400 EUR". Completion is the event that consumes a session, so the server
// records it, in the same transaction as the status change that causes it.
//
// The bookkeeping itself lives in services/packageUsageService.js — it is
// shared with group attendance, which charges the same ledger. Three properties
// matter and all three now come from the database rather than from convention:
//
//   - atomic: the status change and the charge commit together or not at all.
//     They used to be separate statements outside any transaction, so a failure
//     between them left a charge the idempotency guard would never retry;
//   - idempotent: a partial unique index on session_id means completing an
//     already-complete session cannot consume twice;
//   - reversible: moving a session back out of a charged status releases the
//     usage it took, because a session marked complete by mistake must not
//     silently cost the client a session they never had.
//
// A failure is no longer swallowed. It rolls the whole update back and answers
// 500, because a session that says "completed" while the package says otherwise
// is worse than an error the trainer can retry.

const getSessions = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate, clientId, status } = req.query;
    let queryText = `SELECT ${SESSION_SELECT} FROM training_sessions ts JOIN clients c ON ts.client_id = c.id WHERE ts.tenant_id = $1`;
    const params = [tenantId];
    if (startDate) { queryText += ` AND ts.session_date >= $${params.length + 1}`; params.push(startDate); }
    if (endDate)   { queryText += ` AND ts.session_date <= $${params.length + 1}`; params.push(endDate); }
    if (clientId)  { queryText += ` AND ts.client_id = $${params.length + 1}`;    params.push(clientId); }
    if (status)    { queryText += ` AND ts.status = $${params.length + 1}`;       params.push(status); }
    queryText += ' ORDER BY ts.session_date, ts.start_time';
    const result = await queryWithTenant(queryText, params, tenantId);
    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while fetching sessions' });
  }
};

const getSessionById = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await queryWithTenant(
      `SELECT ${SESSION_SELECT} FROM training_sessions ts JOIN clients c ON ts.client_id = c.id WHERE ts.id = $1 AND ts.tenant_id = $2`,
      [id, tenantId], tenantId
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found', message: 'Session not found' });
    res.json({ success: true, session: result.rows[0] });
  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while fetching session' });
  }
};

/**
 * Charge every attendee of an ad-hoc group session, or the single client of an
 * ordinary one. Returns the outcome for the session as a whole: the individual
 * case reports its own, the group case reports 'charged' if anybody was
 * charged and otherwise the first reason nobody could be.
 */
const chargeSessionAttendees = async (db, { tenantId, session, actorId }) => {
  if (!session.is_group) {
    return packageUsage.chargeUsage(db, {
      tenantId, clientId: session.client_id, sessionId: session.id, actorId,
    });
  }

  const { rows: attendees } = await db.query(
    'SELECT client_id FROM session_attendees WHERE session_id = $1 AND tenant_id = $2',
    [session.id, tenantId]
  );

  const outcomes = [];
  const packages = [];
  for (const attendee of attendees) {
    const result = await packageUsage.chargeUsage(db, {
      tenantId, clientId: attendee.client_id, sessionId: session.id, actorId,
    });
    outcomes.push({ clientId: attendee.client_id, outcome: result.outcome });
    if (result.clientPackage) packages.push(result.clientPackage);
  }

  const charged = outcomes.filter((o) => o.outcome === packageUsage.OUTCOME.CHARGED);
  return {
    outcome: charged.length > 0
      ? packageUsage.OUTCOME.CHARGED
      : (outcomes[0]?.outcome || packageUsage.OUTCOME.NO_ACTIVE_PACKAGE),
    clientPackage: packages[0] || null,
    attendeeOutcomes: outcomes,
  };
};

/**
 * POST /api/sessions
 *
 * Three shapes of booking arrive here. The individual one always worked. The
 * ad-hoc group one — several clients training together without being a named
 * group — did not: `isGroup` and `attendees` were destructured from the body
 * and never used, and the handler then rejected the request for having no
 * `clientId`, which the ad-hoc form does not collect. The third mode in the
 * product's most-used modal answered 400 every single time.
 *
 * The schema for it has existed since migration 023 (`is_group`, `group_title`,
 * `session_attendees`); only the handler was missing.
 */
const createSession = async (req, res) => {
  const { tenantId, userId } = req.user;
  const {
    clientId, sessionDate, startTime, endTime, sessionType, notes, force,
    isGroup, groupTitle, attendees,
  } = req.body;

  const wantsGroup = isGroup === true || isGroup === 'true';

  if (!sessionDate || !startTime || !endTime) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Date, start time, and end time are required',
    });
  }

  // The two shapes need different things, and saying which is missing beats a
  // single message that is wrong for one of them.
  const attendeeIds = Array.isArray(attendees)
    ? [...new Set(attendees.filter((id) => typeof id === 'string'))]
    : [];

  if (wantsGroup) {
    if (attendeeIds.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'A group session needs at least one participant',
      });
    }
    if (attendeeIds.length > 50) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'A group session can hold at most 50 participants',
      });
    }
  } else if (!clientId) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Client ID, date, start time, and end time are required',
    });
  }

  const db = await getClient();
  let responded = false;

  try {
    await db.query('BEGIN');

    // Every client id in the request is checked against this tenant. For the
    // group case that is the whole guest list, in one round trip.
    const idsToVerify = wantsGroup ? attendeeIds : [clientId];
    const clientCheck = await db.query(
      'SELECT id FROM clients WHERE id = ANY($1::uuid[]) AND tenant_id = $2',
      [idsToVerify, tenantId]
    );
    if (clientCheck.rows.length !== idsToVerify.length) {
      responded = true;
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found', message: 'Client not found' });
    }

    if (!force) {
      const conflicts = await checkConflicts(tenantId, sessionDate, startTime, endTime, null, db);
      if (conflicts.length > 0) {
        responded = true;
        await db.query('ROLLBACK');
        return res.status(409).json({
          error: 'conflict',
          message: 'This time slot overlaps with an existing session',
          conflicts: conflicts.map(c => ({
            id: c.id,
            clientName: `${c.first_name} ${c.last_name}`,
            startTime: c.start_time,
            endTime: c.end_time,
            sessionType: c.session_type,
          }))
        });
      }
    }

    // `client_id` is NOT NULL on the table and stays meaningful for a group
    // session: it is the first participant, so every existing query that joins
    // through it (the calendar, client history, conflict checking) keeps
    // working. The full guest list lives in session_attendees.
    const primaryClientId = wantsGroup ? attendeeIds[0] : clientId;

    const result = await db.query(
      `INSERT INTO training_sessions
         (tenant_id, client_id, session_date, start_time, end_time, session_type, notes,
          status, is_group, group_title)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)
       RETURNING id, client_id, session_date::text AS session_date, start_time, end_time,
                 session_type, notes, is_completed, status, is_group, group_title,
                 no_show_charged, created_at, updated_at`,
      [
        tenantId, primaryClientId, sessionDate, startTime, endTime,
        sessionType || null, notes || null,
        wantsGroup,
        wantsGroup ? (groupTitle || null) : null,
      ]
    );

    const session = result.rows[0];

    if (wantsGroup) {
      for (const attendeeId of attendeeIds) {
        await db.query(
          `INSERT INTO session_attendees (session_id, client_id, tenant_id, status)
           VALUES ($1, $2, $3, 'scheduled')
           ON CONFLICT (session_id, client_id) DO NOTHING`,
          [session.id, attendeeId, tenantId]
        );
      }
    }

    const clientInfo = await db.query(
      'SELECT first_name, last_name FROM clients WHERE id = $1 AND tenant_id = $2',
      [session.client_id, tenantId]
    );

    await db.query('COMMIT');

    return res.status(201).json({
      success: true,
      session: {
        ...session,
        client_first_name: clientInfo.rows[0].first_name,
        client_last_name:  clientInfo.rows[0].last_name,
        attendee_count: wantsGroup ? attendeeIds.length : 1,
      },
    });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (responded) return;
    if (sendDbClientError(res, error)) return;
    if (error.constraint === 'check_time_order') {
      return res.status(400).json({ error: 'Validation error', message: 'End time must be after start time' });
    }
    console.error('Create session error:', error);
    return res.status(500).json({ error: 'Server error', message: 'An error occurred while creating session' });
  } finally {
    db.release();
  }
};

const updateSession = async (req, res) => {
  const { tenantId, userId } = req.user;
  const { id } = req.params;
  const {
    clientId, sessionDate, startTime, endTime, sessionType, notes,
    isCompleted, status, force, chargeNoShow,
  } = req.body;

  const validStatuses = ['scheduled', 'completed', 'cancelled', 'no_show'];
  if (status !== undefined && !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Validation error', message: 'Invalid status value' });
  }

  // The whole update runs in one transaction: the status change and the package
  // charge it triggers must land together. `getClient` establishes the tenant
  // context on BEGIN, so RLS applies exactly as it does on the pool path.
  const db = await getClient();
  let responded = false;

  try {
    await db.query('BEGIN');

    // FOR UPDATE: two requests completing the same session at once would
    // otherwise both read 'scheduled' and both try to charge it. The second
    // waits here, sees the committed status, and charges nothing.
    const checkResult = await db.query(
      'SELECT * FROM training_sessions WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [id, tenantId]
    );
    if (checkResult.rows.length === 0) {
      responded = true;
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found', message: 'Session not found' });
    }
    const existing = checkResult.rows[0];

    if (clientId) {
      const clientCheck = await db.query(
        'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2', [clientId, tenantId]
      );
      if (clientCheck.rows.length === 0) {
        responded = true;
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Not found', message: 'Client not found' });
      }
    }

    const newDate  = sessionDate || existing.session_date;
    const newStart = startTime   || existing.start_time;
    const newEnd   = endTime     || existing.end_time;
    const timeChanging = sessionDate || startTime || endTime;

    if (timeChanging && !force) {
      const conflicts = await checkConflicts(tenantId, newDate, newStart, newEnd, id, db);
      if (conflicts.length > 0) {
        responded = true;
        await db.query('ROLLBACK');
        return res.status(409).json({
          error: 'conflict',
          message: 'This time slot overlaps with an existing session',
          conflicts: conflicts.map(c => ({
            id: c.id,
            clientName: `${c.first_name} ${c.last_name}`,
            startTime: c.start_time,
            endTime: c.end_time,
            sessionType: c.session_type,
          }))
        });
      }
    }

    const updates = [];
    const params = [];
    let p = 1;

    if (clientId    !== undefined) { updates.push(`client_id = $${p++}`);    params.push(clientId); }
    if (sessionDate !== undefined) { updates.push(`session_date = $${p++}`); params.push(sessionDate); }
    if (startTime   !== undefined) { updates.push(`start_time = $${p++}`);   params.push(startTime); }
    if (endTime     !== undefined) { updates.push(`end_time = $${p++}`);     params.push(endTime); }
    if (sessionType !== undefined) { updates.push(`session_type = $${p++}`); params.push(sessionType || null); }
    if (notes       !== undefined) { updates.push(`notes = $${p++}`);        params.push(notes || null); }
    if (isCompleted !== undefined) {
      const completed = isCompleted === true || isCompleted === 'true';
      updates.push(`is_completed = $${p++}`); params.push(completed);
      if (status === undefined) { updates.push(`status = $${p++}`); params.push(completed ? 'completed' : 'scheduled'); }
    }
    if (status !== undefined) {
      updates.push(`status = $${p++}`); params.push(status);
      if (isCompleted === undefined) { updates.push(`is_completed = $${p++}`); params.push(status === 'completed'); }
    }

    if (updates.length === 0) {
      responded = true;
      await db.query('ROLLBACK');
      return res.status(400).json({ error: 'Validation error', message: 'No fields to update' });
    }

    params.push(id, tenantId);
    const result = await db.query(
      `UPDATE training_sessions SET ${updates.join(', ')} WHERE id = $${p++} AND tenant_id = $${p++}
       RETURNING id, client_id, session_date::text AS session_date, start_time, end_time,
                 session_type, notes, is_completed, status, no_show_charged, created_at, updated_at`,
      params
    );

    const session = result.rows[0];

    // ── A moved session is a new appointment ────────────────────────────────
    // The reminder row is what stops a client being told twice; if the session
    // moves after one was sent, that same row would stop them being told the
    // NEW time. Clearing it lets the job send the correction. Only the time
    // matters here — changing a note is not a reschedule.
    const rescheduled = (sessionDate !== undefined && String(sessionDate) !== String(existing.session_date))
      || (startTime !== undefined && String(startTime) !== String(existing.start_time))
      || (endTime !== undefined && String(endTime) !== String(existing.end_time));
    if (rescheduled) {
      await db.query(
        'DELETE FROM session_reminders WHERE session_id = $1 AND tenant_id = $2',
        [session.id, tenantId]
      );
    }

    // ── The charge ──────────────────────────────────────────────────────────
    // Driven by whether the OLD and the NEW status consume a session, so a move
    // from 'completed' to a charged 'no_show' is correctly a no-op rather than a
    // refund followed by a charge, and a move to 'cancelled' refunds.
    const wasCharged = statusConsumesSession(existing.status, existing.no_show_charged === true);
    const nowCharges = statusConsumesSession(session.status, chargeNoShow === true);

    let usage = null;
    if (!wasCharged && nowCharges) {
      usage = await chargeSessionAttendees(db, {
        tenantId,
        session: { ...session, is_group: existing.is_group },
        actorId: userId || null,
      });
    } else if (wasCharged && !nowCharges) {
      // clientId omitted on purpose: for an ad-hoc group session this releases
      // every attendee's charge, and for an individual one there is only ever
      // the single row.
      usage = await packageUsage.releaseUsage(db, { tenantId, sessionId: session.id });
    }

    // The decision is stored on the session so a later edit knows whether this
    // no-show was charged; without it, reopening and re-saving a charged
    // no-show would refund a session the trainer decided to keep.
    const noShowCharged = session.status === 'no_show' ? chargeNoShow === true : false;
    if (noShowCharged !== (session.no_show_charged === true)) {
      await db.query(
        'UPDATE training_sessions SET no_show_charged = $1 WHERE id = $2 AND tenant_id = $3',
        [noShowCharged, session.id, tenantId]
      );
      session.no_show_charged = noShowCharged;
    }

    const clientInfo = await db.query(
      'SELECT first_name, last_name FROM clients WHERE id = $1 AND tenant_id = $2',
      [session.client_id, tenantId]
    );

    await db.query('COMMIT');

    return res.json({
      success: true,
      session: {
        ...session,
        client_first_name: clientInfo.rows[0].first_name,
        client_last_name:  clientInfo.rows[0].last_name,
      },
      // Always present when this update changed whether the session consumes a
      // package, including when nothing could be charged. The UI needs to tell
      // "one session taken off the block" apart from "this client has no active
      // package" — before this, both answered success and looked identical.
      ...(usage ? { packageOutcome: usage.outcome, clientPackage: usage.clientPackage } : {}),
    });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (responded) return;
    if (sendDbClientError(res, error)) return;
    if (error.constraint === 'check_time_order') {
      return res.status(400).json({ error: 'Validation error', message: 'End time must be after start time' });
    }
    // Reported, not just logged: this transaction carries the package charge,
    // and a failure here is exactly the kind that stays invisible until a
    // balance is wrong weeks later.
    captureError(error, { route: 'PUT /api/sessions/:id', method: 'PUT', tenantId, outcome: 'package_charge_rolled_back' });
    return res.status(500).json({ error: 'Server error', message: 'An error occurred while updating session' });
  } finally {
    db.release();
  }
};

const deleteSession = async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const db = await getClient();
  let responded = false;

  try {
    await db.query('BEGIN');

    const checkResult = await db.query(
      'SELECT id, client_id, status, no_show_charged FROM training_sessions WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [id, tenantId]
    );
    if (checkResult.rows.length === 0) {
      responded = true;
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found', message: 'Session not found' });
    }

    // Deleting a charged session returns its package session to the client. The
    // ledger row would go anyway (ON DELETE CASCADE), but the cached counter on
    // client_packages would stay inflated with no row left to explain it — so
    // the release happens explicitly, before the delete, in the same
    // transaction.
    const row = checkResult.rows[0];
    if (statusConsumesSession(row.status, row.no_show_charged === true)) {
      await packageUsage.releaseUsage(db, { tenantId, sessionId: id });
    }

    await db.query('DELETE FROM training_sessions WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    await db.query('COMMIT');

    return res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (responded) return;
    if (sendDbClientError(res, error)) return;
    console.error('Delete session error:', error);
    return res.status(500).json({ error: 'Server error', message: 'An error occurred while deleting session' });
  } finally {
    db.release();
  }
};

module.exports = {
  getSessions, getSessionById, createSession, updateSession, deleteSession,
  statusConsumesSession,
};
