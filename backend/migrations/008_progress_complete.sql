-- ============================================================
-- Migration 008: Complete Progress Tracking Schema
-- Safe to run multiple times
-- Mac:     psql treniko_db < migrations/008_progress_complete.sql
-- Windows: psql -U postgres treniko_db -f migrations\008_progress_complete.sql
-- ============================================================

-- ─── 1. Fix progress_entries.date column ─────────────────────────────────────
-- Rename recorded_at → date if it exists under that name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progress_entries' AND column_name = 'recorded_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'progress_entries' AND column_name = 'date'
  ) THEN
    ALTER TABLE progress_entries RENAME COLUMN recorded_at TO date;
  END IF;
END $$;

-- Add date if completely missing
ALTER TABLE progress_entries ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE;

-- ─── 2. Add source column to progress_entries ────────────────────────────────
-- 'manual' = trainer-entered, 'derived' = auto-derived from training logs
ALTER TABLE progress_entries ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual';

-- Ensure valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_progress_source'
  ) THEN
    ALTER TABLE progress_entries
      ADD CONSTRAINT chk_progress_source CHECK (source IN ('manual', 'derived'));
  END IF;
END $$;

-- ─── 3. Add set_type to training_sets ────────────────────────────────────────
-- Allows distinguishing warm-up sets from working sets for accurate stats
ALTER TABLE training_sets ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) DEFAULT 'working';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_set_type'
  ) THEN
    ALTER TABLE training_sets
      ADD CONSTRAINT chk_set_type
      CHECK (set_type IN ('warmup', 'working', 'topset', 'backoff', 'drop', 'amrap'));
  END IF;
END $$;

-- ─── 4. Rebuild indexes ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_progress_metric;
DROP INDEX IF EXISTS idx_progress_date;

CREATE INDEX IF NOT EXISTS idx_progress_client  ON progress_entries(client_id);
CREATE INDEX IF NOT EXISTS idx_progress_tenant  ON progress_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progress_metric  ON progress_entries(client_id, metric_name, date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_date    ON progress_entries(tenant_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_progress_source  ON progress_entries(client_id, source);

-- ─── 5. Index for efficient strength queries ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_training_sets_type ON training_sets(set_type);

SELECT 'Migration 008 complete ✓' AS status;
