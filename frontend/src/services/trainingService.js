import api from './api';

// ─── Trainings ────────────────────────────────────────────────────────────────
export const trainingService = {
  getAll: (params = {}) =>
    api.get('/trainings', { params }),

  getById: (id) =>
    api.get(`/trainings/${id}`),

  create: (data) =>
    api.post('/trainings', data),

  update: (id, data) =>
    api.put(`/trainings/${id}`, data),

  delete: (id) =>
    api.delete(`/trainings/${id}`),

  getCalendar: (from, to) =>
    api.get('/trainings', { params: { from, to } }),

  getBySession: (sessionId) =>
    api.get(`/trainings/by-session/${sessionId}`),

  uploadImages: (id, files) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    return api.post(`/trainings/${id}/images`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getImages: (id) =>
    api.get(`/trainings/${id}/images`),

  deleteImage: (trainingId, imageId) =>
    api.delete(`/trainings/${trainingId}/images/${imageId}`),
};

// ─── Exercise Library ─────────────────────────────────────────────────────────
export const exerciseService = {
  getAll: (params = {}) =>
    api.get('/exercises', { params }),

  create: (data) =>
    api.post('/exercises', data),

  update: (id, data) =>
    api.put(`/exercises/${id}`, data),

  delete: (id) =>
    api.delete(`/exercises/${id}`),
};

// ─── Templates ────────────────────────────────────────────────────────────────
export const templateService = {
  getAll: () =>
    api.get('/templates'),

  getById: (id) =>
    api.get(`/templates/${id}`),

  create: (data) =>
    api.post('/templates', data),

  delete: (id) =>
    api.delete(`/templates/${id}`),
};

// ─── Progress ─────────────────────────────────────────────────────────────────
export const progressService = {
  // Manual body metric entries grouped by metric name
  getForClient: (clientId, params = {}) =>
    api.get(`/progress/${clientId}`, { params }),

  // Add a manual entry (append-only)
  addEntry: (clientId, data) =>
    api.post(`/progress/${clientId}`, data),

  // Delete a manual entry (derived entries cannot be deleted)
  deleteEntry: (clientId, entryId) =>
    api.delete(`/progress/${clientId}/${entryId}`),

  // Auto-derived strength stats from training sets (working sets only)
  getStrength: (clientId, params = {}) =>
    api.get(`/progress/${clientId}/strength`, { params }),
};
