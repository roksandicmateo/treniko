-- Migration 020: Client Payment Tracking
-- Adds payment records linked to clients and their packages
--
-- Mac:     psql -U roks -d treniko_db -f migrations/020_client_payments.sql
-- Windows: psql -U postgres treniko_db -f migrations\020_client_payments.sql

-- ── client_payments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  -- Optional link to the package this payment is for.
  -- NULL = ad-hoc payment not tied to any package.
  client_package_id UUID REFERENCES client_packages(id) ON DELETE SET NULL,

  amount            NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  currency          VARCHAR(10)    NOT NULL DEFAULT 'EUR',

  payment_date      DATE           NOT NULL DEFAULT CURRENT_DATE,
  payment_method    VARCHAR(50)    NOT NULL DEFAULT 'cash',
  -- Allowed values: cash | bank_transfer | card | other

  -- 'paid' = money received; 'pending' = expected but not yet received
  status            VARCHAR(20)    NOT NULL DEFAULT 'paid'
                      CHECK (status IN ('paid', 'pending')),

  note              TEXT,

  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_tenant   ON client_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_client   ON client_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_package  ON client_payments(client_package_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date     ON client_payments(tenant_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_payments_status   ON client_payments(client_id, status);

-- RLS
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_client_payments ON client_payments
  USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);

-- updated_at trigger (reuses the existing function)
CREATE TRIGGER update_client_payments_updated_at
  BEFORE UPDATE ON client_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SELECT '020_client_payments migration complete ✓' AS status;
