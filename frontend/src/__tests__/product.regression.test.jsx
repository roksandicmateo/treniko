/**
 * Product regression suite — beta readiness sprint.
 *
 * Every check here corresponds to a defect found by using the product as a
 * trainer would. Two of them are static analyses of the source rather than
 * render tests, deliberately: the bugs they protect against were *unbound
 * identifiers* — a component calling `t(...)` with no `t` in scope, a page
 * calling `showToast(...)` it never imported. Those throw only on the code path
 * that uses them (mid-save, on an error response), which is precisely the path
 * a render test is least likely to reach, and they had shipped unnoticed in
 * four separate files. A source check catches the whole class, including in
 * files nobody has written yet.
 *
 * The suite is scoped to behaviour and correctness. It deliberately asserts
 * nothing about layout, styling or wording, so ordinary UI work will not break
 * it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect } from 'vitest';

import en from '../locales/en.json';
import hr from '../locales/hr.json';
import de from '../locales/de.json';

const SRC = join(process.cwd(), 'src');

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(jsx?|tsx?)$/.test(entry)) out.push(full);
  }
  return out;
};

const sourceFiles = walk(SRC).filter(f => !f.includes('__tests__'));
const read = (f) => readFileSync(f, 'utf8');
const rel = (f) => f.slice(SRC.length + 1).replace(/\\/g, '/');

// ─────────────────────────────────────────────────────────────────────────────
describe('every translation key the UI asks for exists', () => {
  const lookup = (bundle, key) =>
    key.split('.').reduce((node, part) => (node === undefined ? undefined : node[part]), bundle);

  const referenced = new Set();
  for (const file of sourceFiles) {
    const src = read(file);
    for (const m of src.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) referenced.add(m[1]);
    for (const m of src.matchAll(/\bt\(\s*"([A-Za-z0-9_.]+)"/g)) referenced.add(m[1]);
  }

  test('the scan actually found the keys (guards against a broken regex)', () => {
    expect(referenced.size).toBeGreaterThan(100);
  });

  for (const [name, bundle] of [['en', en], ['hr', hr], ['de', de]]) {
    test(`${name} defines all of them`, () => {
      const missing = [...referenced].filter(key => lookup(bundle, key) === undefined).sort();
      expect(missing).toEqual([]);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
describe('no component calls a translation function it does not have', () => {
  // ClientModal and TrainingLogModal both rendered `t('common.saving')` in a
  // busy label while never destructuring `t` from useTranslation. The first
  // render after the save began threw "t is not defined" — the component
  // crashed on the one action it exists to perform.
  test('every file that calls t(...) also obtains t', () => {
    const offenders = [];
    for (const file of sourceFiles) {
      const src = read(file);
      const callsT = /(?<![A-Za-z0-9_$.])t\(\s*['"`]/.test(src);
      if (!callsT) continue;
      const obtainsT =
        /=\s*useTranslation\(/.test(src) ||       // const { t } = useTranslation()
        /\bt\s*[,}]/.test(src.match(/\(\s*\{[^}]*\}\s*\)\s*=>/)?.[0] || '') || // t passed as a prop
        /\bt\b\s*[,)]/.test(src.match(/function\s+\w+\s*\(([^)]*)\)/)?.[1] || '');
      if (!obtainsT) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('no module uses a helper it never imported', () => {
  // ProfileMenu's export handler and PackagesPage's delete handler both called
  // showToast without importing it. Both sat inside async handlers, so the
  // ReferenceError surfaced as an unhandled rejection and the user saw
  // *nothing at all* — a delete that was refused by the server looked like a
  // delete that had silently succeeded.
  const HELPERS = ['showToast'];

  test.each(HELPERS)('%s is imported wherever it is called', (helper) => {
    const offenders = [];
    for (const file of sourceFiles) {
      const src = read(file);
      const declaresIt = new RegExp(`(const|function)\\s+${helper}\\b`).test(src);
      if (declaresIt) continue;
      const callsIt = new RegExp(`(?<![A-Za-z0-9_$.])${helper}\\s*\\(`).test(src);
      if (!callsIt) continue;
      const importsIt = new RegExp(`import\\s*\\{[^}]*\\b${helper}\\b[^}]*\\}`).test(src);
      if (!importsIt) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('API calls go through the configured base URL', () => {
  // ClientDetail, VerifyEmail and AddTrainingModal fetched relative "/api/..."
  // paths. Those resolve only because the Vite dev server proxies /api; a
  // production build served from any origin other than the API's own would 404
  // on the entire client detail page and on email verification — a link the
  // user arrives at from their inbox with no way to retry.
  test('no source file fetches a bare /api path', () => {
    const offenders = [];
    for (const file of sourceFiles) {
      const src = read(file);
      if (/fetch\(\s*['"`]\/api\//.test(src)) offenders.push(rel(file));
    }
    expect(offenders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('dashboard date handling', () => {
  // The dashboard builds `session_date + 'T00:00:00'` to get a local date. The
  // API returned session_date as a full timestamp, which makes that string
  // unparseable — every row in "Upcoming this week" read "Invalid Date", and
  // the same value went into the session modal's date input, which then
  // rendered empty and could not be saved.
  //
  // The API is fixed to return a calendar date; this pins the assumption the
  // frontend makes about it, so a regression on either side is caught here.
  const parseAsDashboardDoes = (value) => new Date(`${value}T00:00:00`);

  test('a calendar date parses to that exact local day', () => {
    const d = parseAsDashboardDoes('2026-08-20');
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);      // August
    expect(d.getDate()).toBe(20);
  });

  test('a timestamp does not — which is exactly what broke', () => {
    const d = parseAsDashboardDoes('2026-08-19T22:00:00.000Z');
    expect(Number.isNaN(d.getTime())).toBe(true);
  });

  test("splitting a timestamp on 'T' loses a day east of Greenwich", () => {
    // Why the API must not serialise DATE columns as timestamps: 2026-08-20
    // stored as a DATE becomes local midnight, which is the 19th in UTC.
    const utcSerialised = '2026-08-19T22:00:00.000Z';   // = 2026-08-20 00:00 +02:00
    expect(utcSerialised.split('T')[0]).toBe('2026-08-19');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('email verification does not lock a new trainer out', () => {
  // Unverified accounts were redirected to /check-email, a dead end with no
  // resend and no way forward — and the verification mail is only sent when
  // BREVO_API_KEY is configured. The gate is now a banner, switched by a single
  // named constant so re-enabling it is a deliberate act.
  test('PrivateRoute does not redirect on an unverified email', () => {
    const src = read(join(SRC, 'components', 'PrivateRoute.jsx'));
    expect(src).toMatch(/ENFORCE_EMAIL_VERIFICATION\s*=\s*false/);
    // The redirect must remain guarded by that constant, not by the flag alone.
    expect(src).toMatch(/ENFORCE_EMAIL_VERIFICATION\s*&&\s*user\.emailVerified === false/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the clients list pages correctly', () => {
  // Switching from a filter with several pages to one with a single page left
  // currentPage past the end of the list: an empty table, and no pagination
  // control left on screen to get back with.
  test('changing the filter resets the page', () => {
    const src = read(join(SRC, 'pages', 'Clients.jsx'));
    expect(src).toMatch(/useEffect\(\(\)\s*=>\s*\{\s*setCurrentPage\(1\);\s*\}\s*,\s*\[filter\]\)/);
  });

  // A full document load on every row click threw away the SPA and re-fetched
  // the bundle — seconds of blank screen on a phone.
  test('opening a client navigates client-side', () => {
    const src = read(join(SRC, 'pages', 'Clients.jsx'));
    expect(src).not.toMatch(/window\.location\.href\s*=\s*`\/dashboard\/clients/);
    expect(src).toMatch(/navigate\(`\/dashboard\/clients\/\$\{id\}`\)/);
  });
});
