-- backend/migrations/015_groups.sql

CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  color       VARCHAR(7) DEFAULT '#0ea5e9',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_members (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  joined_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_groups_tenant    ON groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group  ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_client ON group_members(client_id);
