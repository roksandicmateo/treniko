-- Migration: Add training logs and exercise tracking
-- Run this after 002_client_statistics.sql

-- =============================================
-- TRAINING LOGS TABLE
-- Stores completed training session details
-- =============================================
CREATE TABLE training_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    notes TEXT,
    duration_minutes INTEGER, -- Actual duration (may differ from planned)
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_session_log UNIQUE(session_id)
);

CREATE INDEX idx_training_logs_session ON training_logs(session_id);
CREATE INDEX idx_training_logs_tenant ON training_logs(tenant_id);
CREATE INDEX idx_training_logs_completed_at ON training_logs(completed_at);

-- =============================================
-- EXERCISE ENTRIES TABLE
-- Stores individual exercises within a training log
-- =============================================
CREATE TABLE exercise_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    training_log_id UUID NOT NULL REFERENCES training_logs(id) ON DELETE CASCADE,
    exercise_name VARCHAR(255) NOT NULL,
    sets INTEGER,
    reps INTEGER,
    weight DECIMAL(6, 2), -- In kg or lbs
    weight_unit VARCHAR(10) DEFAULT 'kg', -- 'kg' or 'lbs'
    duration_minutes INTEGER, -- For cardio exercises
    distance DECIMAL(8, 2), -- For running, cycling, etc.
    distance_unit VARCHAR(10) DEFAULT 'km', -- 'km', 'miles', 'meters'
    notes TEXT,
    order_index INTEGER DEFAULT 0, -- To maintain exercise order
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exercise_entries_log ON exercise_entries(training_log_id);
CREATE INDEX idx_exercise_entries_order ON exercise_entries(training_log_id, order_index);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on training logs
ALTER TABLE training_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_training_logs ON training_logs
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Note: exercise_entries inherit security through training_logs foreign key

-- =============================================
-- TRIGGERS
-- =============================================

-- Update updated_at timestamp
CREATE TRIGGER update_training_logs_updated_at BEFORE UPDATE ON training_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exercise_entries_updated_at BEFORE UPDATE ON exercise_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- UPDATE TRAINING_SESSIONS TABLE
-- Add is_completed flag
-- =============================================
ALTER TABLE training_sessions 
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

-- Function to automatically mark session as completed when log is created
CREATE OR REPLACE FUNCTION mark_session_completed()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE training_sessions 
    SET is_completed = true
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mark_session_completed ON training_logs;
CREATE TRIGGER trigger_mark_session_completed
    AFTER INSERT ON training_logs
    FOR EACH ROW
    EXECUTE FUNCTION mark_session_completed();

-- Function to unmark session if log is deleted
CREATE OR REPLACE FUNCTION unmark_session_completed()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE training_sessions 
    SET is_completed = false
    WHERE id = OLD.session_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unmark_session_completed ON training_logs;
CREATE TRIGGER trigger_unmark_session_completed
    AFTER DELETE ON training_logs
    FOR EACH ROW
    EXECUTE FUNCTION unmark_session_completed();

-- =============================================
-- VIEWS FOR STATISTICS
-- =============================================

-- View for exercise statistics per client
CREATE OR REPLACE VIEW client_exercise_stats AS
SELECT 
    c.id as client_id,
    c.tenant_id,
    ee.exercise_name,
    COUNT(ee.id) as total_times_performed,
    MAX(ee.weight) as max_weight,
    AVG(ee.weight) as avg_weight,
    MAX(tl.completed_at) as last_performed
FROM clients c
JOIN training_sessions ts ON c.id = ts.client_id
JOIN training_logs tl ON ts.id = tl.session_id
JOIN exercise_entries ee ON tl.id = ee.training_log_id
WHERE ee.weight IS NOT NULL
GROUP BY c.id, c.tenant_id, ee.exercise_name;

-- View for training completion rate
CREATE OR REPLACE VIEW training_completion_stats AS
SELECT 
    c.id as client_id,
    c.tenant_id,
    COUNT(ts.id) as total_sessions,
    COUNT(CASE WHEN ts.is_completed THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN NOT ts.is_completed AND ts.session_date < CURRENT_DATE THEN 1 END) as missed_sessions,
    ROUND(
        (COUNT(CASE WHEN ts.is_completed THEN 1 END)::DECIMAL / 
        NULLIF(COUNT(CASE WHEN ts.session_date < CURRENT_DATE THEN 1 END), 0)) * 100, 
        2
    ) as completion_rate
FROM clients c
LEFT JOIN training_sessions ts ON c.id = ts.client_id
GROUP BY c.id, c.tenant_id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_completed ON training_sessions(is_completed, session_date);
