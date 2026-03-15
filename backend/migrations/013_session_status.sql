-- backend/migrations/013_session_status.sql

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'scheduled';

-- Sync existing data: completed sessions → 'completed'
UPDATE training_sessions SET status = 'completed' WHERE is_completed = true;

-- Add check constraint
ALTER TABLE training_sessions
  ADD CONSTRAINT check_session_status
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show'));

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_sessions_status ON training_sessions(tenant_id, status);
