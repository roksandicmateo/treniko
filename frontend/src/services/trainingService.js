import api from './api'; // your existing axios instance with auth headers

// ─── Training Sessions ────────────────────────────────────────────────────────
export const trainingService = {
  /**
   * Get trainings list. Params: { clientId, from, to }
   */
  getAll: (params = {}) =>
    api.get('/trainings', { params }),

  /**
   * Get a single training with full exercises + sets
   */
  getById: (id) =>
    api.get(`/trainings/${id}`),

  /**
   * Create a training.
   * Body: { clientId, title, workoutType, startTime, endTime, notes, location, exercises[] }
   * exercises[i]: { exerciseId, exerciseName, notes, sets[] }
   * sets[j]:      { reps, weight, durationSeconds, distance, rpe, notes }
   */
  create: (data) =>
    api.post('/trainings', data),

  /**
   * Update a training. Same shape as create, all fields optional.
   */
  update: (id, data) =>
    api.put(`/trainings/${id}`, data),

  /**
   * Delete a training
   */
  delete: (id) =>
    api.delete(`/trainings/${id}`),

  /**
   * Fetch trainings for calendar range
   */
  getCalendar: (from, to) =>
    api.get('/trainings', { params: { from, to } }),

  /**
   * Upload images for a training
   */
  uploadImages: (id, files) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return api.post(`/trainings/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  /**
   * List images for a training
   */
  getBySession: (sessionId) =>
    api.get(`/trainings/by-session/${sessionId}`),

  getImages: (id) =>
    api.get(`/trainings/${id}/images`),

  /**
   * Delete a specific image
   */
  deleteImage: (trainingId, imageId) =>
    api.delete(`/trainings/${trainingId}/images/${imageId}`),
};

// ─── Exercise Library ─────────────────────────────────────────────────────────
export const exerciseService = {
  /**
   * Get exercises. Params: { search, category }
   */
  getAll: (params = {}) =>
    api.get('/exercises', { params }),

  /**
   * Create a new exercise
   * Body: { name, category, defaultUnit, description }
   */
  create: (data) =>
    api.post('/exercises', data),

  /**
   * Update an exercise
   */
  update: (id, data) =>
    api.put(`/exercises/${id}`, data),

  /**
   * Delete an exercise (fails if used in a training)
   */
  delete: (id) =>
    api.delete(`/exercises/${id}`),
};

// ─── Templates ────────────────────────────────────────────────────────────────
export const templateService = {
  getAll: () =>
    api.get('/templates'),

  getById: (id) =>
    api.get(`/templates/${id}`),

  /**
   * Body: { name, workoutType, notes, exercises[] }
   * Same shape as training exercises
   */
  create: (data) =>
    api.post('/templates', data),

  delete: (id) =>
    api.delete(`/templates/${id}`),
};

// ─── Progress ─────────────────────────────────────────────────────────────────
export const progressService = {
  /**
   * Get all progress entries for a client, grouped by metric.
   * Returns: { Weight: [...], "Body Fat %": [...], ... }
   * Params: { metric, from, to }
   */
  getForClient: (clientId, params = {}) =>
    api.get(`/progress/${clientId}`, { params }),

  /**
   * Add a progress entry (append-only).
   * Body: { metricName, value, unit, date, notes }
   */
  addEntry: (clientId, data) =>
    api.post(`/progress/${clientId}`, data),
};
