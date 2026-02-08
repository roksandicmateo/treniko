const { queryWithTenant } = require('../config/database');

/**
 * Get all training sessions for a date range
 * Used for calendar views
 */
const getSessions = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate, clientId } = req.query;

    let queryText = `
      SELECT 
        ts.id,
        ts.client_id,
        ts.session_date::text as session_date,
        ts.start_time,
        ts.end_time,
        ts.session_type,
        ts.notes,
        ts.created_at,
        ts.updated_at,
        c.first_name as client_first_name,
        c.last_name as client_last_name
      FROM training_sessions ts
      JOIN clients c ON ts.client_id = c.id
      WHERE ts.tenant_id = $1
    `;
    const params = [tenantId];

    // Add date range filter
    if (startDate) {
      queryText += ` AND ts.session_date >= $${params.length + 1}`;
      params.push(startDate);
    }
    if (endDate) {
      queryText += ` AND ts.session_date <= $${params.length + 1}`;
      params.push(endDate);
    }

    // Add client filter
    if (clientId) {
      queryText += ` AND ts.client_id = $${params.length + 1}`;
      params.push(clientId);
    }

    queryText += ' ORDER BY ts.session_date, ts.start_time';

    const result = await queryWithTenant(queryText, params, tenantId);

    res.json({
      success: true,
      sessions: result.rows
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching sessions'
    });
  }
};

/**
 * Get a single session by ID
 */
const getSessionById = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const result = await queryWithTenant(
      `SELECT 
        ts.id,
        ts.client_id,
        ts.session_date,
        ts.start_time,
        ts.end_time,
        ts.session_type,
        ts.notes,
        ts.created_at,
        ts.updated_at,
        c.first_name as client_first_name,
        c.last_name as client_last_name
       FROM training_sessions ts
       JOIN clients c ON ts.client_id = c.id
       WHERE ts.id = $1 AND ts.tenant_id = $2`,
      [id, tenantId],
      tenantId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      session: result.rows[0]
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching session'
    });
  }
};

/**
 * Create a new training session
 */
const createSession = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId, sessionDate, startTime, endTime, sessionType, notes } = req.body;

    // Validate required fields
    if (!clientId || !sessionDate || !startTime || !endTime) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Client ID, date, start time, and end time are required'
      });
    }

    // Verify client belongs to tenant
    const clientCheck = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [clientId, tenantId],
      tenantId
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found or does not belong to your account'
      });
    }

    // Create session
    const result = await queryWithTenant(
      `INSERT INTO training_sessions 
       (tenant_id, client_id, session_date, start_time, end_time, session_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, client_id, session_date, start_time, end_time, session_type, notes, created_at, updated_at`,
      [tenantId, clientId, sessionDate, startTime, endTime, sessionType || null, notes || null],
      tenantId
    );

    // Get client info for response
    const session = result.rows[0];
    const clientInfo = await queryWithTenant(
      'SELECT first_name, last_name FROM clients WHERE id = $1',
      [clientId],
      tenantId
    );

    res.status(201).json({
      success: true,
      session: {
        ...session,
        client_first_name: clientInfo.rows[0].first_name,
        client_last_name: clientInfo.rows[0].last_name
      }
    });

  } catch (error) {
    console.error('Create session error:', error);
    
    // Handle time constraint violation
    if (error.constraint === 'check_time_order') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'End time must be after start time'
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while creating session'
    });
  }
};

/**
 * Update an existing session
 */
const updateSession = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { clientId, sessionDate, startTime, endTime, sessionType, notes } = req.body;

    // Check if session exists and belongs to tenant
    const checkResult = await queryWithTenant(
      'SELECT id FROM training_sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      tenantId
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Session not found'
      });
    }

    // If clientId is being updated, verify it belongs to tenant
    if (clientId) {
      const clientCheck = await queryWithTenant(
        'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
        [clientId, tenantId],
        tenantId
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Client not found or does not belong to your account'
        });
      }
    }

    // Build dynamic update query
    const updates = [];
    const params = [];
    let paramCount = 1;

    if (clientId !== undefined) {
      updates.push(`client_id = $${paramCount++}`);
      params.push(clientId);
    }
    if (sessionDate !== undefined) {
      updates.push(`session_date = $${paramCount++}`);
      params.push(sessionDate);
    }
    if (startTime !== undefined) {
      updates.push(`start_time = $${paramCount++}`);
      params.push(startTime);
    }
    if (endTime !== undefined) {
      updates.push(`end_time = $${paramCount++}`);
      params.push(endTime);
    }
    if (sessionType !== undefined) {
      updates.push(`session_type = $${paramCount++}`);
      params.push(sessionType || null);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramCount++}`);
      params.push(notes || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No fields to update'
      });
    }

    params.push(id, tenantId);

    const result = await queryWithTenant(
      `UPDATE training_sessions 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
       RETURNING id, client_id, session_date, start_time, end_time, session_type, notes, created_at, updated_at`,
      params,
      tenantId
    );

    // Get client info for response
    const session = result.rows[0];
    const clientInfo = await queryWithTenant(
      'SELECT first_name, last_name FROM clients WHERE id = $1',
      [session.client_id],
      tenantId
    );

    res.json({
      success: true,
      session: {
        ...session,
        client_first_name: clientInfo.rows[0].first_name,
        client_last_name: clientInfo.rows[0].last_name
      }
    });

  } catch (error) {
    console.error('Update session error:', error);
    
    // Handle time constraint violation
    if (error.constraint === 'check_time_order') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'End time must be after start time'
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while updating session'
    });
  }
};

/**
 * Delete a training session
 */
const deleteSession = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Check if session exists and belongs to tenant
    const checkResult = await queryWithTenant(
      'SELECT id FROM training_sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      tenantId
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Session not found'
      });
    }

    // Delete session
    await queryWithTenant(
      'DELETE FROM training_sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
      tenantId
    );

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while deleting session'
    });
  }
};

module.exports = {
  getSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession
};
