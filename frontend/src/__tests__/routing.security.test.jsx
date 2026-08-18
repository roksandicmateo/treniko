/**
 * Routing and navigation security regressions.
 *
 * ── Why this suite exists ────────────────────────────────────────────────────
 * React Router 6.x carried three advisories that could only be resolved by
 * moving to 7.x, because 6.30.4 is the final 6.x release and no patch was
 * backported:
 *
 *   GHSA-wrjc-x8rr-h8h6  open redirect via backslash in <Link>/useNavigate
 *                        (a bypass of the CVE-2025-68470 fix)
 *   GHSA-jjmj-jmhj-qwj2  open redirect leading to XSS
 *   GHSA-337j-9hxr-rhxg  arbitrary constructor injection in deserializeErrors()
 *                        during SSR hydration
 *
 * The third does not apply here: this is a client-rendered SPA with no SSR and
 * no data router, so deserializeErrors() is never reached.
 *
 * ── What the upgrade does and does NOT give us ───────────────────────────────
 * Measured against react-router-dom 7.18.2 under BrowserRouter in jsdom, a
 * hostile value passed straight to `to` STILL produces an off-origin href:
 *
 *     <Link to="//evil.example.com">   -> href "//evil.example.com"
 *     <Link to="\\evil.example.com">   -> href "\\evil.example.com"
 *     <Link to="/\evil.example.com">   -> href "/\evil.example.com"
 *
 * all of which a browser resolves to another host. React Router deliberately
 * supports absolute and protocol-relative targets; it is a router, not a
 * sanitiser, and upgrading did not turn it into one.
 *
 * So the upgrade clears the advisories, and the control that actually protects
 * this application is unchanged and separate: **no navigation target is ever
 * attacker-controlled**. Every target is a literal absolute path, or a template
 * with a fixed `/dashboard/...` prefix and an interpolated id.
 *
 * That is a property of the application code, and exactly the kind that quietly
 * stops being true. This suite therefore pins:
 *
 *   1. the measured router behaviour, so a future change in it is noticed;
 *   2. that a hostile value inside a fixed prefix cannot escape the origin —
 *      the app's actual pattern;
 *   3. that no source file passes a bare variable as a whole navigation target
 *      — checked against the source, because no runtime test can see a call
 *      site that has not been written yet;
 *   4. that ordinary routing still works after the major upgrade.
 *
 * These are deliberately about NAVIGATION only — not layout, copy or styling —
 * so they will not break when the UI changes.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { useEffect } from 'react';
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  Link,
  Outlet,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom';

afterEach(cleanup);

/** Renders wherever the router ended up, so a test can assert on it. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

const currentLocation = () => screen.getByTestId('location').textContent;

/** Resolve a target the way a browser would, against the document's own URL. */
const originOf = (target) => new URL(target, window.location.href).origin;

/** Navigates once on mount, the way a redirect-after-action does. */
function NavigateOnMount({ to }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to); }, [navigate, to]);
  return null;
}

function ClientDetailProbe() {
  const { id } = useParams();
  return <div data-testid="client-id">{id}</div>;
}

function TrainingProbe() {
  const { id } = useParams();
  return <div data-testid="training-id">{id}</div>;
}

function GroupSessionProbe() {
  const { groupId, sessionId } = useParams();
  return <div data-testid="group-session">{`${groupId}/${sessionId}`}</div>;
}

