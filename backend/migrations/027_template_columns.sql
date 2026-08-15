-- 027_template_columns.sql
-- Pre-commit infrastructure hardening — makes the workout-template feature work.
--
-- The template tables were created by 005_phase2.sql with an early shape
-- (description / exercise_name / order_index). routes/templates.js was later
-- rewritten around the exercise-library model — the same model
-- training_exercises and training_sets use — and references columns that were
-- never added:
--
--   training_templates.notes         (code INSERTs it; table only has description)
--   template_exercises.exercise_id   (code JOINs exercises ON e.id = te.exercise_id)
--   template_exercises.sort_order    (code INSERTs and ORDER BYs it)
--   template_sets.sort_order         (code INSERTs and ORDER BYs it)
--   template_sets.distance           (code INSERTs it)
--   template_sets.rpe                (code INSERTs it)
--
-- Result: POST /api/templates and GET /api/templates/:id both returned HTTP 500
-- on EVERY database, development included — not just on fresh installs. This
-- migration brings the schema in line with the code, mirroring what 026 did for
-- the training_* tables.
--
-- Additive and idempotent. The original columns are left in place rather than
-- renamed or dropped, so nothing is lost and the migration is safe to re-run.
-- All three tables were empty when this was written, so there is no data to
-- migrate; exercise_id is left nullable and unbackfilled rather than guessing a
-- mapping from the legacy free-text exercise_name.

ALTER TABLE training_templates
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sort_order  INTEGER NOT NULL DEFAULT 0;

ALTER TABLE template_sets
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance   NUMERIC,
  ADD COLUMN IF NOT EXISTS rpe        NUMERIC;

-- Ordered reads of a template's exercises and sets go through these columns.
CREATE INDEX IF NOT EXISTS idx_template_exercises_sort
  ON template_exercises (template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_template_sets_sort
  ON template_sets (template_exercise_id, sort_order);
