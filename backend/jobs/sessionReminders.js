'use strict';

/**
 * The reminder the evening before.
 *
 * ── Why this job exists ──────────────────────────────────────────────────────
 * It is the first thing TRENIKO ever sends to a client, and it is the reason a
 * trainer would stop opening WhatsApp every evening. A no-show costs a paid
 * hour; the message that prevents it is one the trainer is already sending by
 * hand, one client at a time.
 *
 * ── How the window works ─────────────────────────────────────────────────────
 * A session is stored as a calendar date and two wall-clock times in the
 * TRAINER's zone (`users.timezone`), which is the only correct reading of
 * "18:00" — see utils/wallClock.js and utils/trainerTime.js. The instant it
 * actually starts is therefore `(date + time) AT TIME ZONE <trainer zone>`, and
 * a reminder is due when that instant is roughly a day away.
 *
 * The window is deliberately wider (23–25 hours) than the hourly tick that
 * drives it, so a late or skipped run still catches the session rather than
 * stepping over it. Sending twice is prevented by the database, not by the
 * width of the window: `session_reminders` is unique per (session, client,
 * channel), so the second attempt conflicts and does nothing.
 *
 * ── What is deliberately not sent ────────────────────────────────────────────
 *   cancelled / no-show / completed sessions   nothing to remind anybody of
 *   clients with no email address              nothing to send to
 *   clients who opted out                      their decision, recorded
 *   trainers who turned reminders off          their decision, recorded
 *   sessions already reminded                  the unique constraint
 *
 * Rescheduling deletes the reminder row (sessionsController), so a session
 * moved to a new day is reminded again for the new time — a client told 18:00
 * must be told 19:00.
 */

const { pool } = require('../config/database');
const { runWithTenantContext } = require('../config/tenantContext');
const { sendSessionReminderEmail } = require('../services/emailService');
const { captureError } = require('../config/errorMonitor');

/** How far ahead a session has to be to be worth a reminder. */
const WINDOW_START_HOURS = 23;
const WINDOW_END_HOURS = 25;

/**
 * Everything due for ONE tenant.
 *
 * ── Why it is per tenant ─────────────────────────────────────────────────────
 * `training_sessions`, `clients` and `users` are all behind row-level security,
 * and a query with no tenant context matches nothing — not an error, just an
 * empty result. A background job that reads them therefore has to establish a
 * context per tenant, exactly as jobs/deletionJob.js does for deletions. The
 * first version of this job read every tenant in one statement and silently
 * found no reminders at all, which is precisely the failure mode RLS is
 * designed to produce for a query that forgot who it is asking as.
 *
 * The explicit `tenant_id = $1` filters are kept as well. RLS is the backstop,
 * not the control — the same convention every controller here follows.
 */
const findDueForTenant = async (tenantId) =>
  runWithTenantContext({ tenantId }, async () => {
    const { rows } = await pool.query(
      `SELECT
         ts.id            AS session_id,
         ts.tenant_id,
         ts.session_date::text AS session_date,
         ts.start_time::text   AS start_time,
         ts.end_time::text     AS end_time,
         ts.session_type,
         c.id             AS client_id,
         c.first_name     AS client_first_name,
         c.email          AS client_email,
         u.id             AS trainer_id,
         u.first_name     AS trainer_first_name,
         u.last_name      AS trainer_last_name,
         u.email          AS trainer_email,
         u.language       AS trainer_language,
         u.timezone       AS trainer_timezone
       FROM training_sessions ts
       JOIN clients c ON c.id = ts.client_id AND c.tenant_id = ts.tenant_id
       JOIN LATERAL (
         -- The tenant's trainer. Multi-seat tenants are not a thing yet; the
         -- oldest account is the owner, and it is their name on the message.
         SELECT id, first_name, last_name, email, language, timezone,
                session_reminders_enabled
           FROM users
          WHERE tenant_id = ts.tenant_id
          ORDER BY created_at ASC
          LIMIT 1
       ) u ON true
       WHERE ts.tenant_id = $1
         AND ts.status = 'scheduled'
         AND c.email IS NOT NULL
         AND c.email <> ''
         AND c.reminders_opt_out = false
         AND c.is_active = true
         AND u.session_reminders_enabled = true
         AND ((ts.session_date + ts.start_time) AT TIME ZONE u.timezone)
               BETWEEN NOW() + ($2 || ' hours')::interval
                   AND NOW() + ($3 || ' hours')::interval
         AND NOT EXISTS (
           SELECT 1 FROM session_reminders sr
            WHERE sr.session_id = ts.id
              AND sr.client_id = c.id
              AND sr.channel = 'email'
         )
       ORDER BY ts.session_date, ts.start_time`,
      [tenantId, WINDOW_START_HOURS, WINDOW_END_HOURS]
    );
    return rows;
  });

