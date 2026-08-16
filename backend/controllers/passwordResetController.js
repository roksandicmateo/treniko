// backend/controllers/passwordResetController.js
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { query } = require('../config/database');
const { sendPasswordResetEmail } = require('../services/emailService');
const { validatePassword, normalizeEmail } = require('../utils/validation');

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  // Always return 200 to prevent email enumeration
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: true });

    const result = await query(
      'SELECT id, tenant_id, first_name, email FROM users WHERE email = $1',
      [normalizeEmail(email)]
    );

    if (result.rows.length === 0) return res.json({ success: true });

    const user = result.rows[0];

    // Invalidate old tokens for this user
    await query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [user.id]
    );

    // Generate token
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // password_reset_tokens is keyed by user_id alone: the user already
    // determines the tenant, and password reset runs before any tenant context
    // exists. This is the shape migration 021 defines and migration 032
    // repairs historical databases to.
    //
    // Getting that shape wrong is invisible from here by design. Production ran
    // for months on a pre-021 table that still carried `tenant_id NOT NULL`, so
    // this INSERT raised 23502 — and because the catch below deliberately
    // swallows every error to keep the response identical for registered and
    // unregistered addresses, every trainer saw "check your email" while no
    // mail was ever generated. The fix belongs in the schema, not here: an
    // insert bent to satisfy an obsolete column would have hidden the drift
    // instead of removing it.
    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;

    // Dispatched without awaiting (TR-MED-10). The response body is already
    // identical for known and unknown addresses, but awaiting an outbound HTTP
    // call to Brevo made a *known* address measurably slower to answer than an
    // unknown one, which is enough to enumerate registered users. Detaching the
    // send makes both paths return on the same short path. This mirrors what
    // authController already does for the verification email.
    sendPasswordResetEmail({
      to:        user.email,
      firstName: user.first_name,
      resetUrl,
    }).catch((err) =>
      console.error('[Email] Password reset email failed:', err.message)
    );

    return res.json({ success: true });
  } catch (err) {
    // The response is deliberately indistinguishable from the success path, so
    // this log line is the ONLY evidence that a reset failed. Name the code:
    // the outage above was a constraint violation whose message was the whole
    // diagnosis.
    console.error(
      `forgotPassword error (reset NOT sent) [${err.code || 'no code'}]:`, err.message);
    return res.json({ success: true }); // still 200 — don't leak info
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.ok) {
      return res.status(400).json({ error: passwordCheck.reason });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const result = await query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       WHERE prt.token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const row = result.rows[0];

    if (row.used_at) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This reset link has expired' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // password_changed_at revokes every JWT issued before this moment, so a
    // stolen token cannot outlive the reset that was performed to stop it.
    await query(
      'UPDATE users SET password_hash = $1, password_changed_at = NOW() WHERE id = $2',
      [passwordHash, row.user_id]
    );
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { forgotPassword, resetPassword };
