// backend/controllers/dashboardController.js  (NEW FILE)

const { pool } = require('../config/database');

/**
 * GET /api/dashboard
 * Returns all data needed for the dashboard in a single request.
 */
const getDashboard = async (req, res) => {
  const tenantId = req.user.tenantId;
  // The server's own calendar date, not the UTC one. `toISOString()` would
  // report yesterday between midnight and 02:00 local time in Croatia, so
  // "today's sessions" emptied out while the trainer was still looking at it.
  const today = new Date().toLocaleDateString('en-CA');

  try {
    const [
      todaySessionsRes,
      upcomingSessionsRes,
      expiringPackagesRes,
      statsRes,
      recentClientsRes,
    ] = await Promise.all([

      // Today's sessions
      //
      // session_date is cast to text so the API returns a calendar date
      // ("2026-08-20") rather than a timestamp. A DATE column comes back from
      // node-postgres as a JS Date at local midnight and serialises as a UTC
      // instant; the dashboard builds `session_date + 'T00:00:00'` from it and
      // was producing "Invalid Date" for every row, and handed the same value
      // to the session modal's date input, which then rendered empty.
      // GET /api/sessions already casts; these did not.
      //
      // `status` is selected because the row component colours the marker and
      // the badge from it, and the modal opens with it. It was never returned,
      // so a completed or cancelled session looked scheduled.
      pool.query(
        `SELECT
           ts.id, ts.session_date::text AS session_date, ts.start_time, ts.end_time,
           ts.session_type, ts.is_completed, ts.status, ts.notes,
           c.first_name, c.last_name, c.id AS client_id
         FROM training_sessions ts
         JOIN clients c ON ts.client_id = c.id
         WHERE ts.tenant_id = $1
           AND ts.session_date = $2
         ORDER BY ts.start_time ASC`,
        [tenantId, today]
      ),

      // Upcoming sessions (next 7 days, excluding today)
      //
      // Cancelled and no-show sessions are excluded. Filtering on
      // `is_completed = false` alone left a session the trainer had just
      // cancelled sitting in "Upcoming this week" as though it were still on.
      pool.query(
        `SELECT
           ts.id, ts.session_date::text AS session_date, ts.start_time, ts.end_time,
           ts.session_type, ts.is_completed, ts.status, ts.notes,
           c.first_name, c.last_name, c.id AS client_id
         FROM training_sessions ts
         JOIN clients c ON ts.client_id = c.id
         WHERE ts.tenant_id = $1
           AND ts.session_date > $2
           AND ts.session_date <= $2::date + INTERVAL '7 days'
           AND ts.is_completed = false
           AND ts.status NOT IN ('cancelled', 'no_show')
         ORDER BY ts.session_date ASC, ts.start_time ASC
         LIMIT 8`,
        [tenantId, today]
      ),

      // Expiring packages (active, end_date within 7 days or null for session-based near completion)
      pool.query(
        `SELECT
           cp.id, cp.package_name, cp.package_type,
           cp.sessions_used, cp.total_sessions,
           cp.end_date, cp.status,
           c.first_name, c.last_name, c.id AS client_id
         FROM client_packages cp
         JOIN clients c ON cp.client_id = c.id
         WHERE cp.tenant_id = $1
           AND cp.status = 'active'
           AND (
             (cp.end_date IS NOT NULL AND cp.end_date <= $2::date + INTERVAL '7 days')
             OR
             (cp.package_type = 'session_based' AND cp.total_sessions IS NOT NULL
              AND cp.total_sessions - cp.sessions_used <= 2)
           )
         ORDER BY cp.end_date ASC NULLS LAST
         LIMIT 6`,
        [tenantId, today]
      ),

      // Overall stats
      pool.query(
        `SELECT
           (SELECT COUNT(*) FROM clients WHERE tenant_id = $1 AND is_active = true) AS active_clients,
           (SELECT COUNT(*) FROM training_sessions WHERE tenant_id = $1 AND session_date = $2
             AND status <> 'cancelled') AS sessions_today,
           (SELECT COUNT(*) FROM training_sessions WHERE tenant_id = $1 AND is_completed = true
            AND session_date >= date_trunc('month', CURRENT_DATE)) AS completed_this_month,
           (SELECT COUNT(*) FROM client_packages WHERE tenant_id = $1 AND status = 'active') AS active_packages`,
        [tenantId, today]
      ),

      // Recently added clients (last 5)
      pool.query(
        `SELECT id, first_name, last_name, created_at, is_active
         FROM clients
         WHERE tenant_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [tenantId]
      ),
    ]);

    return res.json({
      success: true,
      dashboard: {
        stats: statsRes.rows[0],
        todaySessions: todaySessionsRes.rows,
        upcomingSessions: upcomingSessionsRes.rows,
        expiringPackages: expiringPackagesRes.rows,
        recentClients: recentClientsRes.rows,
        generatedAt: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('getDashboard error:', error);
    return res.status(500).json({ error: 'Failed to load dashboard.' });
  }
};

module.exports = { getDashboard };
