-- Phase 2 Migration: Trainings, Exercises, Templates, Progress

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Exercises library
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  muscle_group VARCHAR(100),
  equipment VARCHAR(100),
  description TEXT,
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trainings
CREATE TABLE IF NOT EXISTS trainings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL,
  title VARCHAR(200),
  workout_type VARCHAR(100) DEFAULT 'Gym',
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  notes TEXT,
  location VARCHAR(200),
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training exercises (exercises within a training)
CREATE TABLE IF NOT EXISTS training_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  exercise_name VARCHAR(200) NOT NULL,
  order_index INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training sets (sets within an exercise entry)
CREATE TABLE IF NOT EXISTS training_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_exercise_id UUID NOT NULL REFERENCES training_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight DECIMAL(8,2),
  duration_seconds INTEGER,
  distance DECIMAL(8,2),
  notes TEXT
);

-- Training templates
CREATE TABLE IF NOT EXISTS training_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  workout_type VARCHAR(100) DEFAULT 'Gym',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template exercises
CREATE TABLE IF NOT EXISTS template_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES training_templates(id) ON DELETE CASCADE,
  exercise_name VARCHAR(200) NOT NULL,
  order_index INTEGER DEFAULT 0,
  notes TEXT
);

-- Template sets
CREATE TABLE IF NOT EXISTS template_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_exercise_id UUID NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight DECIMAL(8,2),
  duration_seconds INTEGER
);

-- Progress entries
CREATE TABLE IF NOT EXISTS progress_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  metric_name VARCHAR(200) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  unit VARCHAR(50),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  source VARCHAR(50) DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Training images
CREATE TABLE IF NOT EXISTS training_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trainings_tenant ON trainings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trainings_client ON trainings(client_id);
CREATE INDEX IF NOT EXISTS idx_trainings_session ON trainings(session_id);
CREATE INDEX IF NOT EXISTS idx_exercises_tenant ON exercises(tenant_id);
CREATE INDEX IF NOT EXISTS idx_progress_client ON progress_entries(client_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_training_exercises_training ON training_exercises(training_id);
