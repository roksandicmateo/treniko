/**
 * The Progress screens: dates in the user's language, and a Strength tab that
 * cannot be taken down by its own payload.
 *
 * ── Defect 1: Croatian months in an English UI ───────────────────────────────
 * `ProgressPage` formatted every chart label and PR date with
 * `toLocaleString('default', { month: 'short' })`, hand-assembled into
 * `"17. srp"`. `'default'` is the *runtime's* locale, not the app's language, so
 * on a machine set to Croatian the English UI drew "17. srp" and "4. ruj" beside
 * English labels, and switching language in the app changed nothing. The three
 * Progress components had the mirror-image bug: a hardcoded 'en-GB', which never
 * followed the language either.
 *
 * ── Defect 2: the Strength tab crashed ───────────────────────────────────────
 * GET /progress/:id/strength returned a bare array per exercise. The component
 * reads `exercise.entries`, which on an array is `Array.prototype.entries` — a
 * function, and truthy, so `|| []` never fired and the next line threw
 * `TypeError: entries.map is not a function`. The error boundary then replaced
 * the whole section with "Something went wrong".
 *
 * The assertions are computed from `Intl` for the locale under test rather than
 * written out as literals, so they hold on any ICU build. What they pin is the
 * relationship: the rendered date is what the ACTIVE language formats, and is
 * not what another language would.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';

import { MemoryRouter } from 'react-router-dom';

import StrengthProgress from '../components/progress/StrengthProgress';
import PRSummary from '../components/progress/PRSummary';
import ProgressChart from '../components/progress/ProgressChart';
import ProgressPage from '../pages/ProgressPage';
import i18n from '../i18n';
import { formatCurrency, resolveDateLocale } from '../utils/locale';

const SESSION_DATE = '2026-08-17';   // "17 Aug" / "17. kol." / "17. Aug."
const METRIC_DATE  = '2026-09-04';
const PR_DATE      = '2026-09-04';

// The strength endpoint, in the shape the API is contracted to return.
const STRENGTH_PAYLOAD = {
  'Back Squat': {
    category: 'Strength',
    entries: [
      { date: SESSION_DATE, maxWeight: 80, maxReps: 8, estOneRM: 101.3, totalVolume: 1920, setCount: 3 },
      { date: '2026-08-24', maxWeight: 82.5, maxReps: 8, estOneRM: 104.5, totalVolume: 1980, setCount: 3 },
    ],
  },
};

const METRICS_PAYLOAD = {
  Weight: [
    { id: 'm1', date: METRIC_DATE, value: '85.6', unit: 'kg', source: 'manual' },
    { id: 'm2', date: '2026-08-21', value: '86.1', unit: 'kg', source: 'manual' },
  ],
};

const getStrength = vi.fn();
const getForClient = vi.fn();

vi.mock('../services/trainingService', () => ({
  progressService: {
    getStrength: (...args) => getStrength(...args),
    getForClient: (...args) => getForClient(...args),
    addEntry: vi.fn(),
    deleteEntry: vi.fn(),
  },
}));

/** How a locale renders a date in the session table's own format. */
const expectedFor = (locale, date = SESSION_DATE, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(locale, opts);

const setLanguage = async (lng) => {
  await act(async () => { await i18n.changeLanguage(lng); });
};

beforeEach(async () => {
  getStrength.mockReset();
  getForClient.mockReset();
  getStrength.mockResolvedValue({ data: STRENGTH_PAYLOAD });
  getForClient.mockResolvedValue({ data: METRICS_PAYLOAD });
  await setLanguage('en');
});

afterEach(() => {
  cleanup();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the locales under test actually differ', () => {
  test('en-GB, hr-HR and de-DE format the fixture date differently', () => {
    // Guards everything below: identical output would make the assertions pass
    // without proving anything.
    expect(expectedFor('en-GB')).not.toBe(expectedFor('hr-HR'));
    expect(expectedFor('en-GB')).not.toBe(expectedFor('de-DE'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('StrengthProgress renders dates in the active UI language', () => {
  const renderIt = async () => {
    render(<StrengthProgress clientId="c1" />);
    // The name appears twice — sidebar button and panel heading.
    await screen.findAllByText('Back Squat');
  };

  test('English UI renders English months', async () => {
    await setLanguage('en');
    await renderIt();

    expect(screen.getByText(expectedFor('en-GB'))).toBeTruthy();
    expect(screen.queryByText(expectedFor('hr-HR'))).toBeNull();
  });

  test('Croatian UI renders Croatian months', async () => {
    await setLanguage('hr');
    await renderIt();

    expect(screen.getByText(expectedFor('hr-HR'))).toBeTruthy();
    expect(screen.queryByText(expectedFor('en-GB'))).toBeNull();
  });

  test('German UI renders German months', async () => {
    await setLanguage('de');
    await renderIt();

    expect(screen.getByText(expectedFor('de-DE'))).toBeTruthy();
    expect(screen.queryByText(expectedFor('en-GB'))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ProgressChart renders dates in the active UI language', () => {
  const renderIt = async () => {
    render(<ProgressChart clientId="c1" />);
    await screen.findByText(expectedFor(i18n.language === 'hr' ? 'hr-HR' : i18n.language === 'de' ? 'de-DE' : 'en-GB', METRIC_DATE));
  };

  test('English UI renders English months', async () => {
    await setLanguage('en');
    await renderIt();

    expect(screen.getByText(expectedFor('en-GB', METRIC_DATE))).toBeTruthy();
    expect(screen.queryByText(expectedFor('hr-HR', METRIC_DATE))).toBeNull();
  });

  test('Croatian UI renders Croatian months', async () => {
    await setLanguage('hr');
    await renderIt();

    expect(screen.getByText(expectedFor('hr-HR', METRIC_DATE))).toBeTruthy();
    expect(screen.queryByText(expectedFor('en-GB', METRIC_DATE))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('StrengthProgress survives every state its endpoint can be in', () => {
  test('loading: renders while the request is in flight, without throwing', async () => {
    let resolve;
    getStrength.mockReturnValue(new Promise((r) => { resolve = r; }));

    render(<StrengthProgress clientId="c1" />);
    expect(screen.getByText(i18n.t('common.loading'))).toBeTruthy();

    await act(async () => { resolve({ data: {} }); });
  });

  test('populated: the exercise, its numbers and its sessions render', async () => {
    render(<StrengthProgress clientId="c1" />);

    await screen.findAllByText('Back Squat');
    expect(screen.getAllByText(/80 kg/).length).toBeGreaterThan(0);
    // Both logged sessions appear in the table.
    expect(screen.getByText(expectedFor('en-GB', '2026-08-24'))).toBeTruthy();
  });

  test('empty: an exercise-less client gets the empty state, not a crash', async () => {
    getStrength.mockResolvedValue({ data: {} });

    render(<StrengthProgress clientId="c1" />);

    await screen.findByText(i18n.t('progress.noStrengthData'));
  });

  test('error: a failed request falls back to the empty state', async () => {
    getStrength.mockRejectedValue(new Error('500 from the API'));

    render(<StrengthProgress clientId="c1" />);

    await screen.findByText(i18n.t('progress.noStrengthData'));
  });

  test('the original crash: a bare array per exercise no longer throws', async () => {
    // Exactly what the endpoint used to send. `exercise.entries` on this is
    // Array.prototype.entries — a function — which is what produced
    // "TypeError: entries.map is not a function".
    const legacy = {
      'Back Squat': [
        { exercise_name: 'Back Squat', session_date: SESSION_DATE, max_weight: 80, max_reps: 8 },
      ],
    };
    getStrength.mockResolvedValue({ data: legacy });

    expect(() => render(<StrengthProgress clientId="c1" />)).not.toThrow();

    // The exercise is still listed; it simply has no session rows to draw.
    await screen.findAllByText('Back Squat');
    await waitFor(() => {
      expect(screen.queryByText(expectedFor('en-GB'))).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `ProgressPage` is the screen the defect was found on: its chart axes and PR
// cards printed Croatian months in an English UI. It talks to the API through
// `fetch` rather than the service layer, so that is what gets stubbed.
describe('ProgressPage formats its dates in the active UI language', () => {
  const CLIENT = { id: 'c1', first_name: 'Regression', last_name: 'Probe' };

  const PROGRESS = {
    success: true,
    client: CLIENT,
    stats: { total_sessions: 8, total_hours: '8.0', total_sets: 72, unique_exercises: 3 },
    strengthData: [
      { exercise_id: 'e1', exercise_name: 'Back Squat', session_date: SESSION_DATE,
        max_weight: 80, max_reps: 8, volume: 1920, total_sets: 3 },
    ],
    frequencyData: [{ week_start: '2026-08-17', session_count: 3, total_minutes: 180 }],
    personalRecords: [
      { exercise_id: 'e1', exercise_name: 'Back Squat', max_weight: 80, reps: 8, achieved_date: PR_DATE },
    ],
    exercises: [{ id: 'e1', name: 'Back Squat', category: 'Strength' }],
  };

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    global.fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('/clients')
        ? { clients: [CLIENT] }
        : PROGRESS),
    }));
  });

  afterEach(() => {
    localStorage.clear();
    delete global.fetch;
  });

  /** The PR card's date — plain DOM, unlike the chart axes, which recharts does
   *  not lay out in jsdom. It runs through the same formatter. */
  const prDate = (locale) =>
    new Date(`${PR_DATE}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const renderPage = async () => {
    render(<MemoryRouter><ProgressPage /></MemoryRouter>);
    await screen.findAllByText('Back Squat');
  };

  test('English UI renders an English month (was: Croatian, from the OS locale)', async () => {
    await setLanguage('en');
    await renderPage();

    expect(screen.getByText(prDate('en-GB'))).toBeTruthy();
    expect(screen.queryByText(prDate('hr-HR'))).toBeNull();
  });

  test('Croatian UI renders a Croatian month', async () => {
    await setLanguage('hr');
    await renderPage();

    expect(screen.getByText(prDate('hr-HR'))).toBeTruthy();
    expect(screen.queryByText(prDate('en-GB'))).toBeNull();
  });

  test('German UI renders a German month', async () => {
    await setLanguage('de');
    await renderPage();

    expect(screen.getByText(prDate('de-DE'))).toBeTruthy();
    expect(screen.queryByText(prDate('en-GB'))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `PRSummary` reads the same endpoint and hit the same trap one line later,
// with `.reduce` instead of `.map`.
describe('PRSummary survives the payload that used to crash it', () => {
  test('the legacy bare-array payload renders instead of throwing', async () => {
    getStrength.mockResolvedValue({
      data: { 'Back Squat': [{ session_date: SESSION_DATE, max_weight: 80 }] },
    });

    expect(() => render(<PRSummary clientId="c1" />)).not.toThrow();
    await screen.findAllByText('Back Squat');
  });

  test('the contracted payload renders the record', async () => {
    render(<PRSummary clientId="c1" />);

    await screen.findAllByText('Back Squat');
    expect(screen.getAllByText(/82.5/).length).toBeGreaterThan(0);
  });

  test('a failed request falls back to the empty state', async () => {
    getStrength.mockRejectedValue(new Error('500 from the API'));

    render(<PRSummary clientId="c1" />);

    await screen.findByText(i18n.t('prs.noPRs'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Money was written three ways in three places: `Intl` with a hardcoded 'de-DE'
// in the billing tab, "450.00 EUR" assembled by hand on package cards, and a '€'
// glued in front of toFixed() on the subscription page. One formatter now, bound
// to the active language.
describe('formatCurrency follows the language and the record', () => {
  test('each locale places the symbol and separators its own way', () => {
    const en = formatCurrency(450, { locale: 'en-GB' });
    const hr = formatCurrency(450, { locale: 'hr-HR' });
    const de = formatCurrency(450, { locale: 'de-DE' });

    expect(en).not.toBe(hr);
    // The amount survives whichever way it is written.
    for (const rendered of [en, hr, de]) expect(rendered).toMatch(/450/);
    // English puts the symbol first; Croatian and German put it last.
    expect(en.trim().startsWith('€')).toBe(true);
    expect(hr.trim().endsWith('€')).toBe(true);
  });

  test('the currency comes from the record, not from a constant', () => {
    expect(formatCurrency(450, { currency: 'GBP', locale: 'en-GB' })).toMatch(/£/);
    expect(formatCurrency(450, { currency: 'USD', locale: 'en-GB' })).toMatch(/\$/);
  });

  test('a missing or unparseable amount renders as nothing, never "NaN" or a fake zero', () => {
    // `Number(null)` and `Number('')` are 0 — a package with no price must not
    // render as "€0.00", which reads as free.
    expect(formatCurrency(null)).toBe('');
    expect(formatCurrency(undefined)).toBe('');
    expect(formatCurrency('')).toBe('');
    expect(formatCurrency('not a number')).toBe('');
    // A real zero is a real price and still renders.
    expect(formatCurrency(0, { locale: 'en-GB' })).toMatch(/0/);
  });

  test('a string amount from the API formats like a number', () => {
    expect(formatCurrency('450.00', { locale: 'en-GB' }))
      .toBe(formatCurrency(450, { locale: 'en-GB' }));
  });

  test('an unknown currency code falls back to a readable price', () => {
    // Intl throws on a bad code; an empty cell where a price belongs is worse.
    expect(formatCurrency(450, { currency: 'NOTACODE', locale: 'en-GB' })).toBe('450.00 NOTACODE');
  });

  test('it uses the same language mapping as the dates', () => {
    expect(formatCurrency(450, { locale: resolveDateLocale('hr') }))
      .toBe(formatCurrency(450, { locale: 'hr-HR' }));
  });
});
