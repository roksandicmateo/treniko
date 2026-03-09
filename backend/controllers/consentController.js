// backend/controllers/consentController.js  (NEW FILE)

const { pool } = require('../config/database');

/**
 * POST /api/clients/:id/consent
 * Record explicit health data consent given by client to trainer.
 */
const giveConsent = async (req, res) => {
  const trainerId = req.user.userId;
  const tenantId = req.user.tenantId;
  const clientId = req.params.id;
  const ip = req.ip || req.connection.remoteAddress;
  const consentType = req.body.consent_type || 'health_data';

  try {
    // Verify client belongs to this trainer
    const clientCheck = await pool.query(
      `SELECT id FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (!clientCheck.rows.length) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    // Upsert consent — if withdrawn before, re-activate it
    const result = await pool.query(
      `INSERT INTO client_consents (trainer_id, client_id, consent_type, given_at, withdrawn_at, ip_address)
       VALUES ($1, $2, $3, NOW(), NULL, $4)
       ON CONFLICT (trainer_id, client_id, consent_type)
       DO UPDATE SET given_at = NOW(), withdrawn_at = NULL, ip_address = $4
       RETURNING *`,
      [trainerId, clientId, consentType, ip]
    );

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'consent_given', 'client', $2, $3)`,
      [trainerId, clientId, ip]
    );

    return res.status(200).json({
      success: true,
      consent: result.rows[0]
    });
  } catch (error) {
    console.error('giveConsent error:', error);
    return res.status(500).json({ error: 'Failed to record consent.' });
  }
};

/**
 * DELETE /api/clients/:id/consent
 * Record consent withdrawal.
 */
const withdrawConsent = async (req, res) => {
  const trainerId = req.user.userId;
  const tenantId = req.user.tenantId;
  const clientId = req.params.id;
  const ip = req.ip || req.connection.remoteAddress;
  const consentType = req.query.consent_type || 'health_data';

  try {
    const result = await pool.query(
      `UPDATE client_consents
       SET withdrawn_at = NOW()
       WHERE trainer_id = $1 AND client_id = $2 AND consent_type = $3
       RETURNING *`,
      [trainerId, clientId, consentType]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'No active consent found.' });
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (trainer_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'consent_withdrawn', 'client', $2, $3)`,
      [trainerId, clientId, ip]
    );

    return res.status(200).json({
      success: true,
      consent: result.rows[0]
    });
  } catch (error) {
    console.error('withdrawConsent error:', error);
    return res.status(500).json({ error: 'Failed to withdraw consent.' });
  }
};

/**
 * GET /api/clients/:id/consent
 * Check current consent status for a client.
 */
const getConsent = async (req, res) => {
  const trainerId = req.user.userId;
  const tenantId = req.user.tenantId;
  const clientId = req.params.id;
  const consentType = req.query.consent_type || 'health_data';

  try {
    const result = await pool.query(
      `SELECT * FROM client_consents
       WHERE trainer_id = $1 AND client_id = $2 AND consent_type = $3`,
      [trainerId, clientId, consentType]
    );

    if (!result.rows.length) {
      return res.status(200).json({
        has_consent: false,
        consent: null
      });
    }

    const consent = result.rows[0];
    const hasConsent = consent.given_at !== null && consent.withdrawn_at === null;

    return res.status(200).json({
      has_consent: hasConsent,
      consent
    });
  } catch (error) {
    console.error('getConsent error:', error);
    return res.status(500).json({ error: 'Failed to fetch consent status.' });
  }
};

module.exports = { giveConsent, withdrawConsent, getConsent };
