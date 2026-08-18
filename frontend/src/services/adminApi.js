import axios from 'axios';

/**
 * Client for the platform administration API.
 *
 * ── Why this is a separate axios instance ───────────────────────────────────
 * `services/api.js` is the trainer client, and on any 401 it deletes the
 * trainer's token and hard-redirects the browser to `/login`. Reusing it here
 * would mean an expired ADMIN token silently destroyed a signed-in TRAINER
 * session and dumped a staff member on the trainer login page. The two realms
 * are separate on the server (see backend/middleware/adminAuth.js) and they
 * stay separate on the client.
 *
 * ── Storage keys are deliberately distinct ──────────────────────────────────
 * Trainer: `token` / `user`.  Admin: `treniko_admin_token` / `treniko_admin`.
 * Both can be signed in at once in the same browser without colliding, which is
 * the normal case for whoever runs TRENIKO.
 *
 * ── This file contains no authorization logic ───────────────────────────────
 * Roles are enforced by the API on every request and read from the database,
 * not from the token. Anything the UI does with `admin.role` is presentation
 * only — hiding a button the server would refuse anyway.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const ADMIN_TOKEN_KEY = 'treniko_admin_token';
export const ADMIN_USER_KEY = 'treniko_admin';

const adminApi = axios.create({
  baseURL: `${API_BASE_URL}/admin`,
  headers: { 'Content-Type': 'application/json' },
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Clear the stored admin session on 401.
 *
 * Deliberately does NOT redirect: the admin router decides where an
 * unauthenticated admin goes, and a hard `window.location` assignment here
 * would fight it and lose any in-page state. A 403 is left alone — that is a
 * role refusal, not an expired session, and the page should show it.
 */
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(ADMIN_USER_KEY);
    }
    return Promise.reject(error);
  }
);

/**
 * Turn an axios failure into one readable sentence.
 * Never surfaces a stack, a URL or a driver message to the screen.
 */
export const adminErrorMessage = (error) => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.response?.status === 403) return 'You do not have permission to do that.';
  if (error?.response?.status === 404) return 'Not found.';
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the API. Is the backend running?';
  return 'Something went wrong. Please try again.';
};

// ── Endpoints ───────────────────────────────────────────────────────────────
// One function per endpoint that actually exists in backend/routes/admin.js.
// Nothing here invents a route.

export const adminAuthAPI = {
  login: (email, password) => adminApi.post('/auth/login', { email, password }),
  me: () => adminApi.get('/auth/me'),
};

export const adminDataAPI = {
  /** GET /api/admin/overview */
  overview: () => adminApi.get('/overview'),

  /** GET /api/admin/tenants?search=&plan=&status=&page=&pageSize= */
  tenants: (params) => adminApi.get('/tenants', { params }),
  tenant: (id) => adminApi.get(`/tenants/${id}`),

  /** GET /api/admin/trainers?search=&tenantId=&verified=&locked=&page=&pageSize= */
  trainers: (params) => adminApi.get('/trainers', { params }),
  trainer: (id) => adminApi.get(`/trainers/${id}`),

  /** GET /api/admin/audit?adminId=&entityType=&tenantId=&page=&pageSize= */
  audit: (params) => adminApi.get('/audit', { params }),

  /** GET /api/admin/admins — owner only; a 403 here is expected for others. */
  admins: () => adminApi.get('/admins'),
};

/**
 * The public, unauthenticated liveness endpoint (`GET /health`).
 *
 * Sits outside `/api`, so it does not go through the admin instance. It is the
 * only system-health signal the backend exposes today — see the System page.
 */
export const healthCheck = () =>
  axios.get(`${API_BASE_URL.replace(/\/api$/, '')}/health`, { timeout: 8000 });

export default adminApi;
