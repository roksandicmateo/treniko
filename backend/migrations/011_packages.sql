-- backend/migrations/011_packages.sql

-- ── 1. Packages — trainer-defined templates ───────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  name                VARCHAR(200) NOT NULL,
  description         TEXT,
  price               NUMERIC(10, 2),
  currency            VARCHAR(10) DEFAULT 'EUR',

  -- Type: session_based | time_based | unlimited
  package_type        VARCHAR(50) NOT NULL DEFAULT 'session_based',

  -- Session-based rules
  total_sessions      INT,             -- e.g. 10 sessions

  -- Time-based / unlimited rules
  duration_days       INT,             -- e.g. 30 days

  -- Sessions per period (for "8 sessions per month" style)
  sessions_per_period INT,             -- e.g. 8
  period_days         INT,             -- e.g. 30

  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_packages_tenant_id ON packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_packages_active    ON packages(tenant_id, is_active);

-- RLS
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_packages ON packages
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- ── 2. Client Packages — assignments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_packages (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  package_id          UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,

  -- Snapshot of package at time of assignment (in case package is later edited)
  package_name        VARCHAR(200) NOT NULL,
  package_type        VARCHAR(50)  NOT NULL,
  total_sessions      INT,
  sessions_per_period INT,
  period_days         INT,
  duration_days       INT,
  price               NUMERIC(10, 2),
  currency            VARCHAR(10) DEFAULT 'EUR',

  -- Dates
  start_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date            DATE,            -- calculated on assignment for time-based

  -- Usage tracking
  sessions_used       INT NOT NULL DEFAULT 0,

  -- Status: active | completed | expired | cancelled
  status              VARCHAR(50) NOT NULL DEFAULT 'active',

  notes               TEXT,
  assigned_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_packages_client   ON client_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_tenant   ON client_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_status   ON client_packages(client_id, status);
CREATE INDEX IF NOT EXISTS idx_client_packages_active   ON client_packages(tenant_id, status);

ALTER TABLE client_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_client_packages ON client_packages
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- ── 3. Package Session Usage — links sessions to client packages ──────────────
CREATE TABLE IF NOT EXISTS package_session_usage (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_package_id   UUID NOT NULL REFERENCES client_packages(id) ON DELETE CASCADE,
  session_id          UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  used_at             TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id)  -- one session can only consume from one package
);

CREATE INDEX IF NOT EXISTS idx_pkg_session_usage_cp ON package_session_usage(client_package_id);

ALTER TABLE package_session_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_pkg_usage ON package_session_usage
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- ── 4. Auto-update updated_at triggers ───────────────────────────────────────
CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_packages_updated_at
  BEFORE UPDATE ON client_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 5. Function: auto-expire packages whose end_date has passed ───────────────
CREATE OR REPLACE FUNCTION expire_client_packages() RETURNS void AS $$
BEGIN
  UPDATE client_packages
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date < CURRENT_DATE;

  UPDATE client_packages
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'active'
    AND package_type = 'session_based'
    AND total_sessions IS NOT NULL
    AND sessions_used >= total_sessions;
END;
$$ LANGUAGE plpgsql;