/** Mirrors the real route tree closely enough to exercise navigation. */
function renderAt(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/dashboard" element={<div>dashboard<Outlet /></div>}>
          <Route index element={<div>dashboard home</div>} />
          <Route path="clients" element={<div>clients list</div>} />
          <Route path="clients/:id" element={<ClientDetailProbe />} />
          <Route path="trainings/:id" element={<TrainingProbe />} />
          <Route path="groups/:groupId/sessions/:sessionId" element={<GroupSessionProbe />} />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<div>not found</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ── 1. Measured router behaviour ───────────────────────────────────────────

describe('React Router does not sanitise a hostile navigation target', () => {
  // Recording behaviour, not endorsing it. These assertions are what make the
  // source guard further down load-bearing rather than belt-and-braces: if a
  // future React Router release DOES start neutralising these, this suite fails
  // and the comment above gets corrected instead of silently going stale.
  const OFF_ORIGIN_TARGETS = [
    ['protocol-relative', '//evil.example.com'],
    ['triple slash', '///evil.example.com'],
    ['double backslash', '\\\\evil.example.com'],
    ['slash then backslash', '/\\evil.example.com'],
    ['backslash then slash', '\\/evil.example.com'],
    ['absolute http URL', 'http://evil.example.com/steal'],
    ['absolute https URL', 'https://evil.example.com/steal'],
  ];

  test.each(OFF_ORIGIN_TARGETS)(
    '<Link to=%s> still resolves off-origin, so it must never receive user input',
    (_label, target) => {
      render(<BrowserRouter><Link to={target}>go</Link></BrowserRouter>);
      const href = screen.getByText('go').getAttribute('href');
      expect(originOf(href)).not.toBe(window.location.origin);
    }
  );
});

// ── 2. The app's actual pattern: hostile value inside a fixed prefix ───────

describe('a hostile id interpolated into a fixed path prefix stays on-origin', () => {
  // This is how every dynamic navigation in the app is built, e.g.
  //   navigate(`/dashboard/clients/${p.get('clientId')}`)
  // The leading literal `/dashboard/clients/` is what makes it safe: the result
  // always begins with a single slash and a path segment, so it cannot acquire
  // an authority component however hostile the id is.
  const HOSTILE_IDS = [
    '..\\..\\evil.example.com',
    '../../evil.example.com',
    '\\\\evil.example.com',
    '//evil.example.com',
    '///evil.example.com',
    'javascript:alert(1)',
    'http://evil.example.com',
    '%2f%2fevil.example.com',
    '<script>alert(1)</script>',
  ];

  test.each(HOSTILE_IDS)('<Link> to a fixed prefix + %s stays on-origin', (id) => {
    render(
      <BrowserRouter>
        <Link to={`/dashboard/clients/${id}`}>go</Link>
      </BrowserRouter>
    );
    const href = screen.getByText('go').getAttribute('href');
    expect(originOf(href)).toBe(window.location.origin);
  });

  test.each(HOSTILE_IDS)('navigate() to a fixed prefix + %s stays on-origin', (id) => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <LocationProbe />
        <Routes>
          <Route path="/start" element={<NavigateOnMount to={`/dashboard/clients/${id}`} />} />
          <Route path="*" element={<div>landed</div>} />
        </Routes>
      </MemoryRouter>
    );
    // The hostile text may survive as a path SEGMENT, which is harmless — what
    // matters is that the resolved location is still this origin.
    expect(originOf(currentLocation())).toBe(window.location.origin);
  });
});

// ── 3. Source guard: no navigation target may be untrusted ─────────────────

