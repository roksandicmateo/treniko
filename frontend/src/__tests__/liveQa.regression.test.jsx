/**
 * Frontend regressions for the live QA run of 16 Aug 2026.
 *
 *   BUG-2  training times were routed through `new Date(...).toISOString()`,
 *          which turns a wall clock into an instant and back again with the UTC
 *          offset applied twice.
 *   BUG-3  GroupSessionDetail sent `location: location || null`. The state is
 *          `sessionLocation`; the bare identifier resolves to window.location,
 *          which serialises to a large object and tripped the API's
 *          200-character limit. Every group session save failed with 400 —
 *          attendance, status, notes and the shared exercise log could never be
 *          saved, and no error was shown.
 *   BUG-4  measurement history arrives newest-first while First / Latest /
 *          Change assume chronological order, so a gain was reported as a loss.
 *   BUG-5  Groups and Exercises were in the desktop nav only, which is
 *          display:none on a phone. Both pages were reachable at 386px by
 *          typing the URL and by no other means.
 *   BUG-6  page-level horizontal overflow at 386px, caused by flex and grid
 *          children that were not allowed to shrink below their content.
 *
 * The render tests use the real components. The source checks are here for the
 * same reason the existing suite uses them: an unbound identifier and a missing
 * shrink allowance are both invisible to a jsdom render — the first only throws
 * on the save path, and the second is a layout property jsdom does not compute.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import {
  toDatePart, toTimePart, addHourTime, toWallClock, localDate,
} from '../utils/wallClock';

const SRC = join(process.cwd(), 'src');
const read = (...parts) => readFileSync(join(SRC, ...parts), 'utf8');

afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-2: training times are wall clocks, not instants', () => {
  test('a zone-less API value keeps its own digits', () => {
    // The exact value the API now returns for a 09:00 training.
    expect(toDatePart('2026-08-18T09:00:00')).toBe('2026-08-18');
    expect(toTimePart('2026-08-18T09:00:00')).toBe('09:00');
  });

  test('the form posts back exactly what it showed', () => {
    const value = '2026-08-18T09:00:00';
    expect(toWallClock(toDatePart(value), toTimePart(value))).toBe(value);
  });

  test('a DST-transition time survives the round trip unchanged', () => {
    // 29 March 2026, 02:30 — a local time that does not exist in Europe/Zagreb
    // that morning. Anything that converts to an instant must invent a value
    // here; reading the string cannot.
    const value = '2026-03-29T02:30:00';
    expect(toWallClock(toDatePart(value), toTimePart(value))).toBe(value);

    const autumn = '2026-10-25T02:30:00';   // and the hour that happens twice
    expect(toWallClock(toDatePart(autumn), toTimePart(autumn))).toBe(autumn);
  });

  test('a value that really is an instant is still treated as one', () => {
    // Zone designators must not be read as wall clocks — that would be the same
    // mistake in the opposite direction.
    const asDate = new Date('2026-08-18T09:00:00.000Z');
    expect(toTimePart('2026-08-18T09:00:00.000Z')).toBe(
      `${String(asDate.getHours()).padStart(2, '0')}:${String(asDate.getMinutes()).padStart(2, '0')}`
    );
  });

  test('the default date is the local day, not the UTC one', () => {
    // `new Date().toISOString().slice(0, 10)` is yesterday for the last hours
    // of every evening east of Greenwich, which put new trainings on the wrong
    // day for anyone scheduling after dinner.
    const lateEvening = new Date(2026, 7, 18, 23, 30);
    expect(localDate(lateEvening)).toBe('2026-08-18');
  });

  test('addHourTime clamps rather than wrapping past midnight', () => {
    expect(addHourTime('09:00')).toBe('10:00');
    expect(addHourTime('23:30')).toBe('23:30');
  });

  test('no source file converts a training time through toISOString', () => {
    const modal = read('components', 'training', 'AddTrainingModal.jsx');
    expect(modal).not.toMatch(/toISOString/);
    expect(modal).toMatch(/from '\.\.\/\.\.\/utils\/wallClock'/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-3: the group session save sends the location the trainer typed', () => {
  const source = () => read('pages', 'GroupSessionDetail.jsx');

  test('the request body carries sessionLocation', () => {
    expect(source()).toMatch(/location:\s*sessionLocation\s*\|\|\s*null/);
  });

  test('no bare `location` is submitted anywhere', () => {
    // The whole class, not just the one line: `location` is a global in a
    // browser, so this mistake produces no lint error, no runtime error and no
    // failing render — only a 400 from the server.
    const offenders = [];
    for (const file of ['pages/GroupSessionDetail.jsx', 'pages/GroupDetail.jsx',
                        'components/SessionModal.jsx', 'components/AdhocGroupPanel.jsx']) {
      const src = readFileSync(join(SRC, ...file.split('/')), 'utf8');
      // A JSON property whose value is the bare identifier `location`.
      if (/(?<![.\w])location:\s*location\b/.test(src)) offenders.push(file);
      // Or the same identifier used bare in a payload expression.
      if (/(?<![.\w])location:\s*location\s*\|\|/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  test('the state variable the input writes to is the one that is sent', () => {
    const src = source();
    // The input binds sessionLocation…
    expect(src).toMatch(/value=\{sessionLocation\}/);
    // …and setSessionLocation is what loading a session populates.
    expect(src).toMatch(/setSessionLocation\(s\.location \|\| ''\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-4: the measurement trend reads chronologically', () => {
  // The component fetches through progressService, so the fetch is replaced and
  // everything else — the sorting, the arithmetic, the table — is the real
  // component.
  beforeEach(() => {
    vi.resetModules();
  });

  const ENTRIES = [
    // As the API delivers them: newest first.
    { id: '3', date: '2026-08-20', value: '83.00', unit: 'kg', created_at: '2026-08-20T10:00:00Z' },
    { id: '2', date: '2026-08-16', value: '82.50', unit: 'kg', created_at: '2026-08-16T10:00:00Z' },
    { id: '1', date: '2026-08-10', value: '81.00', unit: 'kg', created_at: '2026-08-10T10:00:00Z' },
  ];

  const renderChart = async (entries = ENTRIES) => {
    vi.doMock('../services/trainingService', () => ({
      progressService: {
        getForClient: vi.fn().mockResolvedValue({ data: { Weight: entries } }),
        deleteEntry: vi.fn().mockResolvedValue({}),
      },
      trainingService: {},
      templateService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
    }));
    const { default: ProgressChart } = await import('../components/progress/ProgressChart');
    render(<ProgressChart clientId="c1" />);
    await waitFor(() => expect(screen.getByText('First')).toBeTruthy());
  };

  const tileValue = (label) => {
    const tile = screen.getByText(label).parentElement;
    return within(tile).getAllByText(/[\d.+-]/).map((n) => n.textContent.trim()).pop();
  };

  test('First is the earliest measurement and Latest the most recent', async () => {
    await renderChart();
    // Before the fix these were the wrong way round: First read 83 (20 Aug) and
    // Latest read 81 (10 Aug), because the delivered order was taken as given.
    expect(tileValue('First')).toContain('81');
    expect(tileValue('Latest')).toContain('83');
  });

  test('a weight gain is reported as a gain', async () => {
    await renderChart();
    expect(tileValue('Change')).toContain('+2.0');
  });

  test('the direction is right for a loss too', async () => {
    await renderChart([
      { id: '2', date: '2026-08-20', value: '79.00', unit: 'kg', created_at: '2026-08-20T10:00:00Z' },
      { id: '1', date: '2026-08-10', value: '81.00', unit: 'kg', created_at: '2026-08-10T10:00:00Z' },
    ]);
    expect(tileValue('First')).toContain('81');
    expect(tileValue('Latest')).toContain('79');
    expect(tileValue('Change')).toContain('-2.0');
  });

  test('the order is not inherited from the API', async () => {
    // Same three measurements, delivered oldest-first instead. A component that
    // sorts for itself gives the same answer; one that trusts the payload does
    // not — which is the property the fix is actually about.
    await renderChart([...ENTRIES].reverse());
    expect(tileValue('First')).toContain('81');
    expect(tileValue('Latest')).toContain('83');
    expect(tileValue('Change')).toContain('+2.0');
  });

  test('the history table lists newest first and shows the change since the previous entry', async () => {
    await renderChart();
    const rows = document.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toMatch(/20 Aug 2026/);
    expect(rows[0].textContent).toMatch(/\+0\.5/);     // 83.0 − 82.5
    expect(rows[1].textContent).toMatch(/16 Aug 2026/);
    expect(rows[1].textContent).toMatch(/\+1\.5/);     // 82.5 − 81.0
    expect(rows[2].textContent).toMatch(/10 Aug 2026/);
  });

  test('a calendar date is shown as that day, not the day before', async () => {
    await renderChart();
    const rows = document.querySelectorAll('tbody tr');
    // `new Date('2026-08-10')` is UTC midnight, i.e. the 9th west of Greenwich.
    expect(rows[2].textContent).toMatch(/10 Aug 2026/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-5: every destination is reachable on a phone', () => {
  const renderLayout = async () => {
    vi.resetModules();
    vi.doMock('axios', () => ({
      default: { get: vi.fn().mockResolvedValue({ data: { dpa_accepted: true } }) },
    }));
    vi.doMock('../context/AuthContext', () => ({
      useAuth: () => ({ user: { id: 'u1', firstName: 'Test' }, logout: vi.fn() }),
    }));
    vi.doMock('../context/ThemeContext', () => ({
      useTheme: () => ({ isDark: false, toggle: vi.fn() }),
    }));
    vi.doMock('../components/ProfileMenu', () => ({ default: () => null }));
    vi.doMock('../components/SubscriptionBanner', () => ({ default: () => null }));
    vi.doMock('../components/VerifyEmailBanner', () => ({ default: () => null }));
    vi.doMock('../components/DpaAcceptanceModal', () => ({ default: () => null }));
    vi.doMock('../components/LanguageSelector', () => ({ default: () => null }));

    const { default: DashboardLayout } = await import('../pages/DashboardLayout');
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(document.querySelector('nav.sm\\:hidden')).toBeTruthy());
  };

  const mobileNav = () => document.querySelector('nav.sm\\:hidden');
  const hrefs = (root) => [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));

  test('the bottom bar is short enough to fit a 386px screen', async () => {
    await renderLayout();
    // Six destinations already measured 367px of a 386px viewport. The bar now
    // carries four plus a "More" control, and the rest live in a sheet.
    const tabs = mobileNav().querySelectorAll('a, button');
    expect(tabs.length).toBeLessThanOrEqual(5);
  });

  test('Groups and Exercises are reachable from the mobile navigation', async () => {
    await renderLayout();

    // Not in the bar itself — that is the state QA found and it is fine…
    const inBar = hrefs(mobileNav());
    expect(inBar).not.toContain('/dashboard/groups');

    // …as long as opening "More" reveals them, which is what was missing.
    const more = mobileNav().querySelector('button');
    more.click();
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());

    const inSheet = hrefs(document.querySelector('[role="dialog"]'));
    expect(inSheet).toContain('/dashboard/groups');
    expect(inSheet).toContain('/dashboard/exercises');
  });

  test('every desktop destination exists somewhere on mobile', async () => {
    await renderLayout();
    const desktopNav = document.querySelector('nav.hidden');
    const desktop = hrefs(desktopNav);
    expect(desktop.length).toBeGreaterThan(5);

    const more = mobileNav().querySelector('button');
    more.click();
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy());

    const mobile = new Set([
      ...hrefs(mobileNav()),
      ...hrefs(document.querySelector('[role="dialog"]')),
    ]);
    const unreachable = desktop.filter((href) => !mobile.has(href));
    expect(unreachable).toEqual([]);
  });

  test('the sheet is derived from the nav list, not written out a second time', async () => {
    // A hand-maintained second list is how Groups and Exercises went missing in
    // the first place. Deriving the sheet by subtraction means a new
    // destination is either a primary tab or in the sheet — never nowhere.
    const src = read('pages', 'DashboardLayout.jsx');
    expect(src).toMatch(/moreNavItems\s*=\s*allNavItems\.filter/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-6: nothing pushes the page wider than the phone', () => {
  // jsdom computes no layout, so these are checked against the source. Each one
  // corresponds to a measured overflow: /dashboard/profile was 425px wide in a
  // 386px viewport, /dashboard/packages 405px, and the same pattern was found
  // on the client detail header while verifying the fix.

  test('the page is not made to fit by hiding what overflows', () => {
    // The band-aid that would make every assertion above pass while cutting off
    // the content the trainer came for.
    const css = read('index.css');
    expect(css).not.toMatch(/(html|body)[^{]*\{[^}]*overflow-x:\s*hidden/);
  });

  test('the profile header lets a long email wrap instead of pushing', () => {
    const src = read('pages', 'ProfilePage.jsx');
    expect(src).toMatch(/className="min-w-0 flex-1"/);
    expect(src).toMatch(/text-sm text-gray-500 dark:text-gray-400 break-words/);
  });

  test('the client detail header does the same', () => {
    const src = read('pages', 'ClientDetail.jsx');
    expect(src).toMatch(/className="flex-1 min-w-0"/);
    expect(src).toMatch(/className="flex gap-2 flex-shrink-0"/);
  });

  test('card grid items may shrink below their content', () => {
    // A grid item defaults to min-width:auto, so a `truncate`d heading — which
    // is white-space:nowrap — sets the track width to the whole string and the
    // truncation never engages.
    for (const page of ['PackagesPage.jsx', 'GroupsPage.jsx']) {
      const src = read('pages', page);
      expect({ page, hasMinWidth: /min-w-0 bg-white/.test(src) })
        .toEqual({ page, hasMinWidth: true });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BUG-1: the client detail tile reads the count, not the list', () => {
  test('ClientDetail uses the count field', () => {
    const src = read('pages', 'ClientDetail.jsx');
    expect(src).toMatch(/Number\(client\.upcoming_sessions_count\)/);
    // `Number([...])` is NaN for anything but a one-element array, which is how
    // a client with two scheduled sessions showed 0 and one with a single
    // session looked correct.
    expect(src).not.toMatch(/Number\(client\.upcoming_sessions\)/);
  });
});
