'use strict';

/**
 * Verification probes for `db:baseline`.
 *
 * Adopting a pre-existing database into migration tracking must never be a
 * blind "mark everything applied" — that would tell the tracker a migration ran
 * when it may not have, and db:migrate would then skip it forever.
 *
 * Each entry names the objects a migration creates. Baseline records a
 * migration as already-applied ONLY if its probe returns true; anything that
 * fails its probe is left pending so db:migrate applies it properly.
 *
 * A migration with no entry here is likewise left pending — absence of a probe
 * is treated as "unverified", never as "assume applied".
 *
 * Probes are intentionally read-only existence checks.
 *
 * ── Why the probes are compound (production incident, Aug 2026) ──────────────
 * They used to name ONE distinctive object per migration. Production showed
 * what that costs: 009_gdpr_compliance.sql creates five tables and four columns
 * on `users`, and its probe asked only whether `audit_log` existed. A database
 * where 009 had partially landed answered "present", the migration was recorded
 * as applied, and the objects it never created stayed missing — permanently,
 * because a recorded migration is never run again.
 *
 * A single-object probe is a claim about a whole migration made from one
 * sample. So every probe below now lists ALL the load-bearing objects its
 * migration guarantees, combined with `all([...])`: PRESENT means every one of
 * them is there. A partially-applied migration now fails its probe and is left
 * pending, which is the safe direction — every migration listed here is
 * idempotent (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE OR
 * REPLACE), so re-applying one that is already partly in place completes it
 * rather than failing.
 *
 * "Load-bearing" means an object the application or a later migration depends
 * on: tables, views, functions, and the columns that later code reads. Indexes
 * are deliberately not probed — they affect performance, not correctness, and a
 * missing one cannot make the application behave incorrectly.
 *
 * The one migration whose probe stays object-existence-only is 021: see the
 * note on its entry.
 */

const table = (name) => ({
  describes: `table ${name}`,
  sql: `SELECT to_regclass('public.${name}') IS NOT NULL AS present`,
});

const view = (name) => ({
  describes: `view ${name}`,
  sql: `SELECT EXISTS (
          SELECT 1 FROM information_schema.views
           WHERE table_schema = 'public' AND table_name = '${name}'
        ) AS present`,
});

const column = (tbl, col) => ({
  describes: `${tbl}.${col}`,
  sql: `SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = '${tbl}' AND column_name = '${col}'
        ) AS present`,
});

const routine = (name) => ({
  describes: `function ${name}()`,
  sql: `SELECT EXISTS (
          SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = '${name}'
        ) AS present`,
});

const trigger = (name) => ({
  describes: `trigger ${name}`,
  sql: `SELECT EXISTS (
          SELECT 1 FROM pg_trigger t
            JOIN pg_class c     ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgname = '${name}'
        ) AS present`,
});

/**
 * Combine probes: present only when EVERY part is present.
 *
 * The parts are evaluated in one query so a probe stays a single round trip,
 * and `describes` names the whole set — which is what the operator sees in the
 * baseline report, and what makes a partial application legible there.
 */
const all = (parts) => {
  if (parts.length === 1) return parts[0];
  return {
    describes: parts.map((p) => p.describes).join(' + '),
    sql: `SELECT (${parts.map((p) => `(${p.sql})`).join(' AND ')}) AS present`,
  };
};

/**
 * Present when ANY part is present.
 *
 * Needed for exactly one situation, and it is not a loophole in the rule above:
 * a migration whose object a LATER migration deliberately removes. Probing for
 * such an object would report a correctly-migrated database as incomplete. See
 * the 016 entry.
 */
const any = (parts) => ({
  describes: parts.map((p) => p.describes).join(' OR '),
  sql: `SELECT (${parts.map((p) => `(${p.sql})`).join(' OR ')}) AS present`,
});

