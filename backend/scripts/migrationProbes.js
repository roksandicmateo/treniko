'use strict';

/**
 * Verification probes for `db:baseline`.
 *
 * Adopting a pre-existing database into migration tracking must never be a
 * blind "mark everything applied" — that would tell the tracker a migration ran
 * when it may not have, and db:migrate would then skip it forever.
 *
 * Each entry names a distinctive object the migration creates. Baseline records
 * a migration as already-applied ONLY if its probe returns true; anything that
 * fails its probe is left pending so db:migrate applies it properly.
 *
 * A migration with no entry here is likewise left pending — absence of a probe
 * is treated as "unverified", never as "assume applied".
 *
 * Probes are intentionally read-only existence checks.
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
           WHERE table_name = '${tbl}' AND column_name = '${col}'
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

module.exports = {
  'schema.sql':                     table('tenants'),
  '002_client_statistics.sql':      view('client_statistics'),
  '003_training_logs.sql':          table('training_logs'),
  '004_subscriptions.sql':          table('tenant_subscriptions'),
  '005_phase2.sql':                 table('training_images'),
  '008_progress_complete.sql':      table('progress_entries'),
  '009_gdpr_compliance.sql':        table('audit_log'),
  '010_trainer_profile.sql':        column('users', 'bio'),
  '011_packages.sql':               table('packages'),
  '012_client_notes.sql':           column('clients', 'notes'),
  '013_session_status.sql':         column('training_sessions', 'status'),
  '014_client_archived.sql':        column('clients', 'is_archived'),
  '015_groups.sql':                 table('groups'),
  '016_group_sessions.sql':         table('group_sessions'),
  '017_group_sessions_clean.sql':   table('group_session_attendance'),
  '018_group_session_log.sql':      column('group_sessions', 'exercises'),
  '019_user_language.sql':          column('users', 'language'),
  '020_client_payments.sql':        table('client_payments'),
  '021_password_reset.sql':         table('password_reset_tokens'),
  '022_fix_usage_period.sql':       routine('get_current_usage_period'),
  '023_adhoc_group_sessions.sql':   table('session_attendees'),
  '024_token_invalidation.sql':     column('users', 'password_changed_at'),
  '025_email_verification.sql':     column('users', 'email_verified'),
  '026_phase2_missing_columns.sql': column('exercises', 'default_unit'),
  '027_template_columns.sql':       column('template_exercises', 'exercise_id'),
};
