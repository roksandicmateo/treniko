-- backend/migrations/014_client_archived.sql

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_clients_archived ON clients(tenant_id, is_archived);
