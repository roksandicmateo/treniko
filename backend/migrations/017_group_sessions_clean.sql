-- backend/migrations/017_group_sessions_clean.sql

-- Drop the old group_id from training_sessions (individual sessions have no group)
ALTER TABLE training_sessions DROP COLUMN IF EXISTS group_id;

-- Dedicated group sessions table (one record per group session)
CREATE TABLE IF NOT EXISTS group_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  session_type VARCHAR(100),
  notes        TEXT,
  status       VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_group_session_status CHECK (status IN ('scheduled','completed','cancelled'))
);

-- Per-member attendance for each group session
CREATE TABLE IF NOT EXISTS group_session_attendance (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_session_id UUID NOT NULL REFERENCES group_sessions(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  status           VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  training_id      UUID REFERENCES trainings(id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_session_id, client_id),
  CONSTRAINT check_attendance_status CHECK (status IN ('scheduled','completed','cancelled','no_show'))
);

CREATE INDEX IF NOT EXISTS idx_group_sessions_tenant   ON group_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_group_sessions_group    ON group_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_group_sessions_date     ON group_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_attendance_session      ON group_session_attendance(group_session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_client       ON group_session_attendance(client_id);
CREATE INDEX IF NOT EXISTS idx_attendance_training     ON group_session_attendance(training_id);
