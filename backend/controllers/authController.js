const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { recordFailedLogin, resetFailedLogins } = require('../middleware/security');

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
      'SELECT id, tenant_id, email, password_hash, first_name, last_name FROM users WHERE email = $1',
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
      await recordFailedLogin(email); // ← track failed attempt
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid email or password'
      });
    }

    await resetFailedLogins(email); // ← clear counter on success

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
        lastName: user.last_name
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

    if (!email || !password || !firstName || !lastName || !businessName) {
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
      [businessName]
    );
    const tenantId = tenantResult.rows[0].id;

    const userResult = await query(
      `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, tenant_id, email, first_name, last_name`,
      [tenantId, email.toLowerCase(), passwordHash, firstName, lastName]
    );

    const user = userResult.rows[0];

    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
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

module.exports = { login, register, validateToken };
