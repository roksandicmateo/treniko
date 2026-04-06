// backend/services/emailService.js
const nodemailer = require('nodemailer');

// Warn if APP_URL not set in production
if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
  console.warn('[Email] WARNING: APP_URL is not set. Links will point to localhost!');
}

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!process.env.EMAIL_HOST) {
      console.warn('[Email] EMAIL_HOST not set — emails disabled');
      return null;
    }
    transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email DISABLED] To: ${to} | Subject: ${subject}`);
    return { skipped: true };
  }
  try {
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || 'Treniko <noreply@treniko.com>',
      to,
      subject,
      html,
      text: html.replace(/<[^>]+>/g, ''),
    });
    console.log(`[Email] Sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('[Email] Failed:', err.message);
    throw err;
  }
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
    .stat { display: inline-block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 20px; margin: 4px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 800; color: #0ea5e9; display: block; }
    .stat-label { font-size: 12px; color: #6b7280; }
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
        © ${new Date().getFullYear()} Treniko · <a href="${process.env.APP_URL || 'https://treniko.com'}/privacy">Privacy Policy</a> · <a href="${process.env.APP_URL || 'https://treniko.com'}/terms">Terms</a>
        <br><br>
        You're receiving this because you have a Treniko account.
      </div>
    </div>
  </div>
</body>
</html>`;
}

const appUrl = () => process.env.APP_URL || 'https://treniko.com';

// ── 1. Welcome email ──────────────────────────────────────────────────────────
async function sendWelcomeEmail({ to, firstName }) {
  return sendEmail({
    to,
    subject: `Welcome to Treniko, ${firstName}! 🎉`,
    html: baseLayout(`
      <h2>Welcome, ${firstName}! 👋</h2>
      <p>Your Treniko account is ready. You're on the <strong>Free plan</strong> with a <strong>14-day trial</strong> — no credit card needed.</p>
      <p>Here's how to get the most out of Treniko:</p>

      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">
          <strong>Add your first client</strong>
          Import or add your clients with contact info, goals, and health notes.
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">
          <strong>Create a training package</strong>
          Set up session-based or time-based packages to assign to clients.
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">
          <strong>Schedule a session</strong>
          Use the calendar to book and manage your training sessions.
        </div>
      </div>

      <div style="text-align:center; margin: 28px 0;">
        <a href="${appUrl()}/dashboard" class="btn">Open Treniko Dashboard →</a>
      </div>

      <hr class="divider">
      <p style="font-size:13px; color:#6b7280;">Questions? Just reply to this email — we read every message and typically respond within a few hours.</p>
    `),
  });
}

// ── 2. Password reset ─────────────────────────────────────────────────────────
async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  return sendEmail({
    to,
    subject: 'Reset your Treniko password',
    html: baseLayout(`
      <h2>Password reset request</h2>
      <p>Hi ${firstName},</p>
      <p>Someone requested a password reset for your Treniko account. Click the button below — this link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${resetUrl}" class="btn">Reset My Password →</a>
      </div>
      <hr class="divider">
      <div class="highlight">
        If you didn't request this, you can safely ignore this email. Your password won't change.
      </div>
      <p style="font-size:13px; color:#6b7280;">If the button doesn't work, copy this link into your browser:<br>
      <a href="${resetUrl}" style="color:#0ea5e9; word-break:break-all;">${resetUrl}</a></p>
    `),
  });
}

// ── 3. Trial expiring in 7 days ───────────────────────────────────────────────
async function sendTrialExpiryWarning7Days({ to, firstName }) {
  return sendEmail({
    to,
    subject: '⚠️ Your Treniko trial expires in 7 days',
    html: baseLayout(`
      <h2>Your trial ends in 7 days</h2>
      <p>Hi ${firstName},</p>
      <p>Your free trial of Treniko expires in <strong>7 days</strong>. After that, your account will switch to read-only mode until you upgrade.</p>
      <div class="warning">
        <strong>What happens when the trial ends?</strong><br>
        You won't be able to add new clients, schedule sessions, or log trainings — but all your existing data is safe.
      </div>
      <p>Upgrade now to keep everything running smoothly:</p>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${appUrl()}/dashboard/subscription" class="btn">View Plans & Upgrade →</a>
      </div>
      <hr class="divider">
      <p style="font-size:13px; color:#6b7280;">Questions about pricing? Reply to this email and we'll help you choose the right plan.</p>
    `),
  });
}

// ── 4. Trial expiring in 3 days ───────────────────────────────────────────────
async function sendTrialExpiryWarning3Days({ to, firstName }) {
  return sendEmail({
    to,
    subject: '🚨 Final warning — Treniko trial expires in 3 days',
    html: baseLayout(`
      <h2>3 days left on your trial</h2>
      <p>Hi ${firstName},</p>
      <p>This is your final reminder — your Treniko trial expires in <strong>3 days</strong>.</p>
      <div class="danger">
        <strong>Don't lose access to your data.</strong><br>
        Upgrade before your trial ends to keep scheduling sessions, logging trainings, and tracking client progress.
      </div>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${appUrl()}/dashboard/subscription" class="btn btn-danger">Upgrade Now →</a>
      </div>
      <p style="font-size:14px;">Our plans start at just <strong>€29/month</strong> for up to 50 clients with unlimited sessions.</p>
      <hr class="divider">
      <p style="font-size:13px; color:#6b7280;">Need help? Reply to this email.</p>
    `),
  });
}

// ── 5. Subscription expired ───────────────────────────────────────────────────
async function sendSubscriptionExpiredEmail({ to, firstName, planName }) {
  return sendEmail({
    to,
    subject: 'Your Treniko subscription has expired',
    html: baseLayout(`
      <h2>Your subscription has expired</h2>
      <p>Hi ${firstName},</p>
      <p>Your <strong>${planName}</strong> subscription has expired. Your account is now in <strong>read-only mode</strong> — you can still view all your data, but you can't add clients or schedule sessions.</p>
      <div class="danger">
        <strong>Your data is safe.</strong><br>
        All your clients, sessions, and training logs are preserved. Renew to regain full access instantly.
      </div>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${appUrl()}/dashboard/subscription" class="btn">Renew Subscription →</a>
      </div>
      <hr class="divider">
      <p style="font-size:13px; color:#6b7280;">Questions? Reply to this email and we'll sort it out quickly.</p>
    `),
  });
}

// ── 6. First client added ─────────────────────────────────────────────────────
async function sendFirstClientEmail({ to, firstName, clientName }) {
  return sendEmail({
    to,
    subject: `Great start, ${firstName}! 🎯 First client added`,
    html: baseLayout(`
      <h2>You added your first client! 🎯</h2>
      <p>Hi ${firstName},</p>
      <p>You just added <strong>${clientName}</strong> as your first client on Treniko — great start!</p>
      <p>Here's what to do next:</p>
      <div class="step">
        <div class="step-num">→</div>
        <div class="step-text">
          <strong>Assign a training package</strong>
          Create a session-based or time-based package and assign it to ${clientName}.
        </div>
      </div>
      <div class="step">
        <div class="step-num">→</div>
        <div class="step-text">
          <strong>Schedule your first session</strong>
          Open the calendar and book your first training session together.
        </div>
      </div>
      <div class="step">
        <div class="step-num">→</div>
        <div class="step-text">
          <strong>Log progress</strong>
          After your session, log exercises, sets, reps and track progress over time.
        </div>
      </div>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${appUrl()}/dashboard/calendar" class="btn">Schedule First Session →</a>
      </div>
    `),
  });
}

// ── 7. Account deletion scheduled ────────────────────────────────────────────
async function sendDeletionScheduledEmail({ to, firstName, deletionDate }) {
  const formattedDate = new Date(deletionDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  return sendEmail({
    to,
    subject: 'Your Treniko account is scheduled for deletion',
    html: baseLayout(`
      <h2>Account deletion scheduled</h2>
      <p>Hi ${firstName},</p>
      <p>We've received your request to delete your Treniko account. Your account and all associated data will be permanently deleted on <strong>${formattedDate}</strong>.</p>
      <div class="warning">
        <strong>Changed your mind?</strong><br>
        You can cancel the deletion at any time before ${formattedDate} from your account settings.
      </div>
      <div style="text-align:center; margin: 28px 0;">
        <a href="${appUrl()}/dashboard/profile" class="btn">Cancel Deletion →</a>
      </div>
      <hr class="divider">
      <p style="font-size:13px; color:#6b7280;">
        Before your account is deleted, you can export all your data from the profile menu.<br>
        If you have any questions, just reply to this email.
      </p>
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
