const { queryWithTenant } = require('../config/database');
const { sendDbClientError } = require('../utils/dbErrors');
const { parseBoundedInt } = require('../utils/validation');

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
        -- ::text for the same reason next_session_date is cast below: a DATE
        -- serialises as a timestamp at local midnight, which is the previous
        -- day once it reaches a client in another timezone. "Last session" is a
        -- calendar date, so it travels as one.
        c.last_session_date::text AS last_session_date,
        c.is_archived,
        cs.total_sessions,
        cs.upcoming_sessions AS upcoming_sessions_count,
        cs.completed_sessions
      FROM clients c
      LEFT JOIN client_statistics cs ON c.id = cs.client_id
      WHERE c.tenant_id = $1
    `;
    const params = [tenantId];

    if (search) {
      queryText += ` AND (c.first_name ILIKE $${params.length + 1} OR c.last_name ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (isActive !== undefined) {
      queryText += ` AND c.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    queryText += ' ORDER BY c.last_name, c.first_name';

    const result = await queryWithTenant(queryText, params, tenantId);

    res.json({ success: true, clients: result.rows });

  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while fetching clients' });
  }
};

/**
 * Get a single client by ID with full details
 */
const getClientById = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const clientResult = await queryWithTenant(
      `SELECT 
        c.id, c.first_name, c.last_name, c.email, c.phone, c.is_active,
        c.created_at, c.updated_at, c.last_session_date::text AS last_session_date,
        c.date_of_birth, c.goals, c.injuries, c.diet_notes, c.notes,
        cs.total_sessions, cs.upcoming_sessions AS upcoming_sessions_count,
        cs.completed_sessions, cs.next_session_date::text AS next_session_date
       FROM clients c
       LEFT JOIN client_statistics cs ON c.id = cs.client_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId],
      tenantId
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Client not found' });
    }

    const upcomingSessions = await queryWithTenant(
      `SELECT id, session_date::text AS session_date, start_time, end_time,
              session_type, notes, status
       FROM training_sessions
       WHERE client_id = $1 AND tenant_id = $2 AND session_date >= CURRENT_DATE
         AND status = 'scheduled'
       ORDER BY session_date, start_time LIMIT 10`,
      [id, tenantId], tenantId
    );

    const recentSessions = await queryWithTenant(
      `SELECT id, session_date::text AS session_date, start_time, end_time,
              session_type, notes, status
       FROM training_sessions
       WHERE client_id = $1 AND tenant_id = $2 AND session_date < CURRENT_DATE
       ORDER BY session_date DESC, start_time DESC LIMIT 10`,
      [id, tenantId], tenantId
    );

    // ── The response contract for "upcoming" ─────────────────────────────
    // Two different things used to share the name `upcoming_sessions`: the
    // numeric count from client_statistics, spread in from the row above, and
    // the array of session rows below — which overwrote it. The client detail
    // page reads `Number(client.upcoming_sessions)`, and Number([...]) is NaN
    // for anything but a single-element array, so the "Upcoming" tile on every
    // client read 0 no matter how many sessions were scheduled.
    //
    // The two are now named for what they are, here and in the list endpoint
    // above, so the count means the same thing everywhere it appears:
    //   upcoming_sessions_count  number, from client_statistics
    //   upcoming_sessions        array, the next 10 scheduled sessions
    res.json({
      success: true,
      client: {
        ...clientResult.rows[0],
        upcoming_sessions: upcomingSessions.rows,
        recent_sessions: recentSessions.rows
      }
    });

  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while fetching client' });
  }
};

/**
 * Get all training sessions for a specific client
 */
