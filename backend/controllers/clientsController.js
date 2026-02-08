const { queryWithTenant } = require('../config/database');

/**
 * Get all clients for the authenticated tenant
 */
const getAllClients = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { search, isActive } = req.query;

    let queryText = `
      SELECT 
        c.id, 
        c.first_name, 
        c.last_name, 
        c.email, 
        c.phone, 
        c.is_active, 
        c.created_at, 
        c.updated_at,
        c.last_session_date,
        cs.total_sessions,
        cs.upcoming_sessions,
        cs.completed_sessions
      FROM clients c
      LEFT JOIN client_statistics cs ON c.id = cs.client_id
      WHERE c.tenant_id = $1
    `;
    const params = [tenantId];

    // Add search filter
    if (search) {
      queryText += ` AND (c.first_name ILIKE $${params.length + 1} OR c.last_name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    // Add active filter
    if (isActive !== undefined) {
      queryText += ` AND c.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    queryText += ' ORDER BY c.last_name, c.first_name';

    const result = await queryWithTenant(queryText, params, tenantId);

    res.json({
      success: true,
      clients: result.rows
    });

  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching clients'
    });
  }
};

/**
 * Get a single client by ID with full details and statistics
 */
const getClientById = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Get client details with statistics
    const clientResult = await queryWithTenant(
      `SELECT 
        c.id, 
        c.first_name, 
        c.last_name, 
        c.email, 
        c.phone, 
        c.is_active, 
        c.created_at, 
        c.updated_at,
        c.last_session_date,
        cs.total_sessions,
        cs.upcoming_sessions,
        cs.completed_sessions,
        cs.next_session_date
       FROM clients c
       LEFT JOIN client_statistics cs ON c.id = cs.client_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId],
      tenantId
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    // Get upcoming sessions
    const upcomingSessions = await queryWithTenant(
      `SELECT 
        id, session_date, start_time, end_time, session_type, notes
       FROM training_sessions
       WHERE client_id = $1 AND tenant_id = $2 AND session_date >= CURRENT_DATE
       ORDER BY session_date, start_time
       LIMIT 10`,
      [id, tenantId],
      tenantId
    );

    // Get recent completed sessions
    const recentSessions = await queryWithTenant(
      `SELECT 
        id, session_date, start_time, end_time, session_type, notes
       FROM training_sessions
       WHERE client_id = $1 AND tenant_id = $2 AND session_date < CURRENT_DATE
       ORDER BY session_date DESC, start_time DESC
       LIMIT 10`,
      [id, tenantId],
      tenantId
    );

    res.json({
      success: true,
      client: {
        ...clientResult.rows[0],
        upcoming_sessions: upcomingSessions.rows,
        recent_sessions: recentSessions.rows
      }
    });

  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching client'
    });
  }
};

/**
 * Get all training sessions for a specific client
 */
const getClientSessions = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;

    // Verify client belongs to tenant
    const clientCheck = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      tenantId
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    let queryText = `
      SELECT 
        id, session_date, start_time, end_time, session_type, notes, created_at
      FROM training_sessions
      WHERE client_id = $1 AND tenant_id = $2
    `;
    const params = [id, tenantId];

    if (startDate) {
      queryText += ` AND session_date >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      queryText += ` AND session_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    queryText += ` ORDER BY session_date DESC, start_time DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await queryWithTenant(queryText, params, tenantId);

    res.json({
      success: true,
      sessions: result.rows
    });

  } catch (error) {
    console.error('Get client sessions error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching sessions'
    });
  }
};

/**
 * Create a new client
 */
const createClient = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { firstName, lastName, email, phone } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'First name and last name are required'
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO clients (tenant_id, first_name, last_name, email, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, first_name, last_name, email, phone, is_active, created_at, updated_at`,
      [tenantId, firstName, lastName, email || null, phone || null],
      tenantId
    );

    res.status(201).json({
      success: true,
      client: result.rows[0]
    });

  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while creating client'
    });
  }
};

/**
 * Update an existing client
 */
const updateClient = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { firstName, lastName, email, phone, isActive } = req.body;

    // Check if client exists and belongs to tenant
    const checkResult = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      tenantId
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      params.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      params.push(lastName);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      params.push(email || null);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      params.push(phone || null);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      params.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No fields to update'
      });
    }

    params.push(id, tenantId);

    const result = await queryWithTenant(
      `UPDATE clients 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
       RETURNING id, first_name, last_name, email, phone, is_active, created_at, updated_at`,
      params,
      tenantId
    );

    res.json({
      success: true,
      client: result.rows[0]
    });

  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while updating client'
    });
  }
};

/**
 * Delete a client (hard delete)
 */
const deleteClient = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Check if client exists and belongs to tenant
    const checkResult = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      tenantId
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    // Delete client (cascade will handle sessions)
    await queryWithTenant(
      'DELETE FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      tenantId
    );

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });

  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while deleting client'
    });
  }
};

/**
 * Soft delete a client (deactivate)
 */
const deactivateClient = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const result = await queryWithTenant(
      `UPDATE clients 
       SET is_active = false
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, first_name, last_name, email, phone, is_active, created_at, updated_at`,
      [id, tenantId],
      tenantId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    res.json({
      success: true,
      client: result.rows[0]
    });

  } catch (error) {
    console.error('Deactivate client error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while deactivating client'
    });
  }
};

module.exports = {
  getAllClients,
  getClientById,
  getClientSessions,
  createClient,
  updateClient,
  deleteClient,
  deactivateClient
};
