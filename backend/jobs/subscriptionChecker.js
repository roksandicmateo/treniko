const { query } = require('../config/database');
const {
  sendTrialExpiryWarning7Days,
  sendTrialExpiryWarning3Days,
  sendSubscriptionExpiredEmail,
} = require('../services/emailService');

/**
 * Helper: get trainer email + name for a tenant
 */
async function getTrainerInfo(tenantId) {
  const r = await query(
    'SELECT first_name, email FROM users WHERE tenant_id = $1 LIMIT 1',
    [tenantId]
  );
  return r.rows[0] || null;
}

const checkExpiringSubscriptions = async () => {
  try {
    console.log('🔔 Checking for expiring subscriptions...');
    await check7DayExpiry();
    await check3DayExpiry();
    await checkExpired();
    await checkSuspended();
    console.log('✅ Subscription check complete');
  } catch (error) {
    console.error('❌ Subscription check error:', error);
  }
};

const check7DayExpiry = async () => {
  const result = await query(`
    SELECT ts.tenant_id, ts.current_period_end, sp.display_name as plan_name
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
    await query(
      `INSERT INTO subscription_notifications (tenant_id, notification_type, title, message)
       VALUES ($1, 'expiry_warning_7d', 'Subscription Expiring Soon', $2)`,
      [row.tenant_id, `Your ${row.plan_name} subscription expires in 7 days.`]
    );

    // Send email
    const trainer = await getTrainerInfo(row.tenant_id);
    if (trainer) {
      sendTrialExpiryWarning7Days({ to: trainer.email, firstName: trainer.first_name })
        .catch(err => console.error('[Email] 7-day warning failed:', err.message));
    }

    console.log(`📧 Sent 7-day warning to tenant ${row.tenant_id}`);
  }
  console.log(`   7-day warnings: ${result.rows.length} sent`);
};

const check3DayExpiry = async () => {
  const result = await query(`
    SELECT ts.tenant_id, ts.current_period_end, sp.display_name as plan_name
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
    await query(
      `INSERT INTO subscription_notifications (tenant_id, notification_type, title, message)
       VALUES ($1, 'expiry_warning_3d', 'Subscription Expiring in 3 Days', $2)`,
      [row.tenant_id, `URGENT: Your ${row.plan_name} subscription expires in 3 days.`]
    );

    const trainer = await getTrainerInfo(row.tenant_id);
    if (trainer) {
      sendTrialExpiryWarning3Days({ to: trainer.email, firstName: trainer.first_name })
        .catch(err => console.error('[Email] 3-day warning failed:', err.message));
    }

    console.log(`📧 Sent 3-day warning to tenant ${row.tenant_id}`);
  }
  console.log(`   3-day warnings: ${result.rows.length} sent`);
};

const checkExpired = async () => {
  const result = await query(`
    UPDATE tenant_subscriptions
    SET status = 'expired'
    WHERE status = 'active'
      AND current_period_end < CURRENT_DATE
      AND cancel_at_period_end = false
    RETURNING tenant_id,
      (SELECT display_name FROM subscription_plans WHERE id = plan_id) as plan_name
  `);

  for (const row of result.rows) {
    await query(
      `INSERT INTO subscription_notifications (tenant_id, notification_type, title, message)
       VALUES ($1, 'subscription_expired', 'Subscription Expired', $2)`,
      [row.tenant_id, 'Your subscription has expired. Account is now in read-only mode.']
    );

    const trainer = await getTrainerInfo(row.tenant_id);
    if (trainer) {
      sendSubscriptionExpiredEmail({
        to: trainer.email,
        firstName: trainer.first_name,
        planName: row.plan_name || 'Treniko',
      }).catch(err => console.error('[Email] Expired email failed:', err.message));
    }

    console.log(`🔒 Marked tenant ${row.tenant_id} as expired`);
  }
  console.log(`   Expired subscriptions: ${result.rows.length}`);
};

const checkSuspended = async () => {
  const result = await query(`
    UPDATE tenant_subscriptions
    SET status = 'suspended'
    WHERE status = 'expired'
      AND current_period_end < CURRENT_DATE - INTERVAL '30 days'
    RETURNING tenant_id
  `);

  for (const row of result.rows) {
    await query(
      `INSERT INTO subscription_notifications (tenant_id, notification_type, title, message)
       VALUES ($1, 'account_suspended', 'Account Suspended', 'Your account has been suspended.')`,
      [row.tenant_id]
    );
    console.log(`⛔ Suspended tenant ${row.tenant_id}`);
  }
  console.log(`   Suspended accounts: ${result.rows.length}`);
};

const getSubscriptionStats = async () => {
  const result = await query(`
    SELECT sp.display_name,
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

module.exports = { checkExpiringSubscriptions, getSubscriptionStats };