const getClientSessions = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    // Bounded (OWASP API4): the raw value went straight into SQL LIMIT, so one
    // request could ask for the whole table, and a non-numeric value became NaN
    // and a 500.
    const limit = parseBoundedInt(req.query.limit, { fallback: 50, max: 200 });

    const clientCheck = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId], tenantId
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Client not found' });
    }

    let queryText = `
      SELECT id, session_date::text AS session_date, start_time, end_time,
             session_type, notes, status, is_completed, created_at
      FROM training_sessions
      WHERE client_id = $1 AND tenant_id = $2
    `;
    const params = [id, tenantId];

    if (startDate) { queryText += ` AND session_date >= $${params.length + 1}`; params.push(startDate); }
    if (endDate)   { queryText += ` AND session_date <= $${params.length + 1}`; params.push(endDate); }

    queryText += ` ORDER BY session_date DESC, start_time DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await queryWithTenant(queryText, params, tenantId);
    res.json({ success: true, sessions: result.rows });

  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Get client sessions error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while fetching sessions' });
  }
};

/**
 * Create a new client
 */
const createClient = async (req, res) => {
  try {
    const { tenantId } = req.user;
const { firstName, lastName, email, phone, isActive, dateOfBirth, goals, injuries, dietNotes, notes, isArchived } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'Validation error', message: 'First name and last name are required' });
    }

    // Every field the handler accepts is written. The INSERT used to store only
    // the first five, so a caller that supplied a date of birth, goals,
    // injuries, diet or general notes on creation got a 201 and silently lost
    // them — the values only ever persisted through a subsequent update.
    const result = await queryWithTenant(
      `INSERT INTO clients (tenant_id, first_name, last_name, email, phone,
                            is_active, is_archived, date_of_birth, goals,
                            injuries, diet_notes, notes)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), COALESCE($7, false),
               $8, $9, $10, $11, $12)
       RETURNING id, first_name, last_name, email, phone, is_active, is_archived,
                 date_of_birth, goals, injuries, diet_notes, notes,
                 created_at, updated_at`,
      [
        tenantId, firstName, lastName, email || null, phone || null,
        typeof isActive === 'boolean' ? isActive : null,
        typeof isArchived === 'boolean' ? isArchived : null,
        dateOfBirth || null, goals || null, injuries || null,
        dietNotes || null, notes || null,
      ],
      tenantId
    );

    res.status(201).json({ success: true, client: result.rows[0] });

  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while creating client' });
  }
};

/**
 * Update an existing client — supports all fields including notes
 */
const updateClient = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
const {
  firstName, lastName, email, phone, isActive,
  dateOfBirth, goals, injuries, dietNotes, notes, isArchived
} = req.body;


    // REACTIVATION_LIMIT_CHECK — provjerava limit pri aktivaciji klijenta
    if (isActive === true) {
      try {
        const limitResult = await queryWithTenant(
          `SELECT max_clients, clients_count, clients_limit_reached
           FROM tenant_subscription_status WHERE tenant_id = $1`,
          [tenantId], tenantId
        );
        if (limitResult.rows.length > 0 && limitResult.rows[0].clients_limit_reached) {
          return res.status(403).json({
            error: 'Client limit reached',
            message: `You've reached your plan limit of ${limitResult.rows[0].max_clients} active clients. Upgrade to add more.`,
            limit: limitResult.rows[0].max_clients,
            current: limitResult.rows[0].clients_count,
            upgradeRequired: true,
          });
        }
      } catch (limitErr) {
        console.error('Limit check error (non-fatal):', limitErr.message);
      }
    }
    // END REACTIVATION_LIMIT_CHECK

    const checkResult = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId], tenantId
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Client not found' });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (firstName   !== undefined) { updates.push(`first_name = $${paramCount++}`);    params.push(firstName); }
    if (lastName    !== undefined) { updates.push(`last_name = $${paramCount++}`);     params.push(lastName); }
    if (email       !== undefined) { updates.push(`email = $${paramCount++}`);         params.push(email || null); }
    if (phone       !== undefined) { updates.push(`phone = $${paramCount++}`);         params.push(phone || null); }
    if (isActive    !== undefined) { updates.push(`is_active = $${paramCount++}`);     params.push(isActive); }
    if (dateOfBirth !== undefined) { updates.push(`date_of_birth = $${paramCount++}`); params.push(dateOfBirth || null); }
    if (goals       !== undefined) { updates.push(`goals = $${paramCount++}`);         params.push(goals || null); }
    if (injuries    !== undefined) { updates.push(`injuries = $${paramCount++}`);      params.push(injuries || null); }
    if (dietNotes   !== undefined) { updates.push(`diet_notes = $${paramCount++}`);    params.push(dietNotes || null); }
    if (isArchived !== undefined) { updates.push(`is_archived = $${paramCount++}`); params.push(isArchived); }
    if (notes       !== undefined) { updates.push(`notes = $${paramCount++}`);         params.push(notes || null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields to update' });
    }

    params.push(id, tenantId);

    const result = await queryWithTenant(
      `UPDATE clients 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount++} AND tenant_id = $${paramCount++}
       RETURNING id, first_name, last_name, email, phone, is_active, is_archived,
                 date_of_birth, goals, injuries, diet_notes, notes,
                 created_at, updated_at`,
      params, tenantId
    );

    res.json({ success: true, client: result.rows[0] });

  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while updating client' });
  }
};

/**
 * Delete a client (hard delete)
 */
const deleteClient = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const checkResult = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId], tenantId
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Client not found' });
    }

    await queryWithTenant(
      'DELETE FROM clients WHERE id = $1 AND tenant_id = $2',
      [id, tenantId], tenantId
    );

    res.json({ success: true, message: 'Client deleted successfully' });

  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while deleting client' });
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
      `UPDATE clients SET is_active = false
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, first_name, last_name, email, phone, is_active, created_at, updated_at`,
      [id, tenantId], tenantId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Client not found' });
    }

    res.json({ success: true, client: result.rows[0] });

  } catch (error) {
    if (sendDbClientError(res, error)) return;
    console.error('Deactivate client error:', error);
    res.status(500).json({ error: 'Server error', message: 'An error occurred while deactivating client' });
  }
};

module.exports = {
  getAllClients, getClientById, getClientSessions,
  createClient, updateClient, deleteClient, deactivateClient
};
