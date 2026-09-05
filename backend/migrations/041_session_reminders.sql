-- backend/migrations/041_session_reminders.sql
--
-- ── Why ──────────────────────────────────────────────────────────────────────
-- TRENIKO did not send a client a single message. Every email in the product
-- goes to the TRAINER: welcome, password reset, verification, trial warnings.
-- That is why the trainer still has to open WhatsApp every evening to confirm
-- tomorrow's sessions, and why the product ended up being a fifth tool beside
-- the four it was meant to replace rather than a replacement for any of them.
--
-- A reminder the evening before is the one message that pays for itself: a
-- no-show costs the trainer a paid hour, and it is the message they are already
-- sending by hand, one client at a time.
--
-- ── What this stores ─────────────────────────────────────────────────────────
-- One row per reminder actually sent, keyed by session so the job is idempotent
-- however often it runs and however it is restarted. `status` records the
-- outcome, so a failed send is visible instead of being retried forever or
-- silently dropped.
--
-- Rescheduling deletes the row (see sessionsController): a new time is a new
-- reminder, and a client who was told 18:00 must be told 19:00.
--
-- ── Consent ──────────────────────────────────────────────────────────────────
-- `clients.reminders_opt_out` gives the trainer somewhere to record a client
-- who does not want them, per client, which is both a courtesy and what an
-- unsolicited-mail complaint will ask about.

CREATE TABLE IF NOT EXISTS session_reminders (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel     VARCHAR(20)  NOT NULL DEFAULT 'email',
  status      VARCHAR(20)  NOT NULL DEFAULT 'sent'
                CHECK (status IN ('sent', 'failed', 'skipped')),
  error       TEXT,
  sent_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, client_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_session_reminders_tenant  ON session_reminders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_session_reminders_session ON session_reminders(session_id);

ALTER TABLE session_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_tenant_session_reminders ON session_reminders;
CREATE POLICY rls_tenant_session_reminders ON session_reminders
  USING (tenant_id = app_current_tenant_id())
  WITH CHECK (tenant_id = app_current_tenant_id());

-- Per-client opt-out. Default false: a client who gave their trainer an email
-- address for their training expects to hear about their training.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS reminders_opt_out BOOLEAN NOT NULL DEFAULT false;

-- Per-trainer switch, so a trainer who prefers to message clients themselves
-- can turn the whole thing off without editing every client.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS session_reminders_enabled BOOLEAN NOT NULL DEFAULT true;
