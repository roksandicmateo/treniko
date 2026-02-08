const { queryWithTenant } = require('../config/database');

/**
 * Get training log for a specific session
 */
const getTrainingLog = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { sessionId } = req.params;

    // Verify session belongs to tenant
    const sessionCheck = await queryWithTenant(
      'SELECT id FROM training_sessions WHERE id = $1 AND tenant_id = $2',
      [sessionId, tenantId],
      tenantId
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Session not found'
      });
    }

    // Get training log with exercises
    const logResult = await queryWithTenant(
      `SELECT 
        tl.id,
        tl.session_id,
        tl.notes,
        tl.duration_minutes,
        tl.completed_at,
        tl.created_at
       FROM training_logs tl
       WHERE tl.session_id = $1 AND tl.tenant_id = $2`,
      [sessionId, tenantId],
      tenantId
    );

    if (logResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Training log not found'
      });
    }

    const log = logResult.rows[0];

    // Get exercises for this log
    const exercisesResult = await queryWithTenant(
      `SELECT 
        id,
        exercise_name,
        sets,
        reps,
        weight,
        weight_unit,
        duration_minutes,
        distance,
        distance_unit,
        notes,
        order_index
       FROM exercise_entries
       WHERE training_log_id = $1
       ORDER BY order_index, created_at`,
      [log.id],
      tenantId
    );

    res.json({
      success: true,
      trainingLog: {
        ...log,
        exercises: exercisesResult.rows
      }
    });

  } catch (error) {
    console.error('Get training log error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching training log'
    });
  }
};

/**
 * Create or update training log for a session
 */
const saveTrainingLog = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { sessionId } = req.params;
    const { notes, durationMinutes, exercises } = req.body;

    // Verify session belongs to tenant and is in the past
    const sessionResult = await queryWithTenant(
      `SELECT id, session_date, is_completed 
       FROM training_sessions 
       WHERE id = $1 AND tenant_id = $2`,
      [sessionId, tenantId],
      tenantId
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Session not found'
      });
    }

    const session = sessionResult.rows[0];

    // Check if session date is in the past or today
    const sessionDate = new Date(session.session_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (sessionDate > today) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Cannot log a future training session'
      });
    }

    // Check if log already exists
    const existingLog = await queryWithTenant(
      'SELECT id FROM training_logs WHERE session_id = $1',
      [sessionId],
      tenantId
    );

    let logId;

    if (existingLog.rows.length > 0) {
      // Update existing log
      logId = existingLog.rows[0].id;
      
      await queryWithTenant(
        `UPDATE training_logs 
         SET notes = $1, duration_minutes = $2
         WHERE id = $3`,
        [notes || null, durationMinutes || null, logId],
        tenantId
      );

      // Delete existing exercises to replace them
      await queryWithTenant(
        'DELETE FROM exercise_entries WHERE training_log_id = $1',
        [logId],
        tenantId
      );

    } else {
      // Create new log
      const logResult = await queryWithTenant(
        `INSERT INTO training_logs (session_id, tenant_id, notes, duration_minutes)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [sessionId, tenantId, notes || null, durationMinutes || null],
        tenantId
      );

      logId = logResult.rows[0].id;
    }

    // Insert exercises
    if (exercises && exercises.length > 0) {
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        await queryWithTenant(
          `INSERT INTO exercise_entries 
           (training_log_id, exercise_name, sets, reps, weight, weight_unit, 
            duration_minutes, distance, distance_unit, notes, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            logId,
            ex.exerciseName,
            ex.sets || null,
            ex.reps || null,
            ex.weight || null,
            ex.weightUnit || 'kg',
            ex.durationMinutes || null,
            ex.distance || null,
            ex.distanceUnit || 'km',
            ex.notes || null,
            i
          ],
          tenantId
        );
      }
    }

    // Get the complete log with exercises
    const savedLog = await queryWithTenant(
      `SELECT 
        tl.id,
        tl.session_id,
        tl.notes,
        tl.duration_minutes,
        tl.completed_at,
        tl.created_at
       FROM training_logs tl
       WHERE tl.id = $1`,
      [logId],
      tenantId
    );

    const exercisesResult = await queryWithTenant(
      `SELECT 
        id,
        exercise_name,
        sets,
        reps,
        weight,
        weight_unit,
        duration_minutes,
        distance,
        distance_unit,
        notes,
        order_index
       FROM exercise_entries
       WHERE training_log_id = $1
       ORDER BY order_index`,
      [logId],
      tenantId
    );

    res.status(existingLog.rows.length > 0 ? 200 : 201).json({
      success: true,
      trainingLog: {
        ...savedLog.rows[0],
        exercises: exercisesResult.rows
      }
    });

  } catch (error) {
    console.error('Save training log error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while saving training log'
    });
  }
};

/**
 * Delete training log
 */
const deleteTrainingLog = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { sessionId } = req.params;

    // Check if log exists
    const logCheck = await queryWithTenant(
      `SELECT tl.id 
       FROM training_logs tl
       JOIN training_sessions ts ON tl.session_id = ts.id
       WHERE tl.session_id = $1 AND ts.tenant_id = $2`,
      [sessionId, tenantId],
      tenantId
    );

    if (logCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Training log not found'
      });
    }

    // Delete log (exercises will be deleted via CASCADE)
    await queryWithTenant(
      'DELETE FROM training_logs WHERE session_id = $1',
      [sessionId],
      tenantId
    );

    res.json({
      success: true,
      message: 'Training log deleted successfully'
    });

  } catch (error) {
    console.error('Delete training log error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while deleting training log'
    });
  }
};

/**
 * Get client exercise statistics
 */
const getClientExerciseStats = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    // Verify client belongs to tenant
    const clientCheck = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [clientId, tenantId],
      tenantId
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    const stats = await queryWithTenant(
      `SELECT 
        exercise_name,
        total_times_performed,
        max_weight,
        avg_weight,
        last_performed
       FROM client_exercise_stats
       WHERE client_id = $1 AND tenant_id = $2
       ORDER BY total_times_performed DESC, exercise_name`,
      [clientId, tenantId],
      tenantId
    );

    res.json({
      success: true,
      exerciseStats: stats.rows
    });

  } catch (error) {
    console.error('Get exercise stats error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching exercise statistics'
    });
  }
};

/**
 * Get training completion statistics for a client
 */
const getCompletionStats = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { clientId } = req.params;

    // Verify client belongs to tenant
    const clientCheck = await queryWithTenant(
      'SELECT id FROM clients WHERE id = $1 AND tenant_id = $2',
      [clientId, tenantId],
      tenantId
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Client not found'
      });
    }

    const stats = await queryWithTenant(
      `SELECT 
        total_sessions,
        completed_sessions,
        missed_sessions,
        completion_rate
       FROM training_completion_stats
       WHERE client_id = $1 AND tenant_id = $2`,
      [clientId, tenantId],
      tenantId
    );

    res.json({
      success: true,
      completionStats: stats.rows[0] || {
        total_sessions: 0,
        completed_sessions: 0,
        missed_sessions: 0,
        completion_rate: 0
      }
    });

  } catch (error) {
    console.error('Get completion stats error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'An error occurred while fetching completion statistics'
    });
  }
};

module.exports = {
  getTrainingLog,
  saveTrainingLog,
  deleteTrainingLog,
  getClientExerciseStats,
  getCompletionStats
};
