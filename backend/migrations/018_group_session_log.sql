-- backend/migrations/018_group_session_log.sql

-- Add shared exercise log to group sessions
ALTER TABLE group_sessions
  ADD COLUMN IF NOT EXISTS exercises    JSONB,
  ADD COLUMN IF NOT EXISTS workout_type VARCHAR(50) DEFAULT 'Gym',
  ADD COLUMN IF NOT EXISTS location     VARCHAR(200);
