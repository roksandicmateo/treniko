const { queryWithTenant } = require('../config/database');

/**
 * Middleware to check if tenant is in read-only mode
 */
const checkReadOnlyMode = async (req, res, next) => {
  try {
    const { tenantId } = req.user;

    // Skip for GET requests (read operations)
    if (req.method === 'GET') {
      return next();
    }

    // Skip for subscription-related endpoints
    if (req.path.startsWith('/subscriptions')) {
      return next();
    }

    const result = await queryWithTenant(
      `SELECT is_read_only, status, current_period_end, plan_display_name
       FROM tenant_subscription_status 
       WHERE tenant_id = $1`,
      [tenantId],
      tenantId
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No active subscription found'
      });
    }

    const sub = result.rows[0];

    if (sub.is_read_only) {
      return res.status(403).json({
        error: 'Subscription expired',
        message: 'Your subscription has expired. You are in read-only mode. Please renew your subscription to continue.',
        subscriptionStatus: {
          status: sub.status,
          expiredAt: sub.current_period_end,
          planName: sub.plan_display_name
        }
      });
    }

    next();

  } catch (error) {
    console.error('Read-only check error:', error);
    next(); // Continue on error to avoid blocking legitimate requests
  }
};

/**
 * Middleware to check client limit before creating
 */
const checkClientLimit = async (req, res, next) => {
  try {
    // Only check on client creation
    if (req.method !== 'POST' || !req.path.includes('/clients')) {
      return next();
    }

    const { tenantId } = req.user;

    const result = await queryWithTenant(
      `SELECT 
        max_clients,
        clients_count,
        clients_limit_reached,
        plan_display_name
       FROM tenant_subscription_status 
       WHERE tenant_id = $1`,
      [tenantId],
      tenantId
    );

    if (result.rows.length === 0) {
      return next(); // Let it proceed, will be caught by other checks
    }

    const sub = result.rows[0];

    if (sub.clients_limit_reached) {
      return res.status(403).json({
        error: 'Client limit reached',
        message: `You've reached your client limit (${sub.max_clients}). Upgrade your plan to add more clients.`,
        limit: sub.max_clients,
        current: sub.clients_count,
        planName: sub.plan_display_name,
        upgradeRequired: true
      });
    }

    next();

  } catch (error) {
    console.error('Client limit check error:', error);
    next(); // Continue on error
  }
};

/**
 * Middleware to check session limit before creating
 */
const checkSessionLimit = async (req, res, next) => {
  try {
    // Only check on session creation
    if (req.method !== 'POST' || !req.path.includes('/sessions')) {
      return next();
    }

    const { tenantId } = req.user;

    const result = await queryWithTenant(
      `SELECT 
        max_sessions_per_month,
        sessions_count,
        sessions_limit_reached,
        plan_display_name
       FROM tenant_subscription_status 
       WHERE tenant_id = $1`,
      [tenantId],
      tenantId
    );

    if (result.rows.length === 0) {
      return next();
    }

    const sub = result.rows[0];

    if (sub.sessions_limit_reached) {
      return res.status(403).json({
        error: 'Session limit reached',
        message: `You've reached your monthly session limit (${sub.max_sessions_per_month}). Upgrade to Pro or Enterprise for unlimited sessions.`,
        limit: sub.max_sessions_per_month,
        current: sub.sessions_count,
        planName: sub.plan_display_name,
        upgradeRequired: true
      });
    }

    next();

  } catch (error) {
    console.error('Session limit check error:', error);
    next();
  }
};

/**
 * Middleware to check feature access
 */
const checkFeatureAccess = (feature) => {
  return async (req, res, next) => {
    try {
      const { tenantId } = req.user;

      // Map features to database columns
      const featureMap = {
        training_logs: 'has_training_logs',
        analytics: 'has_analytics',
        export: 'has_export',
        api_access: 'has_api_access',
        custom_branding: 'has_custom_branding'
      };

      const dbColumn = featureMap[feature];
      if (!dbColumn) {
        return next(); // Unknown feature, let it through
      }

      const result = await queryWithTenant(
        `SELECT 
          ${dbColumn} as has_feature,
          plan_display_name
         FROM tenant_subscription_status 
         WHERE tenant_id = $1`,
        [tenantId],
        tenantId
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'No active subscription found'
        });
      }

      const sub = result.rows[0];

      if (!sub.has_feature) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `This feature is not available on your ${sub.plan_display_name} plan. Upgrade to access it.`,
          feature,
          planName: sub.plan_display_name,
          upgradeRequired: true
        });
      }

      next();

    } catch (error) {
      console.error('Feature access check error:', error);
      next();
    }
  };
};

module.exports = {
  checkReadOnlyMode,
  checkClientLimit,
  checkSessionLimit,
  checkFeatureAccess
};
