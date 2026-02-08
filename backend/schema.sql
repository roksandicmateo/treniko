-- TRENIKO Database Schema
-- Multi-tenant training management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TENANTS TABLE
-- =============================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- USERS TABLE (Trainers)
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- =============================================
-- CLIENTS TABLE
-- =============================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_tenant_id ON clients(tenant_id);
CREATE INDEX idx_clients_is_active ON clients(is_active);
CREATE INDEX idx_clients_name ON clients(first_name, last_name);

-- =============================================
-- TRAINING SESSIONS TABLE
-- =============================================
CREATE TABLE training_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    session_type VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_sessions_tenant_id ON training_sessions(tenant_id);
CREATE INDEX idx_sessions_client_id ON training_sessions(client_id);
CREATE INDEX idx_sessions_date ON training_sessions(session_date);
CREATE INDEX idx_sessions_tenant_date ON training_sessions(tenant_id, session_date);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;

-- Clients: Users can only see clients from their tenant
CREATE POLICY tenant_isolation_clients ON clients
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Training Sessions: Users can only see sessions from their tenant
CREATE POLICY tenant_isolation_sessions ON training_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON training_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- SEED DATA (for development/testing)
-- =============================================

-- Create a demo tenant
INSERT INTO tenants (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Fitness Studio')
ON CONFLICT DO NOTHING;

-- Create a demo user (password: 'password123')
-- Password hash generated with bcrypt for 'password123'
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@treniko.com',
    '$2a$10$rH5aKxQs3xGKBVZKZ.KrXeDx4yYJqXZ5WYVBYxP8xKYX8.n7LGWHu',
    'Demo',
    'Trainer'
)
ON CONFLICT DO NOTHING;