module.exports = {
  // The original four tables.
  'schema.sql': all([
    table('tenants'), table('users'), table('clients'), table('training_sessions'),
  ]),

  // A view, a supporting column and the trigger that maintains it — and then
  // 043 drops the column, the trigger and the function, leaving the view as the
  // single definition of "last session". So on any database that has reached
  // 043 those three are legitimately absent, and probing for them would report a
  // fully-migrated database as incomplete. Either state is evidence that 002
  // ran: the column is still there (002 applied, 043 not yet), or the view is
  // (002 applied and its column superseded). Same shape as the 016 entry.
  '002_client_statistics.sql': any([
    all([
      view('client_statistics'),
      column('clients', 'last_session_date'),
      routine('update_client_last_session'),
      trigger('trigger_update_last_session'),
    ]),
    view('client_statistics'),
  ]),

  // Two tables, the completion columns on training_sessions, and the two views
  // and two functions built on them.
  '003_training_logs.sql': all([
    table('training_logs'),
    table('exercise_entries'),
    column('training_sessions', 'is_completed'),
    view('client_exercise_stats'),
    view('training_completion_stats'),
    routine('mark_session_completed'),
  ]),

  // The whole subscription subsystem: five tables, the usage-period function
  // and the status view the checker reads.
  '004_subscriptions.sql': all([
    table('subscription_plans'),
    table('tenant_subscriptions'),
    table('subscription_usage'),
    table('subscription_notifications'),
    table('subscription_history'),
    routine('get_current_usage_period'),
    view('tenant_subscription_status'),
  ]),

  // Phase 2: the training/exercise/template/progress core.
  '005_phase2.sql': all([
    table('exercises'),
    table('trainings'),
    table('training_exercises'),
    table('training_sets'),
    table('training_templates'),
    table('template_exercises'),
    table('template_sets'),
    table('progress_entries'),
    table('training_images'),
  ]),

  '008_progress_complete.sql': all([
    column('progress_entries', 'date'),
    column('progress_entries', 'source'),
    column('training_sets', 'set_type'),
  ]),

  // The migration whose single-object probe caused the incident described
  // above. All five GDPR tables and all four columns it adds to `users`.
  '009_gdpr_compliance.sql': all([
    table('trainer_consents'),
    table('client_consents'),
    table('audit_log'),
    table('data_export_requests'),
    table('deletion_requests'),
    column('users', 'dpa_accepted'),
    column('users', 'dpa_accepted_at'),
    column('users', 'failed_login_attempts'),
    column('users', 'locked_until'),
  ]),

  '010_trainer_profile.sql': all([
    column('users', 'bio'),
    column('users', 'profile_updated_at'),
    column('tenants', 'updated_at'),
  ]),

  '011_packages.sql': all([
    table('packages'),
    table('client_packages'),
    table('package_session_usage'),
    routine('expire_client_packages'),
  ]),

  '012_client_notes.sql': column('clients', 'notes'),

  '013_session_status.sql': column('training_sessions', 'status'),

  '014_client_archived.sql': column('clients', 'is_archived'),

  '015_groups.sql': all([table('groups'), table('group_members')]),

  // 016 adds training_sessions.group_id — and 017 drops it again, replacing the
  // idea with a dedicated group_sessions table. So on any database that has
  // reached 017 the column is legitimately absent, and probing for it would
  // report a fully-migrated database as incomplete. Either state is evidence
  // that 016 ran: the column is still there (016 applied, 017 not yet), or
  // 017's tables are (016 applied and superseded).
  '016_group_sessions.sql': any([
    column('training_sessions', 'group_id'),
    table('group_sessions'),
  ]),

  '017_group_sessions_clean.sql': all([
    table('group_sessions'),
    table('group_session_attendance'),
  ]),

  '018_group_session_log.sql': all([
    column('group_sessions', 'exercises'),
    column('group_sessions', 'notes'),
  ]),

  '019_user_language.sql': column('users', 'language'),

  '020_client_payments.sql': table('client_payments'),

  // Deliberately only the table and the columns the application inserts.
  //
  // 021 is the one migration that must NOT be probed for its full canonical
  // shape. Production's table predates it and carries extra legacy columns, and
  // 021 itself is not re-runnable (its CREATE INDEX statements have no
  // IF NOT EXISTS), so a stricter probe here would leave 021 pending and then
  // fail the very upgrade it was meant to protect. The shape is instead
  // repaired unconditionally by migration 032, whose probe below is strict —
  // that is where "the table is actually correct" is enforced.
  '021_password_reset.sql': all([
    table('password_reset_tokens'),
    column('password_reset_tokens', 'user_id'),
    column('password_reset_tokens', 'token_hash'),
  ]),

  '022_fix_usage_period.sql': routine('get_current_usage_period'),

  '023_adhoc_group_sessions.sql': all([
    table('session_attendees'),
    column('training_sessions', 'is_group'),
    column('training_sessions', 'group_title'),
  ]),

  '024_token_invalidation.sql': column('users', 'password_changed_at'),

  '025_email_verification.sql': all([
    column('users', 'email_verified'),
    column('users', 'verification_token'),
    column('users', 'verification_token_expires'),
  ]),

  '026_phase2_missing_columns.sql': all([
    column('exercises', 'default_unit'),
    column('training_exercises', 'sort_order'),
    column('training_sets', 'sort_order'),
  ]),

  '027_template_columns.sql': all([
    column('template_exercises', 'exercise_id'),
    column('template_exercises', 'sort_order'),
    column('template_sets', 'sort_order'),
  ]),

  // 028 rewrites seed data rather than creating an object, so there is nothing
  // to probe: it is left pending and re-applied, which is safe and cheap.

  '029_row_level_security.sql': all([
    routine('app_current_tenant_id'),
    routine('app_current_user_id'),
  ]),

  // 030 adds an index only — see the note on index probes above. It is left
  // pending and re-applied.

  '031_client_statistics_status_aware.sql': view('client_statistics'),

  // The repair itself: present only when the legacy columns are gone AND the
  // canonical ones are in place. This is what makes the password-reset shape
  // impossible to baseline away again.
  '032_password_reset_token_repair.sql': {
    describes: 'password_reset_tokens in its canonical shape (user_id, token_hash, expires_at; no legacy tenant_id/token/used)',
    sql: `SELECT (
            to_regclass('public.password_reset_tokens') IS NOT NULL
            AND (SELECT count(*) FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
                    AND column_name IN ('user_id', 'token_hash', 'expires_at', 'used_at', 'created_at')) = 5
            AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                             WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
                               AND column_name IN ('tenant_id', 'token', 'used'))
          ) AS present`,
  },
};

module.exports.__helpers = { table, view, column, routine, trigger, all, any };
