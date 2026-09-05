'use strict';

/**
 * The one place a client package is charged, credited or corrected.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Package bookkeeping used to live inside `sessionsController`, ran as three
 * separate statements outside any transaction, swallowed its own errors, and
 * knew nothing about group sessions. Four defects followed from that, all of
 * them costing the trainer money rather than pixels:
 *
 *   - the NEWEST active package was charged first (`assigned_at DESC`), so a
 *     client who renewed early spent the new block while the old one expired
 *     unused;
 *   - a client with no package, or with an exhausted one, could be marked
 *     complete and the API answered exactly as if a session had been charged;
 *   - a failure between the ledger insert and the counter update left a charge
 *     that the idempotency guard then refused to retry, permanently;
 *   - group attendance charged nothing at all.
 *
 * ── The contract ─────────────────────────────────────────────────────────────
 * Every function here takes a `db` — a checked-out client already inside a
 * transaction (see config/database.js `getClient`). Nothing here opens or
 * commits a transaction: the caller owns the boundary, so the status change
 * that causes a charge and the charge itself either both happen or neither
 * does. Nothing here catches its own errors either; a failure propagates and
 * the caller's ROLLBACK undoes the whole thing.
 *
 * `package_session_usage` is the source of truth. `client_packages.sessions_used`
 * is a cache recomputed by `sync_client_package_usage()` from the ledger after
 * every write, never incremented by hand.
 */

/** Outcomes a charge attempt can report to the caller, and through it the UI. */
const OUTCOME = {
  CHARGED:            'charged',            // a session was taken off a package
  ALREADY_CHARGED:    'already_charged',    // this event was already on the ledger
  NO_ACTIVE_PACKAGE:  'no_active_package',  // the client has never had one, or none is current
  PACKAGE_EXHAUSTED:  'package_exhausted',  // every session_based package is used up
  PACKAGE_EXPIRED:    'package_expired',    // the package ran out of time, not sessions
  RELEASED:           'released',           // a charge was given back
  NOTHING_TO_RELEASE: 'nothing_to_release',
};

/**
 * The package a session should be charged to: the one that runs out FIRST.
 *
 * `end_date ASC NULLS LAST` is the whole point. A client who buys a new block
 * before finishing the old one must spend the old one first, or the old one
 * expires holding sessions they paid for. A package with no end date can wait —
 * it cannot expire — so it sorts last, and `assigned_at ASC` breaks ties in the
 * only direction that is fair to the client.
 *
 * Exhausted session-based packages are excluded rather than assumed absent:
 * `sync_client_package_usage` moves them to 'completed', but a package edited
 * to a lower `total_sessions` can sit at 'active' with nothing left in it.
 *
 * FOR UPDATE holds the row for the rest of the caller's transaction, so two
 * sessions completed at the same moment cannot both read the same last session
 * as available.
 */
const findChargeablePackage = async (db, tenantId, clientId) => {
  const { rows } = await db.query(
    `SELECT *
       FROM client_packages
      WHERE client_id = $1
        AND tenant_id = $2
        AND status = 'active'
        AND (package_type <> 'session_based'
             OR total_sessions IS NULL
             OR sessions_used < total_sessions)
      ORDER BY end_date ASC NULLS LAST, assigned_at ASC
      LIMIT 1
      FOR UPDATE`,
    [clientId, tenantId]
  );
  return rows[0] || null;
};

/**
 * Why no package could be charged — so the trainer gets told what is actually
 * wrong instead of a generic shrug.
 */
const explainMissingPackage = async (db, tenantId, clientId) => {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (
         WHERE status = 'completed'
            OR (status = 'active' AND package_type = 'session_based'
                AND total_sessions IS NOT NULL AND sessions_used >= total_sessions)
       )::int AS exhausted,
       COUNT(*) FILTER (WHERE status = 'expired')::int AS expired
     FROM client_packages
     WHERE client_id = $1 AND tenant_id = $2`,
    [clientId, tenantId]
  );
  const counts = rows[0] || { exhausted: 0, expired: 0 };
  if (counts.exhausted > 0) return OUTCOME.PACKAGE_EXHAUSTED;
  if (counts.expired > 0)   return OUTCOME.PACKAGE_EXPIRED;
  return OUTCOME.NO_ACTIVE_PACKAGE;
};

/** Recompute the cached counter and package status from the ledger. */
const syncPackage = async (db, clientPackageId) => {
  const { rows } = await db.query(
    'SELECT * FROM sync_client_package_usage($1)',
    [clientPackageId]
  );
  return rows[0] || null;
};

/**
 * Charge one unit against the client's next-expiring package.
 *
 * `where` identifies the event that causes the charge and makes it idempotent:
 * either `{ sessionId }` for an individual session, or
 * `{ groupSessionId, clientId }` for one member's attendance at a group session.
 *
 * @returns {{outcome: string, clientPackage: object|null}}
 */
const chargeUsage = async (db, { tenantId, clientId, sessionId = null, groupSessionId = null, actorId = null }) => {
  const isGroup = groupSessionId !== null;

  // Already on the ledger? Then this is a repeat of an event that was already
  // paid for — report it without touching anything.
  // Keyed on (event, client): one session can charge several clients when it is
  // an ad-hoc group session, but each of them only once.
  const existing = await db.query(
    isGroup
      ? `SELECT client_package_id FROM package_session_usage
          WHERE group_session_id = $1 AND client_id = $2 AND tenant_id = $3`
      : `SELECT client_package_id FROM package_session_usage
          WHERE session_id = $1 AND client_id = $2 AND tenant_id = $3`,
    [isGroup ? groupSessionId : sessionId, clientId, tenantId]
  );
  if (existing.rows.length > 0) {
    const { rows } = await db.query(
      'SELECT * FROM client_packages WHERE id = $1 AND tenant_id = $2',
      [existing.rows[0].client_package_id, tenantId]
    );
    return { outcome: OUTCOME.ALREADY_CHARGED, clientPackage: rows[0] || null };
  }

  const target = await findChargeablePackage(db, tenantId, clientId);
  if (!target) {
    return { outcome: await explainMissingPackage(db, tenantId, clientId), clientPackage: null };
  }

  await db.query(
    `INSERT INTO package_session_usage
       (tenant_id, client_package_id, session_id, group_session_id, client_id, kind, quantity, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
    [
      tenantId,
      target.id,
      sessionId,
      groupSessionId,
      clientId,
      isGroup ? 'group_session' : 'session',
      actorId,
    ]
  );

  const clientPackage = await syncPackage(db, target.id);
  return { outcome: OUTCOME.CHARGED, clientPackage };
};

