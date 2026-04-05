// backend/controllers/passwordResetController.js
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');
const { query } = require('../config/database');
const { sendPasswordResetEmail } = require('../services/emailService');

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  // Always return 200 to prevent email enumeration
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: true });

    const result = await query(
      'SELECT id, first_name, email FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
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

    await query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );

    const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail({
      to:        user.email,
      firstName: user.first_name,
      resetUrl,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('forgotPassword error:', err);
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
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
    await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { forgotPassword, resetPassword };
