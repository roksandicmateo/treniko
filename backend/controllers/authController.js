const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { recordFailedLogin, resetFailedLogins } = require('../middleware/security');
const { sendWelcomeEmail, sendVerificationEmail } = require('../services/emailService');
const crypto = require('crypto');

/**
 * User Login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Email and password are required'
      });
    }

    const result = await query(
      'SELECT id, tenant_id, email, password_hash, first_name, last_name, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      await recordFailedLogin(email);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    await resetFailedLogins(email);

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: user.email_verified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during login'
    });
  }
};

/**
 * User Registration
 */
const register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, businessName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'All fields are required'
      });
    }

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'User with this email already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const tenantResult = await query(
      'INSERT INTO tenants (name) VALUES ($1) RETURNING id',
      [businessName || `${firstName} ${lastName}`]
    );
    const tenantId = tenantResult.rows[0].id;

    const userResult = await query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, tenant_id, email, first_name, last_name`,
      [tenantId, email.toLowerCase(), passwordHash, firstName, lastName]
    );

    const user = userResult.rows[0];

    // Create free trial subscription for the new tenant
    await query(
      `INSERT INTO tenant_subscriptions (
         tenant_id, plan_id, status, billing_period,
         current_period_start, current_period_end,
         is_trial, trial_start, trial_end
       )
       SELECT
         $1,
         (SELECT id FROM subscription_plans WHERE name = 'free'),
         'active', 'monthly',
         CURRENT_DATE,
         CURRENT_DATE + INTERVAL '30 days',
         true,
         CURRENT_DATE,
         CURRENT_DATE + INTERVAL '14 days'
       WHERE NOT EXISTS (
         SELECT 1 FROM tenant_subscriptions WHERE tenant_id = $1
       )`,
      [tenantId]
    );

    // Initialize the usage record for this period
    await query(
      `INSERT INTO subscription_usage (tenant_id, period_start, period_end, clients_count, sessions_count)
       SELECT $1, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 0, 0
       WHERE NOT EXISTS (
         SELECT 1 FROM subscription_usage WHERE tenant_id = $1
       )`,
      [tenantId]
    );

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, user.id]
    );

    // Send verification email (fire-and-forget)
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    sendVerificationEmail({ to: email, firstName, verificationUrl }).catch(err =>
      console.error('[Email] Verification email failed:', err.message)
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        emailVerified: false
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during registration'
    });
  }
};

/**
 * Validate Token
 */
const validateToken = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, tenant_id, email, first_name, last_name FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'User not found'
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred during token validation'
    });
  }
};


// Verify Email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const result = await query(
      'SELECT id, email_verified, verification_token_expires FROM users WHERE verification_token = $1',
      [token]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: 'Invalid or expired verification link' });

    const user = result.rows[0];

    if (user.email_verified)
      return res.json({ success: true, message: 'Email already verified' });

    if (new Date() > new Date(user.verification_token_expires))
      return res.status(400).json({ error: 'Verification link has expired' });

    await query(
      'UPDATE users SET email_verified = true, verification_token = NULL, verification_token_expires = NULL WHERE id = $1',
      [user.id]
    );

    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    console.error('verifyEmail error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { login, register, validateToken, verifyEmail };
