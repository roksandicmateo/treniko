// backend/controllers/dashboardController.js

const { pool } = require('../config/database');
const { getTrainerTimezone, todayFor } = require('../utils/trainerTime');

// How long a client can go without training before the dashboard raises it.
// Three weeks is long enough not to fire on a holiday and short enough that the
// trainer can still do something about it.
const INACTIVE_DAYS = 21;

// How close to the end a package has to be before it is worth mentioning.
const EXPIRY_WARNING_DAYS = 7;
const LOW_SESSIONS_THRESHOLD = 2;

/**
 * GET /api/dashboard
 *
 * ── What this screen is for ──────────────────────────────────────────────────
 * It used to lead with four counters — active clients, sessions today, sessions
 * completed this month, active packages. None of them changes a decision. A
 * trainer opening the app between two sessions is asking one question: what do
 * I have to deal with?
 *
 * So the response leads with `attention`: a list of things that are wrong and
 * that the trainer can fix, each one carrying enough to render a row and a link
 * to the screen that fixes it. The counters are still returned — they are cheap
 * and they belong somewhere — but they are no longer the answer.
 *
 * The four things that qualify, in the order they cost money:
 *
 *   unmarked   sessions in the past still sitting at 'scheduled'. Nothing else
 *              on this screen is trustworthy until these are dealt with: every
 *              package balance and every statistic is computed from status.
 *   unpaid     payments recorded as pending. The data existed and
 *              `GET /api/billing/summary` already returned it; nothing in the
 *              product ever showed it.
 *   packages   running out of sessions or out of days.
 *   quiet      active clients who have not trained in three weeks and have
 *              nothing booked. This is the one a trainer forgets, and it is
 *              where the churn is.
 */
