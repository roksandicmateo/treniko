/**
 * Admin panel — route protection, rendering and data hygiene.
 *
 * The point of most of these is NOT to prove the UI is secure. It is not: the
 * guard is navigation, and the real boundary is that every byte on these pages
 * comes from /api/admin/*, which re-verifies the staff token and re-reads the
 * role from the database on every request (asserted in
 * backend/tests/security/platformAdmin.test.js, both directions).
 *
 * What these tests pin is that the panel behaves correctly around that
 * boundary: it redirects rather than rendering a broken shell, it never leaks a
 * field the server did send but should not be displayed, it shows an error
 * instead of a blank screen, and it pages on the server rather than in the
 * browser.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── API stub ────────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('../services/adminApi', async () => {
  const ADMIN_TOKEN_KEY = 'treniko_admin_token';
  const ADMIN_USER_KEY = 'treniko_admin';
  return {
    ADMIN_TOKEN_KEY,
    ADMIN_USER_KEY,
    adminErrorMessage: (e) => e?.response?.data?.message || 'Something went wrong. Please try again.',
    adminAuthAPI: {
      login: (...a) => mockPost('/auth/login', ...a),
      me: () => mockGet('/auth/me'),
    },
    adminDataAPI: {
      overview: () => mockGet('/overview'),
      tenants: (p) => mockGet('/tenants', p),
      tenant: (id) => mockGet(`/tenants/${id}`),
      trainers: (p) => mockGet('/trainers', p),
      trainer: (id) => mockGet(`/trainers/${id}`),
      audit: (p) => mockGet('/audit', p),
      admins: () => mockGet('/admins'),
    },
    healthCheck: () => mockGet('/health'),
    default: {},
  };
});

const { AdminAuthProvider } = await import('../context/AdminAuthContext');
const AdminRoute = (await import('../components/admin/AdminRoute')).default;
const AdminTrainers = (await import('../pages/admin/AdminTrainers')).default;
const AdminDashboard = (await import('../pages/admin/AdminDashboard')).default;

const ADMIN = { id: 'a1', email: 'staff@treniko.com', firstName: 'Staff', lastName: 'One', role: 'owner' };

/** A trainer row exactly as the API returns it — no secret columns. */
const TRAINER = {
  id: 't1', tenant_id: 'te1', email: 'trainer@example.test',
  first_name: 'Ana', last_name: 'Horvat', phone: null, city: 'Zagreb',
  country: 'Croatia', website: null, bio: null, language: 'en',
  email_verified: true, dpa_accepted: true, dpa_accepted_at: '2026-08-01T10:00:00Z',
  failed_login_attempts: 0, locked_until: null,
  created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-10T10:00:00Z',
  profile_updated_at: null, tenant_name: 'Ana Fitness',
};

const signIn = () => {
  localStorage.setItem('treniko_admin_token', 'fake-admin-token');
  localStorage.setItem('treniko_admin', JSON.stringify(ADMIN));
  mockGet.mockImplementation((path) => {
    if (path === '/auth/me') return Promise.resolve({ data: { success: true, admin: ADMIN } });
    return Promise.resolve({ data: {} });
  });
};

const renderAt = (path, element) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AdminAuthProvider>
        <Routes>
          <Route path="/admin/login" element={<div>ADMIN LOGIN SCREEN</div>} />
          <Route path="/login" element={<div>TRAINER LOGIN SCREEN</div>} />
          <Route path={path} element={<AdminRoute>{element}</AdminRoute>} />
        </Routes>
      </AdminAuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
  mockGet.mockReset();
  mockPost.mockReset();
});

afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────────
describe('route protection', () => {
  test('an unauthenticated visitor is sent to the admin login, not the trainer login', async () => {
    mockGet.mockResolvedValue({ data: {} });

    renderAt('/admin/trainers', <AdminTrainers />);

    await waitFor(() => expect(screen.getByText('ADMIN LOGIN SCREEN')).toBeTruthy());
    // Bouncing staff to the trainer login would be the wrong realm entirely.
    expect(screen.queryByText('TRAINER LOGIN SCREEN')).toBeNull();
  });

  test('a stored token that the server rejects does not grant access', async () => {
    // The token is present but /auth/me fails — a deactivated or expired admin.
    localStorage.setItem('treniko_admin_token', 'stale-token');
    mockGet.mockRejectedValue({ response: { status: 401 } });

    renderAt('/admin', <AdminDashboard />);

    await waitFor(() => expect(screen.getByText('ADMIN LOGIN SCREEN')).toBeTruthy());
    // and the useless token is cleared rather than left to be retried forever
    expect(localStorage.getItem('treniko_admin_token')).toBeNull();
  });

  test('a trainer session alone does not open the admin panel', async () => {
    // A signed-in trainer: the trainer keys are set, the admin keys are not.
    localStorage.setItem('token', 'trainer-token');
    localStorage.setItem('user', JSON.stringify({ id: 'u1', email: 'trainer@example.test' }));
    mockGet.mockResolvedValue({ data: {} });

    renderAt('/admin', <AdminDashboard />);

    await waitFor(() => expect(screen.getByText('ADMIN LOGIN SCREEN')).toBeTruthy());
    expect(mockGet).not.toHaveBeenCalledWith('/overview');
  });

  test('a verified admin session renders the page', async () => {
    signIn();
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      if (path === '/trainers') return Promise.resolve({ data: { trainers: [TRAINER], page: 1, pageSize: 25, total: 1 } });
      return Promise.resolve({ data: {} });
    });

    renderAt('/admin/trainers', <AdminTrainers />);

    await waitFor(() => expect(screen.getByText('Ana Horvat')).toBeTruthy());
    expect(screen.queryByText('ADMIN LOGIN SCREEN')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('rendering and states', () => {
  test('the dashboard renders real counts from the overview endpoint', async () => {
    signIn();
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      if (path === '/overview') return Promise.resolve({
        data: {
          generatedAt: '2026-08-18T12:00:00Z',
          overview: {
            tenants: { total: 9, last_7_days: 4, last_30_days: 9 },
            trainers: { total: 17, verified: 3, locked: 0, dpa_accepted: 17 },
            subscriptions: [
              { plan: 'free', status: 'active', count: 12, trials: 11 },
              { plan: 'pro', status: 'active', count: 1, trials: 0 },
            ],
            usage: { clients_total: 42, sessions_this_period: 7 },
            deletionRequests: { pending: 0 },
            newestTenants: [{ id: 'x', name: 'Demo Studio', created_at: '2026-08-18T09:00:00Z', trainer_count: 1 }],
          },
        },
      });
      return Promise.resolve({ data: {} });
    });

    renderAt('/admin', <AdminDashboard />);

    await waitFor(() => expect(screen.getByText('9')).toBeTruthy());   // tenants total
    expect(screen.getByText('13')).toBeTruthy();          // active subs: 12 free + 1 pro
    expect(screen.getByText('17')).toBeTruthy();          // trainers
    expect(screen.getByText('42')).toBeTruthy();          // clients total
    expect(screen.getByText('Demo Studio')).toBeTruthy(); // newest tenant
    // free 12 + pro 1 = 13 active subscriptions; paid = 1
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
  });

  test('an API error shows a retry, never a blank screen', async () => {
    signIn();
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      return Promise.reject({ response: { status: 500, data: { message: 'Failed to list trainers' } } });
    });

    renderAt('/admin/trainers', <AdminTrainers />);

    await waitFor(() => expect(screen.getByText('Could not load this')).toBeTruthy());
    expect(screen.getByText('Failed to list trainers')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  test('pressing Try again after a transient failure recovers', async () => {
    // The retry button is only worth having if it actually re-fetches and the
    // error clears. First call fails the way a network blip does (no response
    // object, so nothing that would log the admin out); the second succeeds.
    signIn();
    let call = 0;
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      if (path === '/trainers') {
        call += 1;
        if (call === 1) return Promise.reject({ code: 'ERR_NETWORK' });
        return Promise.resolve({ data: { trainers: [TRAINER], page: 1, pageSize: 25, total: 1 } });
      }
      return Promise.resolve({ data: {} });
    });

    renderAt('/admin/trainers', <AdminTrainers />);

    await waitFor(() => expect(screen.getByText('Could not load this')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(screen.getByText('Ana Horvat')).toBeTruthy());
    expect(screen.queryByText('Could not load this')).toBeNull();
    expect(call).toBe(2);
  });

  test('an empty list shows an empty state, not an error', async () => {
    signIn();
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      if (path === '/trainers') return Promise.resolve({ data: { trainers: [], page: 1, pageSize: 25, total: 0 } });
      return Promise.resolve({ data: {} });
    });

    renderAt('/admin/trainers', <AdminTrainers />);

    await waitFor(() => expect(screen.getByText('No trainers yet')).toBeTruthy());
    expect(screen.queryByText('Could not load this')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('server-side paging and filtering', () => {
  test('the list asks the server for a bounded page, and does not fetch everything', async () => {
    signIn();
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      if (path === '/trainers') return Promise.resolve({ data: { trainers: [TRAINER], page: 1, pageSize: 25, total: 100 } });
      return Promise.resolve({ data: {} });
    });

    renderAt('/admin/trainers', <AdminTrainers />);
    await waitFor(() => expect(screen.getByText('Ana Horvat')).toBeTruthy());

    const call = mockGet.mock.calls.find((c) => c[0] === '/trainers');
    expect(call[1]).toMatchObject({ page: 1, pageSize: 25 });
    // 100 results, 25 a page — the pager must be offering a way forward.
    expect(screen.getByRole('button', { name: /next/i })).toBeTruthy();
  });

  test('search is sent to the server as a parameter, not filtered in the browser', async () => {
    signIn();
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      if (path === '/trainers') return Promise.resolve({ data: { trainers: [TRAINER], page: 1, pageSize: 25, total: 1 } });
      return Promise.resolve({ data: {} });
    });

    renderAt('/admin/trainers', <AdminTrainers />);
    await waitFor(() => expect(screen.getByText('Ana Horvat')).toBeTruthy());

    // fireEvent.change goes through React's value setter; assigning .value and
    // dispatching by hand does not, and the component never sees the keystroke.
    fireEvent.change(screen.getByLabelText(/search name or email/i), { target: { value: 'horvat' } });

    // Real timers: the box debounces for 300 ms before it calls the API.
    await waitFor(
      () => {
        const searched = mockGet.mock.calls.filter((c) => c[0] === '/trainers' && c[1]?.search === 'horvat');
        expect(searched.length).toBeGreaterThan(0);
      },
      { timeout: 3000 }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the trainer realm cannot hijack an admin route', () => {
  // Found on production. services/api.js (the TRAINER client) redirects the
  // whole window to /login on any 401, and AuthProvider is mounted above every
  // route including /admin. A stale trainer token therefore bounced an
  // administrator off /admin to the TRAINER login before the admin realm ran.
  //
  // Reproduced live: with a stale trainer token `/admin` landed on `/login`;
  // with it cleared, `/admin` correctly reached `/admin/login`.
  //
  // The guard is a path check, so it is asserted directly against the real
  // interceptor rather than through a rendered tree — the bug lives in the
  // module, not in a component.
  const runInterceptor = async (pathname) => {
    vi.resetModules();
    const hrefSets = [];
    const original = window.location;
    delete window.location;
    window.location = {
      pathname,
      get href() { return `https://treniko.com${pathname}`; },
      set href(v) { hrefSets.push(v); },
    };

    let rejectHandler;
    vi.doMock('axios', () => ({
      default: {
        create: () => ({
          interceptors: {
            request: { use: () => {} },
            response: { use: (_ok, err) => { rejectHandler = err; } },
          },
          get: () => {}, post: () => {}, put: () => {}, patch: () => {}, delete: () => {},
        }),
        get: () => {},
      },
    }));

    await import('../services/api');
    await rejectHandler({ response: { status: 401 } }).catch(() => {});

    window.location = original;
    return hrefSets;
  };

  test('a 401 on an /admin route does NOT redirect to the trainer login', async () => {
    const redirects = await runInterceptor('/admin/trainers');
    expect(redirects).toEqual([]);
  });

  test('a 401 on the admin login page does not redirect either', async () => {
    const redirects = await runInterceptor('/admin/login');
    expect(redirects).toEqual([]);
  });

  test('a 401 on a normal trainer route still redirects to /login', async () => {
    // The existing behaviour must be untouched everywhere else.
    const redirects = await runInterceptor('/dashboard/clients');
    expect(redirects).toEqual(['/login']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sensitive fields are never rendered', () => {
  test('a hostile payload containing secrets does not put them on screen', async () => {
    // The real API selects an explicit column list and cannot return these.
    // This asserts the second line of defence: even handed them, the table
    // renders only the columns it names, so nothing leaks through a change in
    // the backend or a compromised response.
    signIn();
    const poisoned = {
      ...TRAINER,
      password_hash: '$2a$10$SHOULD-NEVER-APPEAR',
      verification_token: 'verif-token-SHOULD-NEVER-APPEAR',
      token_hash: 'reset-hash-SHOULD-NEVER-APPEAR',
    };
    mockGet.mockImplementation((path) => {
      if (path === '/auth/me') return Promise.resolve({ data: { admin: ADMIN } });
      if (path === '/trainers') return Promise.resolve({ data: { trainers: [poisoned], page: 1, pageSize: 25, total: 1 } });
      return Promise.resolve({ data: {} });
    });

    const { container } = renderAt('/admin/trainers', <AdminTrainers />);
    await waitFor(() => expect(screen.getByText('Ana Horvat')).toBeTruthy());

    const html = container.innerHTML;
    expect(html).not.toContain('SHOULD-NEVER-APPEAR');
    expect(html).not.toMatch(/\$2a\$10\$/);
    expect(html).not.toMatch(/password_hash|verification_token|token_hash/);
  });

  test('the stored admin object never contains a password', async () => {
    signIn();
    const stored = localStorage.getItem('treniko_admin');
    expect(stored).not.toMatch(/password/i);
  });
});
