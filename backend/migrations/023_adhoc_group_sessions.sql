-- Migration 023: Ad-hoc group sessions support
-- Adds is_group flag to training_sessions and session_attendees table

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS group_title VARCHAR(255);

CREATE TABLE IF NOT EXISTS session_attendees (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id  UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL,
  status      VARCHAR(20) DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','completed','no_show','cancelled')),
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (session_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_session_attendees_session ON session_attendees(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attendees_client  ON session_attendees(client_id);
CREATE INDEX IF NOT EXISTS idx_session_attendees_tenant  ON session_attendees(tenant_id);