/**
 * Every tenant that could have a reminder due.
 *
 * `tenants` sits outside row-level security by design (registration happens
 * before a tenant exists), so this one read needs no context. Tenants with a
 * pending deletion are skipped: sending a client an email on behalf of an
 * account that is being erased is not something to do.
 */
const activeTenantIds = async () => {
  const { rows } = await pool.query(
    `SELECT t.id
       FROM tenants t
      WHERE EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id)
        AND NOT EXISTS (
          SELECT 1 FROM deletion_requests dr
           JOIN users u2 ON u2.id = dr.trainer_id
          WHERE u2.tenant_id = t.id
            AND dr.target_type = 'account'
            AND dr.status = 'pending'
        )`
  );
  return rows.map((r) => r.id);
};

/**
 * Everything due, across every tenant.
 *
 * One query per tenant. At beta scale that is a few dozen small indexed reads
 * an hour; if the tenant count ever makes that the wrong shape, the fix is a
 * single query run as a role that may read across tenants — not dropping the
 * context, which would silently return nothing.
 */
const findDueReminders = async () => {
  const tenantIds = await activeTenantIds();
  const due = [];
  for (const tenantId of tenantIds) {
    try {
      due.push(...await findDueForTenant(tenantId));
    } catch (err) {
      // One tenant's bad data must not stop every other tenant's reminders.
      captureError(err, { job: 'sessionReminders', tenantId, outcome: 'tenant_query_failed' });
    }
  }
  return due;
};

/**
 * Claim a reminder before sending it.
 *
 * The row goes in first, inside the tenant's context. If two processes run the
 * job at once — two PM2 instances, a manual run during the cron tick — the
 * second one's INSERT conflicts and it sends nothing. Claiming after sending
 * would mean a crash between the two sends the client a second message.
 *
 * @returns {Promise<boolean>} true if this process owns the send
 */
const claimReminder = async (row) =>
  runWithTenantContext({ tenantId: row.tenant_id, userId: row.trainer_id }, async () => {
    const { rows } = await pool.query(
      `INSERT INTO session_reminders (tenant_id, session_id, client_id, channel, status)
       VALUES ($1, $2, $3, 'email', 'sent')
       ON CONFLICT (session_id, client_id, channel) DO NOTHING
       RETURNING id`,
      [row.tenant_id, row.session_id, row.client_id]
    );
    return rows.length > 0;
  });

/** Record that a claimed send failed, so it is visible rather than lost. */
const markFailed = async (row, message) =>
  runWithTenantContext({ tenantId: row.tenant_id, userId: row.trainer_id }, async () => {
    await pool.query(
      `UPDATE session_reminders
          SET status = 'failed', error = $1
        WHERE session_id = $2 AND client_id = $3 AND channel = 'email'`,
      [String(message).slice(0, 500), row.session_id, row.client_id]
    );
  });

/**
 * Send every reminder that is due.
 *
 * One failure never stops the run: the client whose mail server is down must
 * not cost the other twenty their reminder.
 *
 * @returns {Promise<{due: number, sent: number, failed: number}>}
 */
const sendDueReminders = async () => {
  let due = [];
  try {
    due = await findDueReminders();
  } catch (err) {
    captureError(err, { job: 'sessionReminders', outcome: 'query_failed' });
    return { due: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    let claimed = false;
    try {
      claimed = await claimReminder(row);
      if (!claimed) continue;

      await sendSessionReminderEmail({
        to: row.client_email,
        clientFirstName: row.client_first_name,
        trainerName: `${row.trainer_first_name} ${row.trainer_last_name}`.trim(),
        trainerEmail: row.trainer_email,
        sessionDate: row.session_date,
        startTime: row.start_time,
        endTime: row.end_time,
        sessionType: row.session_type,
        language: ['hr', 'en', 'de'].includes(row.trainer_language) ? row.trainer_language : 'hr',
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      if (claimed) await markFailed(row, err.message).catch(() => {});
      captureError(err, {
        job: 'sessionReminders',
        tenantId: row.tenant_id,
        outcome: 'send_failed',
      });
    }
  }

  if (due.length > 0) {
    console.log(`[reminders] due=${due.length} sent=${sent} failed=${failed}`);
  }
  return { due: due.length, sent, failed };
};

module.exports = {
  sendDueReminders, findDueReminders, findDueForTenant,
  WINDOW_START_HOURS, WINDOW_END_HOURS,
};
