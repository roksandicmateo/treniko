-- Migration: Add useful columns for client detail and statistics
-- Run this after initial schema

-- Add last_session_date to clients for quick lookup
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_session_date DATE;

-- Create a view for client statistics
CREATE OR REPLACE VIEW client_statistics AS
SELECT 
    c.id as client_id,
    c.tenant_id,
    COUNT(ts.id) as total_sessions,
    COUNT(CASE WHEN ts.session_date >= CURRENT_DATE THEN 1 END) as upcoming_sessions,
    COUNT(CASE WHEN ts.session_date < CURRENT_DATE THEN 1 END) as completed_sessions,
    MAX(ts.session_date) as last_session_date,
    MIN(CASE WHEN ts.session_date >= CURRENT_DATE THEN ts.session_date END) as next_session_date
FROM clients c
LEFT JOIN training_sessions ts ON c.id = ts.client_id
GROUP BY c.id, c.tenant_id;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_date_client ON training_sessions(client_id, session_date DESC);

-- Trigger to update last_session_date automatically
CREATE OR REPLACE FUNCTION update_client_last_session()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE clients 
    SET last_session_date = (
        SELECT MAX(session_date) 
        FROM training_sessions 
        WHERE client_id = NEW.client_id
    )
    WHERE id = NEW.client_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_last_session ON training_sessions;
CREATE TRIGGER trigger_update_last_session
    AFTER INSERT OR UPDATE OF session_date ON training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_client_last_session();
