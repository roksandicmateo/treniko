// backend/controllers/profileController.js  (NEW FILE)

const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * GET /api/profile
 * Returns full trainer profile including tenant (business) info.
 */
const getProfile = async (req, res) => {
  const userId = req.user.userId;
  const tenantId = req.user.tenantId;

  try {
    const [userRes, tenantRes] = await Promise.all([
      pool.query(
        `SELECT id, email, first_name, last_name, phone, bio, city, country, website, created_at
         FROM users WHERE id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT id, name, phone, website FROM tenants WHERE id = $1`,
        [tenantId]
      )
    ]);

    if (!userRes.rows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      profile: {
        ...userRes.rows[0],
        business: tenantRes.rows[0] || null
      }
    });
  } catch (error) {
    console.error('getProfile error:', error);
    return res.status(500).json({ error: 'Failed to fetch profile.' });
  }
};

/**
 * PUT /api/profile
 * Update trainer personal info.
 */
const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const tenantId = req.user.tenantId;
  const { firstName, lastName, email, phone, bio, city, country, website, businessName, businessPhone, businessWebsite } = req.body;

  try {
    // If changing email, check it's not taken by another user
    if (email) {
      const emailCheck = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [email.toLowerCase().trim(), userId]
      );
      if (emailCheck.rows.length) {
        return res.status(409).json({ error: 'This email is already in use.' });
      }
    }

    // Update user
    const userRes = await pool.query(
      `UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name  = COALESCE($2, last_name),
        email      = COALESCE($3, email),
        phone      = COALESCE($4, phone),
        bio        = COALESCE($5, bio),
        city       = COALESCE($6, city),
        country    = COALESCE($7, country),
        website    = COALESCE($8, website),
        profile_updated_at = NOW(),
        updated_at = NOW()
       WHERE id = $9
       RETURNING id, email, first_name, last_name, phone, bio, city, country, website`,
      [firstName, lastName, email?.toLowerCase().trim(), phone, bio, city, country, website, userId]
    );

    // Update tenant (business) if provided
    if (businessName || businessPhone || businessWebsite) {
      await pool.query(
        `UPDATE tenants SET
          name    = COALESCE($1, name),
          phone   = COALESCE($2, phone),
          website = COALESCE($3, website),
          updated_at = NOW()
         WHERE id = $4`,
        [businessName, businessPhone, businessWebsite, tenantId]
      );
    }

    // Audit log
    const ip = req.ip || req.connection?.remoteAddress;
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'profile_updated', 'trainer', $1, $2)`,
      [userId, ip]
    );

    return res.status(200).json({
      success: true,
      profile: userRes.rows[0]
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
};

/**
 * PUT /api/profile/password
 * Change password.
 */
const changePassword = async (req, res) => {
  const userId = req.user.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const result = await pool.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [userId]
    );

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
};

module.exports = { getProfile, updateProfile, changePassword };
