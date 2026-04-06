// backend/services/emailService.js
// Uses Brevo HTTP API (port 443) — works on all VPS/cloud providers

const appUrl = () => process.env.APP_URL || 'https://treniko.com';

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.log(`[Email DISABLED] No BREVO_API_KEY set. To: ${to} | Subject: ${subject}`);
    return { skipped: true };
  }

  const payload = {
    sender: {
      name: 'Treniko',
      email: process.env.EMAIL_FROM_ADDRESS || 'noreply@treniko.com',
    },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  console.log(`[Email] Sent to ${to}: messageId=${data.messageId}`);
  return data;
}

// ── Base layout ───────────────────────────────────────────────────────────────
function baseLayout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; margin: 0; padding: 0; }
    .wrap { max-width: 580px; margin: 40px auto; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); padding: 32px; text-align: center; }
    .logo { color: white; font-size: 28px; font-weight: 900; letter-spacing: -1px; margin: 0; }
    .tagline { color: rgba(255,255,255,0.8); font-size: 13px; margin: 4px 0 0; }
    .body { padding: 36px 32px; color: #374151; font-size: 15px; line-height: 1.7; }
    .body h2 { color: #111827; margin: 0 0 16px; font-size: 22px; }
    .body p { margin: 0 0 16px; }
    .btn { display: inline-block; background: #0ea5e9; color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 15px; margin: 8px 0 20px; }
    .btn-danger { background: #ef4444; }
    .step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
    .step-num { background: #0ea5e9; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; margin-top: 1px; }
    .step-text { flex: 1; }
    .step-text strong { display: block; color: #111827; margin-bottom: 2px; }
    .highlight { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; color: #0369a1; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; color: #92400e; }
    .danger  { background: #fee2e2; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; color: #991b1b; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer { padding: 20px 32px; text-align: center; font-size: 12px; color: #9ca3af; }
    .footer a { color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <p class="logo">TRENIKO</p>
        <p class="tagline">Training Management Platform</p>
      </div>
      <div class="body">${content}</div>
      <div class="footer">
        © ${new Date().getFullYear()} Treniko &nbsp;·&nbsp;
        <a href="${appUrl()}/privacy">Privacy Policy</a> &nbsp;·&nbsp;
        <a href="${appUrl()}/terms">Terms of Service</a><br><br>
        You're receiving this because you have a Treniko account.
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── 1. Welcome ────────────────────────────────────────────────────────────────
async function sendWelcomeEmail({ to, firstName }) {
  return sendEmail({
    to, subject: `Welcome to Treniko, ${firstName}! 🎉`,
    html: baseLayout(`
      <h2>Welcome, ${firstName}! 👋</h2>
      <p>Your Treniko account is ready. You're on the <strong>Free plan</strong> with a <strong>14-day trial</strong> — no credit card needed.</p>
      <p>Here's how to get started:</p>
      <div class="step"><div class="step-num">1</div><div class="step-text"><strong>Add your first client</strong>Add clients with contact info, goals, and health notes.</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text"><strong>Create a training package</strong>Set up session-based or time-based packages to assign to clients.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text"><strong>Schedule a session</strong>Use the calendar to book and manage your training sessions.</div></div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl()}/dashboard" class="btn">Open Treniko →</a>
      </div>
      <hr class="divider">
      <p style="font-size:13px;color:#6b7280;">Questions? Reply to this email — we read every message.</p>
    `),
  });
}

// ── 2. Password reset ─────────────────────────────────────────────────────────
async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  return sendEmail({
    to, subject: 'Reset your Treniko password',
    html: baseLayout(`
      <h2>Password reset request</h2>
      <p>Hi ${firstName},</p>
      <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" class="btn">Reset My Password →</a>
      </div>
      <div class="highlight">If you didn't request this, ignore this email — your password won't change.</div>
      <p style="font-size:13px;color:#6b7280;">Link not working? Copy this into your browser:<br>
      <a href="${resetUrl}" style="color:#0ea5e9;word-break:break-all;">${resetUrl}</a></p>
    `),
  });
}

// ── 3. Trial expiry — 7 days ──────────────────────────────────────────────────
async function sendTrialExpiryWarning7Days({ to, firstName }) {
  return sendEmail({
    to, subject: '⚠️ Your Treniko trial expires in 7 days',
    html: baseLayout(`
      <h2>Your trial ends in 7 days</h2>
      <p>Hi ${firstName},</p>
      <p>Your free trial expires in <strong>7 days</strong>. After that, your account switches to read-only mode.</p>
      <div class="warning"><strong>What happens when the trial ends?</strong><br>You won't be able to add clients, schedule sessions, or log trainings — but all your data stays safe.</div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl()}/dashboard/subscription" class="btn">View Plans & Upgrade →</a>
      </div>
      <p style="font-size:13px;color:#6b7280;">Questions about pricing? Just reply to this email.</p>
    `),
  });
}

// ── 4. Trial expiry — 3 days ──────────────────────────────────────────────────
async function sendTrialExpiryWarning3Days({ to, firstName }) {
  return sendEmail({
    to, subject: '🚨 Final warning — Treniko trial expires in 3 days',
    html: baseLayout(`
      <h2>3 days left on your trial</h2>
      <p>Hi ${firstName},</p>
      <p>Your Treniko trial expires in <strong>3 days</strong>.</p>
      <div class="danger"><strong>Don't lose access.</strong><br>Upgrade before your trial ends to keep scheduling sessions, logging trainings, and tracking client progress.</div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl()}/dashboard/subscription" class="btn btn-danger">Upgrade Now →</a>
      </div>
      <p style="font-size:14px;">Plans start at <strong>€29/month</strong> for up to 50 clients with unlimited sessions.</p>
    `),
  });
}

// ── 5. Subscription expired ───────────────────────────────────────────────────
async function sendSubscriptionExpiredEmail({ to, firstName, planName }) {
  return sendEmail({
    to, subject: 'Your Treniko subscription has expired',
    html: baseLayout(`
      <h2>Your subscription has expired</h2>
      <p>Hi ${firstName},</p>
      <p>Your <strong>${planName}</strong> subscription has expired. Your account is now in <strong>read-only mode</strong>.</p>
      <div class="danger"><strong>Your data is safe.</strong><br>All your clients, sessions, and training logs are preserved. Renew to regain full access instantly.</div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl()}/dashboard/subscription" class="btn">Renew Subscription →</a>
      </div>
    `),
  });
}

// ── 6. First client added ─────────────────────────────────────────────────────
async function sendFirstClientEmail({ to, firstName, clientName }) {
  return sendEmail({
    to, subject: `Great start, ${firstName}! 🎯 First client added`,
    html: baseLayout(`
      <h2>You added your first client! 🎯</h2>
      <p>Hi ${firstName},</p>
      <p>You just added <strong>${clientName}</strong> as your first client — great start!</p>
      <div class="step"><div class="step-num">→</div><div class="step-text"><strong>Assign a training package</strong>Create a package and assign it to ${clientName}.</div></div>
      <div class="step"><div class="step-num">→</div><div class="step-text"><strong>Schedule your first session</strong>Open the calendar and book your first training session.</div></div>
      <div class="step"><div class="step-num">→</div><div class="step-text"><strong>Log progress</strong>After your session, log exercises, sets, reps and track progress over time.</div></div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl()}/dashboard/calendar" class="btn">Schedule First Session →</a>
      </div>
    `),
  });
}

// ── 7. Deletion scheduled ─────────────────────────────────────────────────────
async function sendDeletionScheduledEmail({ to, firstName, deletionDate }) {
  const formatted = new Date(deletionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return sendEmail({
    to, subject: 'Your Treniko account is scheduled for deletion',
    html: baseLayout(`
      <h2>Account deletion scheduled</h2>
      <p>Hi ${firstName},</p>
      <p>Your account and all associated data will be permanently deleted on <strong>${formatted}</strong>.</p>
      <div class="warning"><strong>Changed your mind?</strong><br>You can cancel the deletion at any time before ${formatted} from your profile settings.</div>
      <div style="text-align:center;margin:28px 0;">
        <a href="${appUrl()}/dashboard/profile" class="btn">Cancel Deletion →</a>
      </div>
      <p style="font-size:13px;color:#6b7280;">Before deletion, export your data from the profile menu.</p>
    `),
  });
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendTrialExpiryWarning7Days,
  sendTrialExpiryWarning3Days,
  sendSubscriptionExpiredEmail,
  sendFirstClientEmail,
  sendDeletionScheduledEmail,
};
