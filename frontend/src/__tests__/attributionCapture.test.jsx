/**
 * Attribution must be captured wherever the visitor lands, not only on `/`.
 *
 * ── What this exists to stop happening again ─────────────────────────────────
 * `captureAttribution()` was called from Landing.jsx alone. That was correct
 * while `/` was the only entrance, and it stopped being correct the moment the
 * static content pages shipped — because every one of their CTAs points at
 * `/register`, and the beacon appends the incoming UTMs to that link.
 *
 * So the real path was:
 *
 *   Instagram bio → /free-personal-trainer-client-tracker?utm_source=instagram
 *                 → /register?utm_source=instagram
 *                 → Landing never mounts, capture never runs
 *                 → the signup is recorded as unattributed
 *
 * Every planned channel took that path. The funnel-by-source would have shown
 * an empty column for all of them, with no error to notice.
 *
 * The existing registerAttribution tests could not catch it: they call
 * `captureAttribution()` by hand before rendering, which is exactly the step
 * that was missing in production.
 */

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, test } from 'vitest';

import AttributionCapture from '../seo/AttributionCapture';
import { getAttribution } from '../utils/attribution';

const CONSENT_KEY = 'treniko_cookie_consent';

const grantConsent = () =>
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ necessary: true, analytics: true, preferences: true })
  );

/** Render the capture component as if the visitor had landed on `path`. */
const landOn = (path) => {
  // captureAttribution reads window.location.search, not the router — the same
  // thing it reads in a browser.
  window.history.replaceState({}, '', path);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<AttributionCapture />} />
      </Routes>
    </MemoryRouter>
  );
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('attribution is captured off the landing page', () => {
  test('a visitor landing straight on /register is attributed', async () => {
    // The exact URL the free tracker's CTA produces for an Instagram visitor.
    grantConsent();
    landOn('/register?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=link-in-bio');

    await waitFor(() => expect(getAttribution()).toBeTruthy());
    const record = getAttribution();
    expect(record.utm_source).toBe('instagram');
    expect(record.utm_content).toBe('link-in-bio');
    expect(record.landing_path).toBe('/register');
  });

  test('a visitor landing on /login is attributed too', async () => {
    grantConsent();
    landOn('/login?utm_source=capterra&utm_medium=referral&utm_campaign=organic');

    await waitFor(() => expect(getAttribution()).toBeTruthy());
    expect(getAttribution().utm_source).toBe('capterra');
  });

  test('first touch wins — a later route does not overwrite the original source', async () => {
    grantConsent();
    landOn('/register?utm_source=instagram&utm_campaign=organic');
    await waitFor(() => expect(getAttribution()).toBeTruthy());

    // Same session, different entry point with different tags.
    landOn('/login?utm_source=facebook&utm_campaign=other');
    await waitFor(() => expect(getAttribution()).toBeTruthy());

    // The value of first-touch attribution is that it does not move.
    expect(getAttribution().utm_source).toBe('instagram');
  });

  test('nothing is captured without analytics consent', async () => {
    // Widening where capture runs must not widen what is stored about someone
    // who declined. This is the assertion that keeps that true.
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ necessary: true, analytics: false, preferences: false })
    );
    landOn('/register?utm_source=instagram&utm_campaign=organic');

    await new Promise((r) => setTimeout(r, 20));
    expect(getAttribution()).toBeNull();
  });

  test('an untagged direct visit stores nothing', async () => {
    grantConsent();
    landOn('/register');

    await new Promise((r) => setTimeout(r, 20));
    // Storing an empty record would make "direct" indistinguishable from
    // "never captured", which is the distinction the admin funnel relies on.
    expect(getAttribution()).toBeNull();
  });
});
