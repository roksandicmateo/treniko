import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Authentication APIs
export const authAPI = {
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  register: (data) => 
    api.post('/auth/register', data),
  
  validateToken: () => 
    api.get('/auth/validate'),
};

// Clients APIs
export const clientsAPI = {
  getAll: (params = {}) => 
    api.get('/clients', { params }),
  
  getById: (id) => 
    api.get(`/clients/${id}`),
  
  create: (data) => 
    api.post('/clients', data),
  
  update: (id, data) => 
    api.put(`/clients/${id}`, data),
  
  delete: (id) => 
    api.delete(`/clients/${id}`),
  
  deactivate: (id) => 
    api.patch(`/clients/${id}/deactivate`),
};

// Sessions APIs
export const sessionsAPI = {
  getAll: (params = {}) => 
    api.get('/sessions', { params }),
  
  getById: (id) => 
    api.get(`/sessions/${id}`),
  
  create: (data) => 
    api.post('/sessions', data),
  
  update: (id, data) => 
    api.put(`/sessions/${id}`, data),
  
  delete: (id) => 
    api.delete(`/sessions/${id}`),
};

// Training Logs APIs
export const trainingLogsAPI = {
  getBySession: (sessionId) =>
    api.get(`/training-logs/session/${sessionId}`),
  
  save: (sessionId, data) =>
    api.post(`/training-logs/session/${sessionId}`, data),
  
  delete: (sessionId) =>
    api.delete(`/training-logs/session/${sessionId}`),
  
  getExerciseStats: (clientId) =>
    api.get(`/training-logs/client/${clientId}/exercise-stats`),
  
  getCompletionStats: (clientId) =>
    api.get(`/training-logs/client/${clientId}/completion-stats`),
};

// Subscriptions APIs
export const subscriptionsAPI = {
  getStatus: () => 
    api.get('/subscriptions/status'),
  
  getPlans: () => 
    api.get('/subscriptions/plans'),
  
  checkLimit: (resource) => 
    api.get(`/subscriptions/check/${resource}`),
  
  getNotifications: () => 
    api.get('/subscriptions/notifications'),
  
  markNotificationRead: (notificationId) => 
    api.patch(`/subscriptions/notifications/${notificationId}/read`),
  
  changePlan: (planId, billingPeriod) => 
    api.post('/subscriptions/change-plan', { planId, billingPeriod }),
  
  cancelSubscription: (cancelAtPeriodEnd) => 
    api.post('/subscriptions/cancel', { cancelAtPeriodEnd })
};

export default api;
