-- Migration 022: Fix get_current_usage_period to handle missing subscription rows
-- The original function crashed when no tenant_subscriptions row existed for the tenant.
-- Fix: fall back to current calendar month if no subscription is found.

CREATE OR REPLACE FUNCTION get_current_usage_period(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_usage_id    UUID;
    v_period_start DATE;
    v_period_end   DATE;
BEGIN
    -- Try to get period from subscription
    SELECT current_period_start, current_period_end
    INTO v_period_start, v_period_end
    FROM tenant_subscriptions
    WHERE tenant_id = p_tenant_id;

    -- Fallback: use current calendar month if no subscription row exists
    IF v_period_start IS NULL THEN
        v_period_start := DATE_TRUNC('month', CURRENT_DATE)::DATE;
        v_period_end   := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    END IF;

    -- Get existing usage record for this period
    SELECT id INTO v_usage_id
    FROM subscription_usage
    WHERE tenant_id    = p_tenant_id
      AND period_start = v_period_start;

    -- Create it if missing
    IF v_usage_id IS NULL THEN
        INSERT INTO subscription_usage (tenant_id, period_start, period_end)
        VALUES (p_tenant_id, v_period_start, v_period_end)
        RETURNING id INTO v_usage_id;
    END IF;

    RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql;
