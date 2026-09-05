/**
 * Date formatting follows the UI language.
 *
 * ── The defect ───────────────────────────────────────────────────────────────
 * The clients table rendered its "last session" date with
 * `toLocaleDateString(undefined, …)`. `undefined` is not "the app's language" —
 * it is the runtime's default locale. On a machine set to Croatian the table
 * printed "18. kol" under English column headers, and switching the language in
 * the app left it unchanged, because i18next was never consulted.
 *
 * The assertions below are locale-aware rather than literal: each expectation
 * is computed from `Intl` for the locale under test, so they hold on any ICU
 * build and do not break when a browser adjusts its abbreviations. What they
 * pin is the *relationship* — the rendered date equals what the ACTIVE UI
 * language formats, and differs from what the other language would.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Clients from '../pages/Clients';
import i18n from '../i18n';
import { resolveDateLocale, DEFAULT_DATE_LOCALE } from '../utils/locale';

// The page pulls clients and subscription state on mount; neither is what is
// under test, so both are stubbed with the smallest shape the component reads.
const LAST_SESSION = '2026-08-18';

vi.mock('../services/api', () => ({
  clientsAPI: {
    getAll: vi.fn(async () => ({
      data: {
        clients: [{
          id: 'c1',
          first_name: 'Locale',
          last_name: 'Probe',
          email: 'locale@example.test',
          phone: null,
          is_active: true,
          is_archived: false,
          completed_sessions: 3,
          last_session_date: LAST_SESSION,
        }],
      },
    })),
  },
  subscriptionsAPI: {
    getStatus: vi.fn(async () => ({ data: { subscription: { clients_limit_reached: false } } })),
  },
}));

// Toasts write to a portal the page never mounts in this test.
vi.mock('../components/Toast', () => ({ showToast: vi.fn(), default: () => null }));


/** How a given locale renders the fixture date in the table's own format. */
const expectedFor = (locale) =>
  new Date(LAST_SESSION).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

const renderClients = async () => {
  const view = render(<MemoryRouter><Clients /></MemoryRouter>);
  await screen.findByText('Locale Probe');
  return view;
};

/**
 * The last-session cell, found by a stable hook rather than by counting
 * elements. The row's shape changed when the list started showing the numbers
 * a trainer opens it for (sessions remaining, next session); what this suite
 * pins is the LANGUAGE of the date, which is unaffected by that.
 */
const renderedDate = () =>
  screen.getByTestId('client-last-session').textContent.trim();

const setLanguage = async (lng) => {
  await act(async () => { await i18n.changeLanguage(lng); });
};

beforeEach(async () => {
  await setLanguage('en');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('resolveDateLocale', () => {
  test('maps each supported UI language to its own locale', () => {
    expect(resolveDateLocale('en')).toBe('en-GB');
    expect(resolveDateLocale('hr')).toBe('hr-HR');
    expect(resolveDateLocale('de')).toBe('de-DE');
  });

  test('matches on the base language, so a region tag still resolves', () => {
    expect(resolveDateLocale('en-US')).toBe('en-GB');
    expect(resolveDateLocale('hr-HR')).toBe('hr-HR');
  });

  test('falls back the way i18next does for anything unknown or missing', () => {
    expect(resolveDateLocale('xx')).toBe(DEFAULT_DATE_LOCALE);
    expect(resolveDateLocale(undefined)).toBe(DEFAULT_DATE_LOCALE);
    expect(resolveDateLocale('')).toBe(DEFAULT_DATE_LOCALE);
  });

  test('the locales it returns actually format differently', () => {
    // Guards the tests below: if en-GB and hr-HR ever rendered identically on
    // this ICU build, the assertions further down would pass vacuously.
    expect(expectedFor('en-GB')).not.toBe(expectedFor('hr-HR'));
  });
});

describe('the clients table formats dates in the active UI language', () => {
  test('English UI renders the date in English', async () => {
    await setLanguage('en');
    await renderClients();

    expect(renderedDate()).toBe(expectedFor('en-GB'));
    expect(renderedDate()).not.toBe(expectedFor('hr-HR'));
  });

  test('Croatian UI renders the date in Croatian', async () => {
    await setLanguage('hr');
    await renderClients();

    expect(renderedDate()).toBe(expectedFor('hr-HR'));
    expect(renderedDate()).not.toBe(expectedFor('en-GB'));
  });

  test('the date does not follow the browser locale when the UI is English', async () => {
    // The exact regression: `toLocaleDateString(undefined, …)` resolves to the
    // runtime default. Whatever that machine is set to, an English UI must not
    // inherit it unless it happens to be English itself.
    await setLanguage('en');
    await renderClients();

    const runtimeDefault = expectedFor(undefined);
    if (runtimeDefault !== expectedFor('en-GB')) {
      expect(renderedDate()).not.toBe(runtimeDefault);
    }
    expect(renderedDate()).toBe(expectedFor('en-GB'));
  });

  test('switching language re-renders the date; the table is not stuck', async () => {
    await setLanguage('en');
    await renderClients();
    expect(renderedDate()).toBe(expectedFor('en-GB'));

    await setLanguage('hr');
    await waitFor(() => expect(renderedDate()).toBe(expectedFor('hr-HR')));

    await setLanguage('en');
    await waitFor(() => expect(renderedDate()).toBe(expectedFor('en-GB')));
  });
});