describe('the application never passes untrusted input as a whole navigation target', () => {
  // vitest runs with the frontend package root as its working directory.
  // Derived rather than hardcoded; the "did it find anything" test below fails
  // loudly if this ever stops resolving.
  const SRC = join(process.cwd(), 'src');

  /**
   * Reviewed exceptions: non-literal targets that were read and found to come
   * from hard-coded constants rather than from user input.
   *
   * An allowlist rather than a looser pattern, deliberately. Relaxing the regex
   * would silently permit the next non-literal target too; an entry here has to
   * be added by someone who looked at it, and says so.
   */
  const REVIEWED_EXCEPTIONS = [
    // pages/DashboardLayout.jsx renders the sidebar and bottom nav from two
    // literal arrays defined in that file; every `to` is a '/dashboard/...'
    // string constant. Nothing user-supplied reaches them.
    { file: 'DashboardLayout.jsx', target: 'item.to' },
    // components/admin/AdminLayout.jsx renders the admin sidebar from the NAV
    // array defined at the top of that same file; every `to` is an
    // '/admin/...' string constant. Nothing user-supplied reaches them.
    { file: 'AdminLayout.jsx', target: 'item.to' },
  ];

  const isReviewed = (file, target) =>
    REVIEWED_EXCEPTIONS.some((e) => file.endsWith(e.file) && target === e.target);

  const sourceFiles = (dir) => {
    const out = [];
    for (const entry of readdirSync(dir)) {
      if (entry === '__tests__' || entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (/\.(jsx?|tsx?)$/.test(entry)) out.push(full);
    }
    return out;
  };

  const files = sourceFiles(SRC);
  const baseName = (file) => file.split(/[/\\]/).pop();

  test('the scan actually found the application source', () => {
    // Without this, a broken path would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(20);
  });

  test('every navigate() target is a literal path or a fixed-prefix template', () => {
    // A target that is a bare identifier — navigate(next), navigate(returnTo) —
    // is the shape the advisories exploit, because the value can then be a whole
    // URL or a backslash-prefixed authority. Templates must start with a literal
    // '/' so the origin cannot be rewritten.
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const match of src.matchAll(/\bnavigate\(\s*([^),]+)/g)) {
        const arg = match[1].trim();
        const ok =
          /^['"]\//.test(arg) ||   // literal absolute path
          /^`\//.test(arg) ||      // template starting with a literal /
          /^-?\d+$/.test(arg);     // navigate(-1) history delta
        if (!ok && !isReviewed(file, arg)) {
          offenders.push(`${baseName(file)}: navigate(${arg.slice(0, 60)})`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every <Link>/<NavLink> to= is a literal path, a fixed-prefix template, or reviewed', () => {
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const match of src.matchAll(
        /<(?:Link|NavLink)\b[^>]*?\bto=(\{[^}]*\}|"[^"]*"|'[^']*')/g
      )) {
        const raw = match[1].trim();
        const inner = raw.startsWith('{') ? raw.slice(1, -1).trim() : raw;
        const ok = /^['"]\//.test(inner) || /^`\//.test(inner);
        if (!ok && !isReviewed(file, inner)) {
          offenders.push(`${baseName(file)}: to=${raw.slice(0, 60)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('each reviewed exception still exists, so the list cannot rot', () => {
    // An allowlist entry whose call site has gone is a stale permission.
    for (const exception of REVIEWED_EXCEPTIONS) {
      const match = files.find((f) => f.endsWith(exception.file));
      expect(match).toBeDefined();
      expect(readFileSync(match, 'utf8')).toContain(exception.target);
    }
  });

  test('no redirect target is read from the URL', () => {
    // The classic open-redirect vector: ?returnTo=... echoed into a navigation.
    // The app has no such parameter, and this keeps it that way.
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const param of ['returnTo', 'redirectTo', 'redirect_uri', 'next']) {
        if (new RegExp(`(searchParams|params)\\.get\\(\\s*['"]${param}['"]`).test(src)) {
          offenders.push(`${baseName(file)}: reads ?${param}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── 4. Ordinary routing still works after the upgrade ──────────────────────

describe('normal navigation still works after the router upgrade', () => {
  test('an internal route renders', () => {
    renderAt('/dashboard/clients');
    expect(screen.getByText('clients list')).toBeDefined();
    expect(currentLocation()).toBe('/dashboard/clients');
  });

  test('the root path redirects to the dashboard', () => {
    renderAt('/');
    expect(currentLocation()).toBe('/dashboard');
    expect(screen.getByText('dashboard home')).toBeDefined();
  });

  test('an index route renders inside its layout', () => {
    renderAt('/dashboard');
    expect(screen.getByText('dashboard')).toBeDefined();
    expect(screen.getByText('dashboard home')).toBeDefined();
  });

  test('an unknown route falls through to the catch-all', () => {
    renderAt('/no/such/page');
    expect(screen.getByText('not found')).toBeDefined();
    expect(originOf(currentLocation())).toBe(window.location.origin);
  });

  test('an external-looking path is treated as an internal path', () => {
    // `/http://evil.example.com` is a *path*, not a URL. It must fall through to
    // the catch-all rather than be followed anywhere.
    renderAt('/http://evil.example.com');
    expect(screen.getByText('not found')).toBeDefined();
    expect(originOf(currentLocation())).toBe(window.location.origin);
  });
});

describe('dynamic routes resolve their parameters', () => {
  test('client detail', () => {
    renderAt('/dashboard/clients/abc-123');
    expect(screen.getByTestId('client-id').textContent).toBe('abc-123');
  });

  test('training detail', () => {
    renderAt('/dashboard/trainings/t-42');
    expect(screen.getByTestId('training-id').textContent).toBe('t-42');
  });

  test('nested group session route resolves both parameters', () => {
    renderAt('/dashboard/groups/g-1/sessions/s-2');
    expect(screen.getByTestId('group-session').textContent).toBe('g-1/s-2');
  });

  test('a parameter containing a traversal sequence is a value, not a path', () => {
    // URL-encoded, so it stays one segment and cannot climb out of its route.
    renderAt(`/dashboard/clients/${encodeURIComponent('../../etc/passwd')}`);
    expect(screen.getByTestId('client-id').textContent).toBe('../../etc/passwd');
    expect(currentLocation().startsWith('/dashboard/clients/')).toBe(true);
  });
});

describe('query strings survive navigation intact', () => {
  function SearchProbe() {
    const [params] = useSearchParams();
    return <div data-testid="from">{params.get('from') || ''}</div>;
  }

  const renderWithQuery = (entry) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <Routes>
          <Route path="/dashboard/clients" element={<SearchProbe />} />
        </Routes>
      </MemoryRouter>
    );

  test('a query parameter is readable and does not alter the path', () => {
    renderWithQuery('/dashboard/clients?from=client&clientId=42');
    expect(screen.getByTestId('from').textContent).toBe('client');
    expect(currentLocation()).toBe('/dashboard/clients?from=client&clientId=42');
  });

  test('a hostile query value cannot move the navigation off-origin', () => {
    renderWithQuery('/dashboard/clients?from=//evil.example.com');
    expect(originOf(currentLocation())).toBe(window.location.origin);
  });
});

// ── 5. Protected-route and auth redirects ──────────────────────────────────

describe('protected routes and auth redirects', () => {
  // Mirrors components/PrivateRoute.jsx: an unauthenticated user is sent to a
  // LITERAL '/login', with no return path taken from the URL. That absence is
  // why the open-redirect advisories have no foothold here, so it is worth
  // pinning rather than leaving implicit.
  function PrivateRoute({ user, children }) {
    if (!user) return <Navigate to="/login" replace />;
    return children;
  }

  const renderGuarded = (user, entry) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route
            path="/dashboard/clients"
            element={<PrivateRoute user={user}><div>clients list</div></PrivateRoute>}
          />
        </Routes>
      </MemoryRouter>
    );

  test('an unauthenticated user is redirected to the login page', () => {
    renderGuarded(null, '/dashboard/clients');
    expect(screen.getByText('login page')).toBeDefined();
    expect(currentLocation()).toBe('/login');
  });

  test('an authenticated user reaches the protected route', () => {
    renderGuarded({ id: 'u1' }, '/dashboard/clients');
    expect(screen.getByText('clients list')).toBeDefined();
    expect(currentLocation()).toBe('/dashboard/clients');
  });

  test('the login redirect ignores an attacker-supplied return path', () => {
    renderGuarded(null, '/dashboard/clients?returnTo=https://evil.example.com');
    expect(currentLocation()).toBe('/login');
    expect(currentLocation()).not.toContain('evil.example.com');
  });

  test('logout lands on the login page and nowhere else', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <LocationProbe />
        <Routes>
          <Route path="/dashboard" element={<NavigateOnMount to="/login" />} />
          <Route path="/login" element={<div>login page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(currentLocation()).toBe('/login');
  });
});
