-- Migration 009: GDPR Compliance Tables
-- Run with: psql treniko_db < migrations/009_gdpr_compliance.sql

-- ─────────────────────────────────────────
-- 1. trainer_consents
--    DPA acceptance recorded at signup
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trainer_consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    accepted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address      INET,
    version         VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trainer_consents_trainer_id
    ON trainer_consents(trainer_id);

-- ─────────────────────────────────────────
-- 2. client_consents
--    Health data consent per client
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_consents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    consent_type    VARCHAR(50) NOT NULL DEFAULT 'health_data',
    given_at        TIMESTAMPTZ,
    withdrawn_at    TIMESTAMPTZ,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trainer_id, client_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_client_consents_client_id
    ON client_consents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_consents_trainer_id
    ON client_consents(trainer_id);

-- ─────────────────────────────────────────
-- 3. audit_log
--    Who accessed what and when
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    ip_address      INET,
    user_agent      TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_trainer_id
    ON audit_log(trainer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
    ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action
    ON audit_log(action);

-- ─────────────────────────────────────────
-- 4. data_export_requests
--    GDPR portability requests
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_export_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    download_token  VARCHAR(128) UNIQUE,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_export_requests_trainer_id
    ON data_export_requests(trainer_id);

-- ─────────────────────────────────────────
-- 5. deletion_requests
--    Right to erasure (30-day scheduled)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deletion_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type         VARCHAR(20) NOT NULL DEFAULT 'account'
                            CHECK (target_type IN ('account', 'client')),
    target_id           UUID,   -- NULL means full account deletion
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'cancelled', 'completed')),
    scheduled_delete_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_trainer_id
    ON deletion_requests(trainer_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled
    ON deletion_requests(scheduled_delete_at)
    WHERE status = 'pending';

-- ─────────────────────────────────────────
-- 6. Add DPA columns to users table
-- ─────────────────────────────────────────
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS dpa_accepted      BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS dpa_accepted_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_login_attempts  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until      TIMESTAMPTZ;

-- ─────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────
ALTER TABLE trainer_consents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_consents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- trainer_consents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'trainer_consents' AND policyname = 'trainer_consents_isolation'
    ) THEN
        CREATE POLICY trainer_consents_isolation ON trainer_consents
            USING (trainer_id = current_setting('app.current_user_id', true)::UUID);
    END IF;

    -- client_consents
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'client_consents' AND policyname = 'client_consents_isolation'
    ) THEN
        CREATE POLICY client_consents_isolation ON client_consents
            USING (trainer_id = current_setting('app.current_user_id', true)::UUID);
    END IF;

    -- audit_log
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'audit_log' AND policyname = 'audit_log_isolation'
    ) THEN
        CREATE POLICY audit_log_isolation ON audit_log
            USING (trainer_id = current_setting('app.current_user_id', true)::UUID);
    END IF;

    -- data_export_requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'data_export_requests' AND policyname = 'data_export_requests_isolation'
    ) THEN
        CREATE POLICY data_export_requests_isolation ON data_export_requests
            USING (trainer_id = current_setting('app.current_user_id', true)::UUID);
    END IF;

    -- deletion_requests
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'deletion_requests' AND policyname = 'deletion_requests_isolation'
    ) THEN
        CREATE POLICY deletion_requests_isolation ON deletion_requests
            USING (trainer_id = current_setting('app.current_user_id', true)::UUID);
    END IF;
END $$;

\echo 'Migration 009 complete ✓'
