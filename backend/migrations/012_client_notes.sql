-- backend/migrations/012_client_notes.sql

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS date_of_birth  DATE,
  ADD COLUMN IF NOT EXISTS goals          TEXT,
  ADD COLUMN IF NOT EXISTS injuries       TEXT,
  ADD COLUMN IF NOT EXISTS diet_notes     TEXT,
  ADD COLUMN IF NOT EXISTS notes          TEXT;
