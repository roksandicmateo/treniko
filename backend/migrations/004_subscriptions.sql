-- Migration: Subscription System
-- Adds subscription plans, tenant subscriptions, usage tracking, and notifications

-- =============================================
-- SUBSCRIPTION PLANS TABLE
-- Defines available subscription tiers
-- =============================================
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE, -- free, pro, enterprise
    display_name VARCHAR(100) NOT NULL,
    price_monthly DECIMAL(10, 2) NOT NULL,
    price_yearly DECIMAL(10, 2) NOT NULL,
    
    -- Limits
    max_clients INTEGER, -- NULL = unlimited
    max_sessions_per_month INTEGER, -- NULL = unlimited
    max_storage_mb INTEGER, -- NULL = unlimited
    max_trainer_seats INTEGER DEFAULT 1,
    
    -- Features
    has_training_logs BOOLEAN DEFAULT false,
    has_analytics BOOLEAN DEFAULT false,
    has_export BOOLEAN DEFAULT false,
    has_api_access BOOLEAN DEFAULT false,
    has_custom_branding BOOLEAN DEFAULT false,
    has_priority_support BOOLEAN DEFAULT false,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_plans_name ON subscription_plans(name);

-- =============================================
-- TENANT SUBSCRIPTIONS TABLE
-- Tracks current subscription for each tenant
-- =============================================
CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, expired, suspended, cancelled
    
    -- Billing cycle
    billing_period VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, yearly
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    
    -- Trial
    trial_start DATE,
    trial_end DATE,
    is_trial BOOLEAN DEFAULT false,
    
    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP,
    
    -- Payment
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_subscription UNIQUE(tenant_id)
);

CREATE INDEX idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX idx_tenant_subscriptions_period_end ON tenant_subscriptions(current_period_end);

-- =============================================
-- SUBSCRIPTION USAGE TABLE
-- Tracks monthly usage against limits
-- =============================================
CREATE TABLE subscription_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Usage period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Current usage
    clients_count INTEGER DEFAULT 0,
    sessions_count INTEGER DEFAULT 0,
    storage_used_mb DECIMAL(10, 2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_usage_period UNIQUE(tenant_id, period_start)
);

CREATE INDEX idx_subscription_usage_tenant ON subscription_usage(tenant_id);
CREATE INDEX idx_subscription_usage_period ON subscription_usage(period_start, period_end);

-- =============================================
-- SUBSCRIPTION NOTIFICATIONS TABLE
-- Tracks expiry warnings sent to tenants
-- =============================================
CREATE TABLE subscription_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    notification_type VARCHAR(50) NOT NULL, -- expiry_warning_7d, expiry_warning_3d, expired, suspended
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP
);

CREATE INDEX idx_subscription_notifications_tenant ON subscription_notifications(tenant_id);
CREATE INDEX idx_subscription_notifications_type ON subscription_notifications(notification_type);
CREATE INDEX idx_subscription_notifications_sent ON subscription_notifications(sent_at DESC);

-- =============================================
-- SUBSCRIPTION HISTORY TABLE
-- Tracks plan changes over time
-- =============================================
CREATE TABLE subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    from_plan_id UUID REFERENCES subscription_plans(id),
    to_plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    
    change_type VARCHAR(20) NOT NULL, -- upgrade, downgrade, renewal, cancellation
    effective_date DATE NOT NULL,
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subscription_history_tenant ON subscription_history(tenant_id);
CREATE INDEX idx_subscription_history_date ON subscription_history(effective_date DESC);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_subscriptions ON tenant_subscriptions
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_usage ON subscription_usage
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE subscription_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_notifications ON subscription_notifications
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_subscriptions_updated_at BEFORE UPDATE ON tenant_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_usage_updated_at BEFORE UPDATE ON subscription_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCTIONS FOR USAGE TRACKING
-- =============================================

