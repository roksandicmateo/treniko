-- backend/migrations/016_group_sessions.sql

-- Link training_sessions to a group (nullable — individual sessions have NULL)
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_group ON training_sessions(group_id);
