const { query } = require('../config/database');

/**
 * Check for expiring subscriptions and send notifications
 * Should be run daily via cron job
 */
const checkExpiringSubscriptions = async () => {
  try {
    console.log('🔔 Checking for expiring subscriptions...');

    // Check for subscriptions expiring in 7 days
    await check7DayExpiry();

    // Check for subscriptions expiring in 3 days
    await check3DayExpiry();

    // Check for expired subscriptions
    await checkExpired();

    // Check for suspended subscriptions (30 days after expiry)
    await checkSuspended();

    console.log('✅ Subscription check complete');

  } catch (error) {
    console.error('❌ Subscription check error:', error);
  }
};

/**
 * Send notification for subscriptions expiring in 7 days
 */
const check7DayExpiry = async () => {
  const result = await query(`
    SELECT 
      ts.tenant_id,
      ts.current_period_end,
      sp.display_name as plan_name
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.status = 'active'
      AND ts.current_period_end = CURRENT_DATE + INTERVAL '7 days'
      AND NOT EXISTS (
        SELECT 1 FROM subscription_notifications sn
        WHERE sn.tenant_id = ts.tenant_id
          AND sn.notification_type = 'expiry_warning_7d'
          AND sn.sent_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
      )
  `);

  for (const row of result.rows) {
    await query(`
      INSERT INTO subscription_notifications (
        tenant_id,
        notification_type,
        title,
        message
      ) VALUES ($1, $2, $3, $4)
    `, [
      row.tenant_id,
      'expiry_warning_7d',
      'Subscription Expiring Soon',
      `Your ${row.plan_name} subscription will expire in 7 days. Please renew to avoid service interruption.`
    ]);

    console.log(`📧 Sent 7-day warning to tenant ${row.tenant_id}`);
  }

  console.log(`   7-day warnings: ${result.rows.length} sent`);
};

/**
 * Send notification for subscriptions expiring in 3 days
 */
const check3DayExpiry = async () => {
  const result = await query(`
    SELECT 
      ts.tenant_id,
      ts.current_period_end,
      sp.display_name as plan_name
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON ts.plan_id = sp.id
    WHERE ts.status = 'active'
      AND ts.current_period_end = CURRENT_DATE + INTERVAL '3 days'
      AND NOT EXISTS (
        SELECT 1 FROM subscription_notifications sn
        WHERE sn.tenant_id = ts.tenant_id
          AND sn.notification_type = 'expiry_warning_3d'
          AND sn.sent_at > CURRENT_TIMESTAMP - INTERVAL '3 days'
      )
  `);

  for (const row of result.rows) {
    await query(`
      INSERT INTO subscription_notifications (
        tenant_id,
        notification_type,
        title,
        message
      ) VALUES ($1, $2, $3, $4)
    `, [
      row.tenant_id,
      'expiry_warning_3d',
      '⚠️ Subscription Expiring in 3 Days',
      `URGENT: Your ${row.plan_name} subscription will expire in 3 days. Renew now to maintain access to all features.`
    ]);

    console.log(`📧 Sent 3-day urgent warning to tenant ${row.tenant_id}`);
  }

  console.log(`   3-day warnings: ${result.rows.length} sent`);
};

/**
 * Check and mark expired subscriptions
 */
const checkExpired = async () => {
  const result = await query(`
    UPDATE tenant_subscriptions
    SET status = 'expired'
    WHERE status = 'active'
      AND current_period_end < CURRENT_DATE
      AND cancel_at_period_end = false
    RETURNING tenant_id
  `);

  // Send notifications for newly expired subscriptions
  for (const row of result.rows) {
    await query(`
      INSERT INTO subscription_notifications (
        tenant_id,
        notification_type,
        title,
        message
      ) VALUES ($1, $2, $3, $4)
    `, [
      row.tenant_id,
      'subscription_expired',
      '🔒 Subscription Expired - Read-Only Mode',
      'Your subscription has expired. Your account is now in read-only mode. You can view your data but cannot create or edit. Please renew to restore full access.'
    ]);

    console.log(`🔒 Marked tenant ${row.tenant_id} as expired (read-only)`);
  }

  console.log(`   Expired subscriptions: ${result.rows.length}`);
};

/**
 * Check and suspend accounts 30 days after expiry
 */
const checkSuspended = async () => {
  const result = await query(`
    UPDATE tenant_subscriptions
    SET status = 'suspended'
    WHERE status = 'expired'
      AND current_period_end < CURRENT_DATE - INTERVAL '30 days'
    RETURNING tenant_id
  `);

  // Send notifications for newly suspended accounts
  for (const row of result.rows) {
    await query(`
      INSERT INTO subscription_notifications (
        tenant_id,
        notification_type,
        title,
        message
      ) VALUES ($1, $2, $3, $4)
    `, [
      row.tenant_id,
      'account_suspended',
      '⛔ Account Suspended',
      'Your account has been suspended due to non-payment. Please contact support to restore access.'
    ]);

    console.log(`⛔ Suspended tenant ${row.tenant_id}`);
  }

  console.log(`   Suspended accounts: ${result.rows.length}`);
};

/**
 * Get subscription statistics (for admin dashboard)
 */
const getSubscriptionStats = async () => {
  const result = await query(`
    SELECT 
      sp.display_name,
      COUNT(*) as tenant_count,
      COUNT(CASE WHEN ts.status = 'active' THEN 1 END) as active_count,
      COUNT(CASE WHEN ts.status = 'expired' THEN 1 END) as expired_count,
      COUNT(CASE WHEN ts.is_trial THEN 1 END) as trial_count
    FROM tenant_subscriptions ts
    JOIN subscription_plans sp ON ts.plan_id = sp.id
    GROUP BY sp.display_name
    ORDER BY sp.price_monthly
  `);

  return result.rows;
};

module.exports = {
  checkExpiringSubscriptions,
  getSubscriptionStats
};
