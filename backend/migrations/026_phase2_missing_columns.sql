-- 026_phase2_missing_columns.sql
-- Pre-commit stabilization — closes a fresh-install gap.
--
-- Four columns exist in the long-running development database but are created
-- by NO migration, so they were only ever added by hand. A database built from
-- schema.sql + the migration chain therefore lacked them, and the following
-- routes returned HTTP 500 on a fresh install:
--
--   exercises.default_unit
--     routes/exercises.js  (INSERT and UPDATE)
--     routes/trainings.js  loadFull()  SELECT e.default_unit   <- 500
--     routes/templates.js  GET /:id    SELECT e.default_unit   <- 500
--   training_exercises.sort_order
--     routes/trainings.js  insertExercises() INSERT, loadFull() ORDER BY
--   training_sets.sort_order, training_sets.rpe
--     routes/trainings.js  insertExercises() INSERT, loadFull() ORDER BY
--
-- Types and defaults mirror the development database exactly, so applying this
-- to an environment that already has the columns is a no-op.
--
-- Additive and idempotent: nothing is dropped or rewritten.

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS default_unit VARCHAR(20) DEFAULT 'kg';

ALTER TABLE training_exercises
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE training_sets
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rpe        NUMERIC;

-- Ordered reads of a training's exercises and sets go through these columns.
CREATE INDEX IF NOT EXISTS idx_training_exercises_sort
  ON training_exercises (training_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_training_sets_sort
  ON training_sets (training_exercise_id, sort_order);
