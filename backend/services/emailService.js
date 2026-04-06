// backend/services/emailService.js
const nodemailer = require('nodemailer');

// Configure your SMTP provider here.
// Works with any SMTP: Gmail, Outlook, Mailgun, Resend, Brevo (Sendinblue), etc.
// Set these in your .env file:
//   EMAIL_HOST=smtp.gmail.com
//   EMAIL_PORT=587
//   EMAIL_USER=your@email.com
//   EMAIL_PASS=your_app_password
//   EMAIL_FROM=Treniko <noreply@yourdomain.com>

let transporter = null;

// Warn loudly in production if APP_URL is not set
if (process.env.NODE_ENV === 'production' && !process.env.APP_URL) {
  console.warn('[Email] WARNING: APP_URL is not set. Password reset links will point to localhost!');
}

function getTransporter() {
  if (!transporter) {
    if (!process.env.EMAIL_HOST) {
      console.warn('[Email] EMAIL_HOST not set — emails disabled');
      return null;
    }
    transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST,
      port:   parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_PORT === '465',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html, text }) {
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
      text: text || html.replace(/<[^>]+>/g, ''),
    });
    console.log(`[Email] Sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('[Email] Failed to send:', err.message);
    throw err;
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

function baseLayout(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Treniko</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
    .container { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0ea5e9; padding: 28px 32px; }
    .logo { color: white; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .body { padding: 32px; color: #374151; font-size: 15px; line-height: 1.6; }
    .button { display: inline-block; background: #0ea5e9; color: white !important; text-decoration: none; padding: 13px 28px; border-radius: 10px; font-weight: 600; font-size: 15px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px 32px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e2e8f0; }
    .divider { border: none; border-top: 1px solid #e2e8f0; margin: 24px 0; }
    h2 { color: #111827; margin: 0 0 16px; font-size: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><span class="logo">TRENIKO</span></div>
    <div class="body">${content}</div>
    <div class="footer">
      © ${new Date().getFullYear()} Treniko · <a href="${process.env.APP_URL || 'http://localhost:5173'}/privacy" style="color:#9ca3af;">Privacy Policy</a>
    </div>
  </div>
</body>
</html>`;
}

async function sendWelcomeEmail({ to, firstName }) {
  const appUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://treniko.com' : 'http://localhost:5173');
  return sendEmail({
    to,
    subject: 'Welcome to Treniko! 🏋️',
    html: baseLayout(`
      <h2>Welcome, ${firstName}! 👋</h2>
      <p>Your Treniko account is ready. You're on the <strong>Free plan</strong> with a 14-day trial — no credit card needed.</p>
      <p>Here's how to get started:</p>
      <ol style="padding-left:20px;">
        <li style="margin-bottom:8px;">Add your first client</li>
        <li style="margin-bottom:8px;">Create a training package</li>
        <li style="margin-bottom:8px;">Schedule a session</li>
      </ol>
      <a href="${appUrl}/dashboard" class="button">Open Treniko →</a>
      <hr class="divider">
      <p style="font-size:13px;color:#6b7280;">Questions? Reply to this email — we read every message.</p>
    `),
  });
}

async function sendPasswordResetEmail({ to, firstName, resetUrl }) {
  return sendEmail({
    to,
    subject: 'Reset your Treniko password',
    html: baseLayout(`
      <h2>Password reset request</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}" class="button">Reset Password →</a>
      <hr class="divider">
      <p style="font-size:13px;color:#6b7280;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
      <p style="font-size:13px;color:#6b7280;">If the button doesn't work, copy this link: <br>${resetUrl}</p>
    `),
  });
}

async function sendSubscriptionExpiryWarning({ to, firstName, daysLeft, planName }) {
  const appUrl = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://treniko.com' : 'http://localhost:5173');
  return sendEmail({
    to,
    subject: `Your Treniko ${planName} plan expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: baseLayout(`
      <h2>⚠️ Your subscription is expiring soon</h2>
      <p>Hi ${firstName},</p>
      <p>Your <strong>${planName}</strong> plan expires in <strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''}</strong>.</p>
      <p>After expiry your account will switch to read-only mode — you won't be able to add clients or schedule sessions until renewed.</p>
      <a href="${appUrl}/dashboard/subscription" class="button">Manage Subscription →</a>
      <hr class="divider">
      <p style="font-size:13px;color:#6b7280;">Need help? Reply to this email.</p>
    `),
  });
}

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendSubscriptionExpiryWarning,
};