const getDashboard = async (req, res) => {
  const tenantId = req.user.tenantId;

  try {
    // "Today" is the trainer's calendar day, not the server's and not the
    // database's — see utils/trainerTime.js for why those three used to differ.
    const timezone = await getTrainerTimezone(req.user.userId);
    const today = await todayFor(timezone);

    const [
      todaySessionsRes,
      upcomingSessionsRes,
      expiringPackagesRes,
      statsRes,
      unmarkedRes,
      unpaidRes,
      quietClientsRes,
    ] = await Promise.all([

      // Today's sessions.
      //
      // session_date is cast to text so the API returns a calendar date
      // ("2026-08-20") rather than a timestamp: a DATE column comes back from
      // node-postgres as a JS Date at local midnight and serialises as a UTC
      // instant, which the UI then renders as the previous day.
      //
      // `status` is selected because the row component colours the marker and
      // the badge from it, and the modal opens with it.
      pool.query(
        `SELECT
           ts.id, ts.session_date::text AS session_date, ts.start_time, ts.end_time,
           ts.session_type, ts.is_completed, ts.status, ts.notes,
           ts.is_group, ts.group_title,
           c.first_name, c.last_name, c.id AS client_id
         FROM training_sessions ts
         JOIN clients c ON ts.client_id = c.id
         WHERE ts.tenant_id = $1
           AND ts.session_date = $2
         ORDER BY ts.start_time ASC`,
        [tenantId, today]
      ),

      // Upcoming sessions (next 7 days, excluding today). Cancelled and no-show
      // sessions are excluded: a session the trainer just cancelled used to sit
      // in "Upcoming this week" as though it were still on.
      pool.query(
        `SELECT
           ts.id, ts.session_date::text AS session_date, ts.start_time, ts.end_time,
           ts.session_type, ts.is_completed, ts.status, ts.notes,
           ts.is_group, ts.group_title,
           c.first_name, c.last_name, c.id AS client_id
         FROM training_sessions ts
         JOIN clients c ON ts.client_id = c.id
         WHERE ts.tenant_id = $1
           AND ts.session_date > $2::date
           AND ts.session_date <= $2::date + INTERVAL '7 days'
           AND ts.is_completed = false
           AND ts.status NOT IN ('cancelled', 'no_show')
         ORDER BY ts.session_date ASC, ts.start_time ASC
         LIMIT 8`,
        [tenantId, today]
      ),

      // Packages close to their end, by sessions or by date.
      pool.query(
        `SELECT
           cp.id, cp.package_name, cp.package_type,
           cp.sessions_used, cp.total_sessions,
           cp.end_date::text AS end_date, cp.status,
           c.first_name, c.last_name, c.id AS client_id,
           ($2::date - cp.end_date) * -1 AS days_left
         FROM client_packages cp
         JOIN clients c ON cp.client_id = c.id
         WHERE cp.tenant_id = $1
           AND cp.status = 'active'
           AND (
             (cp.end_date IS NOT NULL AND cp.end_date <= $2::date + ($3 || ' days')::interval)
             OR
             (cp.package_type = 'session_based' AND cp.total_sessions IS NOT NULL
              AND cp.total_sessions - cp.sessions_used <= $4)
           )
         ORDER BY cp.end_date ASC NULLS LAST
         LIMIT 6`,
        [tenantId, today, EXPIRY_WARNING_DAYS, LOW_SESSIONS_THRESHOLD]
      ),

      // The counters. Kept, moved down the screen.
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM clients WHERE tenant_id = $1 AND is_active = true) AS active_clients,
           (SELECT COUNT(*) FROM training_sessions WHERE tenant_id = $1 AND session_date = $2
             AND status <> 'cancelled') AS sessions_today,
           (SELECT COUNT(*) FROM training_sessions WHERE tenant_id = $1 AND is_completed = true
            AND session_date >= date_trunc('month', $2::date)) AS completed_this_month,
           (SELECT COUNT(*) FROM client_packages WHERE tenant_id = $1 AND status = 'active') AS active_packages`,
        [tenantId, today]
      ),

      // ── Attention 1: sessions that happened and were never marked ──────────
      // Limited to the last 30 days: older than that and it is history the
      // trainer is not going to reconstruct, and an endless list is one nobody
      // ever clears.
      pool.query(
        `SELECT
           ts.id, ts.session_date::text AS session_date, ts.start_time, ts.end_time,
           ts.session_type, ts.status, ts.notes, ts.is_group, ts.group_title,
           c.first_name, c.last_name, c.id AS client_id
         FROM training_sessions ts
         JOIN clients c ON ts.client_id = c.id
         WHERE ts.tenant_id = $1
           AND ts.session_date < $2::date
           AND ts.session_date >= $2::date - INTERVAL '30 days'
           AND ts.status = 'scheduled'
         ORDER BY ts.session_date DESC, ts.start_time DESC
         LIMIT 10`,
        [tenantId, today]
      ),

      // ── Attention 2: money that has not arrived ────────────────────────────
      pool.query(
        `SELECT
           p.id, p.amount, p.currency, p.payment_date::text AS payment_date,
           p.payment_method, p.note,
           ($2::date - p.payment_date) AS days_outstanding,
           c.first_name, c.last_name, c.id AS client_id
         FROM client_payments p
         JOIN clients c ON p.client_id = c.id
         WHERE p.tenant_id = $1
           AND p.status = 'pending'
         ORDER BY p.payment_date ASC
         LIMIT 10`,
        [tenantId, today]
      ),

      // ── Attention 3: clients who have gone quiet ───────────────────────────
      // Active, not archived, nothing booked ahead, and either no session for
      // three weeks or none ever.
      //
      // "Last session" comes from `client_statistics`, which is now the single
      // definition of it (migrations 042 and 043): the most recent COMPLETED
      // session dated today or earlier. This panel used to read the
      // denormalised `clients.last_session_date` column instead, which counted
      // *any* session of *any* status — so one booking for next week was enough
      // to make a client who had not trained in two months look active, and this
      // panel silently hid the very clients it exists to surface.
      pool.query(
        `SELECT
           c.id AS client_id, c.first_name, c.last_name,
           cs.last_session_date::text AS last_session_date,
           CASE WHEN cs.last_session_date IS NULL THEN NULL
                ELSE ($2::date - cs.last_session_date)
           END AS days_since
         FROM clients c
         LEFT JOIN client_statistics cs
                ON cs.client_id = c.id
               AND cs.tenant_id = c.tenant_id
         WHERE c.tenant_id = $1
           AND c.is_active = true
           AND c.is_archived = false
           AND (cs.last_session_date IS NULL OR cs.last_session_date < $2::date - ($3 || ' days')::interval)
           AND NOT EXISTS (
             SELECT 1 FROM training_sessions ts
              WHERE ts.client_id = c.id
                AND ts.tenant_id = $1
                AND ts.session_date >= $2::date
                AND ts.status = 'scheduled'
           )
         ORDER BY cs.last_session_date ASC NULLS FIRST
         LIMIT 10`,
        [tenantId, today, INACTIVE_DAYS]
      ),
    ]);

    const unpaidTotal = unpaidRes.rows.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return res.json({
      success: true,
      dashboard: {
        today,
        timezone,
        stats: statsRes.rows[0],
        todaySessions: todaySessionsRes.rows,
        upcomingSessions: upcomingSessionsRes.rows,
        expiringPackages: expiringPackagesRes.rows,

        // Everything the trainer might have to act on, grouped by what it is.
        // Counts are included so the UI can render a summary without walking
        // the arrays, and so an empty list is unambiguous.
        attention: {
          unmarkedSessions: unmarkedRes.rows,
          unpaidPayments: unpaidRes.rows,
          expiringPackages: expiringPackagesRes.rows,
          quietClients: quietClientsRes.rows,
          unpaidTotal: Math.round(unpaidTotal * 100) / 100,
          unpaidCurrency: unpaidRes.rows[0]?.currency || 'EUR',
          inactiveDays: INACTIVE_DAYS,
          total:
            unmarkedRes.rows.length +
            unpaidRes.rows.length +
            expiringPackagesRes.rows.length +
            quietClientsRes.rows.length,
        },

        generatedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('getDashboard error:', error);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
};

/**
 * GET /api/dashboard/onboarding
 *
 * The three checks the onboarding checklist makes, as three booleans.
 *
 * It used to ask three separate endpoints and read their payloads — including
 * `GET /sessions?limit=1`, a parameter that endpoint does not support, so it
 * fetched every session the tenant had ever had in order to find out whether
 * there was one. On every dashboard load, until the checklist was dismissed.
 */
const getOnboarding = async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const { rows } = await pool.query(
      `SELECT
         EXISTS (SELECT 1 FROM clients   WHERE tenant_id = $1 AND is_active = true) AS has_client,
         EXISTS (SELECT 1 FROM packages  WHERE tenant_id = $1)                      AS has_package,
         EXISTS (SELECT 1 FROM training_sessions WHERE tenant_id = $1)              AS has_session`,
      [tenantId]
    );
    return res.json({ success: true, onboarding: rows[0] });
  } catch (error) {
    console.error('getOnboarding error:', error);
    return res.status(500).json({ error: 'Failed to load onboarding state.' });
  }
};

module.exports = { getDashboard, getOnboarding };
