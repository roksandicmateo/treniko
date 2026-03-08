const { queryWithTenant } = require('../config/database');

const getSessions = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate, clientId } = req.query;

    let queryText = `
      SELECT 
        ts.id, ts.client_id,
        ts.session_date::text as session_date,
        ts.start_time, ts.end_time,
        ts.session_type, ts.notes,
        ts.is_completed,
        ts.created_at, ts.updated_at,
        c.first_name as client_first_name,
        c.last_name as client_last_name
      FROM training_sessions ts
      JOIN clients c ON ts.client_id = c.id
      WHERE ts.tenant_id = $1
    `;
    const params = [tenantId];

    if (startDate) { queryText += ` AND ts.session_date >= $${params.length + 1}`; params.push(startDate); }
    if (endDate)   { queryText += ` AND ts.session_date <= $${params.length + 1}`; params.push(endDate); }
    if (clientId)  { queryText += ` AND ts.client_id = $${params.length + 1}`;    params.push(clientId); }

    queryText += ' ORDER BY ts.session_date, ts.start_time';

    const result = await queryWithTenant(queryText, params, tenantId);
    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while fetching sessions' });
  }
};

const getSessionById = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const result = await queryWithTenant(
      `SELECT ts.id, ts.client_id, ts.session_date, ts.start_time, ts.end_time,
              ts.session_type, ts.notes, ts.is_completed, ts.created_at, ts.updated_at,
              c.first_name as client_first_name, c.last_name as client_last_name
       FROM training_sessions ts
       JOIN clients c ON ts.client_id = c.id
       WHERE ts.id = $1 AND ts.tenant_id = $2`,
      [id, tenantId], tenantId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Session not found' });
    }
    res.json({ success: true, session: result.rows[0] });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while fetching session' });
  }
};

const createSession = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId, sessionDate, startTime, endTime, sessionType, notes } = req.body;

    if (!clientId || !sessionDate || !startTime || !endTime) {
      return res.status(400).json({ error: 'Validation error', message: 'Client ID, date, start time, and end time are required' });
    }

    const clientCheck = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [clientId, tenantId], tenantId
    );
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Client not found or does not belong to your account' });
    }

    const result = await queryWithTenant(
      `INSERT INTO training_sessions (tenant_id, client_id, session_date, start_time, end_time, session_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, client_id, session_date, start_time, end_time, session_type, notes, is_completed, created_at, updated_at`,
      [tenantId, clientId, sessionDate, startTime, endTime, sessionType || null, notes || null],
      tenantId
    );

    const session = result.rows[0];
    const clientInfo = await queryWithTenant(
      'SELECT first_name, last_name FROM clients WHERE id = $1',
      [clientId], tenantId
    );

    res.status(201).json({
      success: true,
      session: { ...session, client_first_name: clientInfo.rows[0].first_name, client_last_name: clientInfo.rows[0].last_name }
    });
  } catch (error) {
    console.error('Create session error:', error);
    if (error.constraint === 'check_time_order') {
      return res.status(400).json({ error: 'Validation error', message: 'End time must be after start time' });
    }
    res.status(500).json({ error: 'Server error', message: 'An error occurred while creating session' });
  }
};

const updateSession = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { clientId, sessionDate, startTime, endTime, sessionType, notes, isCompleted } = req.body;

    const checkResult = await queryWithTenant(
      'SELECT id FROM training_sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId], tenantId
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Session not found' });
    }

    if (clientId) {
      const clientCheck = await queryWithTenant(
        'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
        [clientId, tenantId], tenantId
      );
      if (clientCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Not found', message: 'Client not found' });
      }
    }

    const updates = [];
    const params = [];
    let p = 1;

    if (clientId    !== undefined) { updates.push(`client_id = $${p++}`);    params.push(clientId); }
    if (sessionDate !== undefined) { updates.push(`session_date = $${p++}`); params.push(sessionDate); }
    if (startTime   !== undefined) { updates.push(`start_time = $${p++}`);   params.push(startTime); }
    if (endTime     !== undefined) { updates.push(`end_time = $${p++}`);     params.push(endTime); }
    if (sessionType !== undefined) { updates.push(`session_type = $${p++}`); params.push(sessionType || null); }
    if (notes       !== undefined) { updates.push(`notes = $${p++}`);        params.push(notes || null); }
    if (isCompleted !== undefined) {
      updates.push(`is_completed = ${(isCompleted === true || isCompleted === 'true') ? 'TRUE' : 'FALSE'}`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields to update' });
    }

    params.push(id, tenantId);
    const result = await queryWithTenant(
      `UPDATE training_sessions SET ${updates.join(', ')} WHERE id = $${p++} AND tenant_id = $${p++} RETURNING id, client_id, session_date, start_time, end_time, session_type, notes, is_completed, created_at, updated_at`,
      params, tenantId
    );

    const session = result.rows[0];
    const clientInfo = await queryWithTenant(
      'SELECT first_name, last_name FROM clients WHERE id = $1',
      [session.client_id], tenantId
    );

    res.json({
      success: true,
      session: { ...session, client_first_name: clientInfo.rows[0].first_name, client_last_name: clientInfo.rows[0].last_name }
    });
  } catch (error) {
    console.error('Update session error:', error);
    if (error.constraint === 'check_time_order') {
      return res.status(400).json({ error: 'Validation error', message: 'End time must be after start time' });
    }
    res.status(500).json({ error: 'Server error', message: 'An error occurred while updating session' });
  }
};

const deleteSession = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const checkResult = await queryWithTenant(
      'SELECT id FROM training_sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId], tenantId
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Session not found' });
    }

    await queryWithTenant(
      'DELETE FROM training_sessions WHERE id = $1 AND tenant_id = $2',
      [id, tenantId], tenantId
    );

    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while deleting session' });
  }
};

module.exports = { getSessions, getSessionById, createSession, updateSession, deleteSession };