-- Function to get or create current usage period
CREATE OR REPLACE FUNCTION get_current_usage_period(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_usage_id UUID;
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Get current period from subscription
    SELECT current_period_start, current_period_end
    INTO v_period_start, v_period_end
    FROM tenant_subscriptions
    WHERE tenant_id = p_tenant_id;
    
    -- Get or create usage record
    SELECT id INTO v_usage_id
    FROM subscription_usage
    WHERE tenant_id = p_tenant_id
      AND period_start = v_period_start;
    
    IF v_usage_id IS NULL THEN
        INSERT INTO subscription_usage (tenant_id, period_start, period_end)
        VALUES (p_tenant_id, v_period_start, v_period_end)
        RETURNING id INTO v_usage_id;
    END IF;
    
    RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update client count in usage
CREATE OR REPLACE FUNCTION update_client_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Update usage when client is added/removed
    UPDATE subscription_usage
    SET 
        clients_count = (
            SELECT COUNT(*) 
            FROM clients 
            WHERE tenant_id = COALESCE(NEW.tenant_id, OLD.tenant_id)
              AND is_active = true
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = get_current_usage_period(COALESCE(NEW.tenant_id, OLD.tenant_id));
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_client_usage ON clients;
CREATE TRIGGER trigger_update_client_usage
    AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_client_usage();

-- Function to update session count in usage
CREATE OR REPLACE FUNCTION update_session_usage()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Get tenant_id from the session
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
    ELSE
        v_tenant_id := NEW.tenant_id;
    END IF;
    
    -- Update usage when session is added/removed in current period
    UPDATE subscription_usage
    SET 
        sessions_count = (
            SELECT COUNT(*) 
            FROM training_sessions ts
            JOIN subscription_usage su ON ts.tenant_id = su.tenant_id
            WHERE ts.tenant_id = v_tenant_id
              AND ts.session_date >= su.period_start
              AND ts.session_date <= su.period_end
              AND su.id = get_current_usage_period(v_tenant_id)
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = get_current_usage_period(v_tenant_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_session_usage ON training_sessions;
CREATE TRIGGER trigger_update_session_usage
    AFTER INSERT OR DELETE ON training_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_usage();

-- =============================================
-- VIEWS FOR SUBSCRIPTION STATUS
-- =============================================

-- View combining subscription with current usage
CREATE OR REPLACE VIEW tenant_subscription_status AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    
    -- Subscription
    ts.id as subscription_id,
    ts.status as subscription_status,
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    sp.price_monthly,
    sp.price_yearly,
    ts.billing_period,
    ts.current_period_start,
    ts.current_period_end,
    ts.is_trial,
    ts.trial_end,
    
    -- Limits
    sp.max_clients,
    sp.max_sessions_per_month,
    sp.max_storage_mb,
    sp.max_trainer_seats,
    
    -- Features
    sp.has_training_logs,
    sp.has_analytics,
    sp.has_export,
    sp.has_api_access,
    sp.has_custom_branding,
    sp.has_priority_support,
    
    -- Current usage
    su.clients_count,
    su.sessions_count,
    su.storage_used_mb,
    
    -- Limit checks
    CASE 
        WHEN sp.max_clients IS NULL THEN false
        WHEN su.clients_count >= sp.max_clients THEN true
        ELSE false
    END as clients_limit_reached,
    
    CASE 
        WHEN sp.max_sessions_per_month IS NULL THEN false
        WHEN su.sessions_count >= sp.max_sessions_per_month THEN true
        ELSE false
    END as sessions_limit_reached,
    
    -- Days until expiry
    ts.current_period_end - CURRENT_DATE as days_until_expiry,
    
    -- Read-only mode check
    CASE 
        WHEN ts.status = 'expired' THEN true
        WHEN ts.status = 'suspended' THEN true
        WHEN ts.status = 'cancelled' THEN true
        ELSE false
    END as is_read_only

FROM tenants t
JOIN tenant_subscriptions ts ON t.id = ts.tenant_id
JOIN subscription_plans sp ON ts.plan_id = sp.id
LEFT JOIN subscription_usage su ON t.id = su.tenant_id 
    AND su.period_start = ts.current_period_start;

-- =============================================
-- SEED SUBSCRIPTION PLANS
-- =============================================

INSERT INTO subscription_plans (
    name, 
    display_name, 
    price_monthly, 
    price_yearly,
    max_clients,
    max_sessions_per_month,
    max_storage_mb,
    max_trainer_seats,
    has_training_logs,
    has_analytics,
    has_export,
    has_api_access,
    has_custom_branding,
    has_priority_support
) VALUES 
(
    'free',
    'Free',
    0.00,
    0.00,
    5,
    20,
    100,
    1,
    false,
    false,
    false,
    false,
    false,
    false
),
(
    'pro',
    'Pro',
    29.00,
    290.00,
    50,
    NULL,
    5000,
    1,
    true,
    true,
    true,
    false,
    false,
    false
),
(
    'enterprise',
    'Enterprise',
    99.00,
    990.00,
    NULL,
    NULL,
    NULL,
    5,
    true,
    true,
    true,
    true,
    true,
    true
);

-- =============================================
-- ASSIGN FREE TIER TO EXISTING TENANTS
-- =============================================

INSERT INTO tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    billing_period,
    current_period_start,
    current_period_end,
    is_trial,
    trial_start,
    trial_end
)
SELECT 
    t.id,
    (SELECT id FROM subscription_plans WHERE name = 'free'),
    'active',
    'monthly',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    true,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM tenant_subscriptions ts WHERE ts.tenant_id = t.id
);

-- Initialize usage records
INSERT INTO subscription_usage (tenant_id, period_start, period_end, clients_count, sessions_count)
SELECT 
    t.id,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    (SELECT COUNT(*) FROM clients c WHERE c.tenant_id = t.id AND c.is_active = true),
    (SELECT COUNT(*) FROM training_sessions ts WHERE ts.tenant_id = t.id AND ts.session_date >= CURRENT_DATE)
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM subscription_usage su WHERE su.tenant_id = t.id
);