/**
 * Give back a charge. A session marked complete by mistake must not cost the
 * client a session they never had.
 */
const releaseUsage = async (db, { tenantId, sessionId = null, groupSessionId = null, clientId = null }) => {
  const isGroup = groupSessionId !== null;

  const { rows } = await db.query(
    isGroup
      ? `DELETE FROM package_session_usage
          WHERE group_session_id = $1 AND client_id = $2 AND tenant_id = $3
          RETURNING client_package_id`
      : `DELETE FROM package_session_usage
          WHERE session_id = $1 AND tenant_id = $2
            AND ($3::uuid IS NULL OR client_id = $3)
          RETURNING client_package_id`,
    isGroup ? [groupSessionId, clientId, tenantId] : [sessionId, tenantId, clientId]
  );

  // An ad-hoc group session releases one row per attendee; each one has to put
  // its own package back.
  if (rows.length > 1) {
    const packages = [];
    for (const row of rows) {
      packages.push(await syncPackage(db, row.client_package_id));
    }
    return { outcome: OUTCOME.RELEASED, clientPackage: packages[0], clientPackages: packages };
  }

  if (rows.length === 0) {
    return { outcome: OUTCOME.NOTHING_TO_RELEASE, clientPackage: null };
  }

  const clientPackage = await syncPackage(db, rows[0].client_package_id);
  return { outcome: OUTCOME.RELEASED, clientPackage };
};

/**
 * A manual correction, with its reason on the record.
 *
 * Trainers make deals ("you were ill, take one back") and mistakes. Before
 * this, the only way to express either was to invent or delete a session in the
 * calendar, which corrupted the training history to fix the balance. An
 * adjustment is a ledger row like any other, so the balance still equals the
 * sum of its explanations.
 *
 * @param {number} quantity — positive charges sessions, negative gives them back.
 */
const adjustPackage = async (db, { tenantId, clientPackageId, quantity, reason, actorId = null }) => {
  const { rows: owned } = await db.query(
    'SELECT id, client_id FROM client_packages WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
    [clientPackageId, tenantId]
  );
  if (owned.length === 0) return null;

  const { rows: [entry] } = await db.query(
    `INSERT INTO package_session_usage
       (tenant_id, client_package_id, client_id, kind, quantity, reason, created_by)
     VALUES ($1, $2, $3, 'adjustment', $4, $5, $6)
     RETURNING *`,
    [tenantId, clientPackageId, owned[0].client_id, quantity, reason, actorId]
  );

  const clientPackage = await syncPackage(db, clientPackageId);
  return { entry, clientPackage };
};

/** The ledger behind one package's balance, newest first. */
const getLedger = async (db, { tenantId, clientPackageId }) => {
  const { rows } = await db.query(
    `SELECT psu.id, psu.kind, psu.quantity, psu.reason, psu.used_at,
            psu.session_id, psu.group_session_id,
            u.first_name AS created_by_first_name, u.last_name AS created_by_last_name
       FROM package_session_usage psu
       LEFT JOIN users u ON u.id = psu.created_by
      WHERE psu.client_package_id = $1 AND psu.tenant_id = $2
      ORDER BY psu.used_at DESC`,
    [clientPackageId, tenantId]
  );
  return rows;
};

/**
 * Which statuses take a session off a package.
 *
 * 'completed' always does. 'no_show' does only when the trainer says so on the
 * request: charging a no-show is a business policy the product must not invent
 * on the trainer's behalf, and both answers are common in the trade. The UI
 * asks, remembers the last answer, and sends it.
 *
 * Individual sessions and group attendance share this rule, and share the
 * vocabulary it is written in: both use scheduled / completed / cancelled /
 * no_show.
 */
const statusConsumesSession = (status, chargeNoShow) =>
  status === 'completed' || (status === 'no_show' && chargeNoShow === true);

module.exports = {
  OUTCOME,
  statusConsumesSession,
  findChargeablePackage,
  chargeUsage,
  releaseUsage,
  adjustPackage,
  syncPackage,
  getLedger,
};
