/**
 * The register payload carries first-touch attribution — step 4 of
 * marketing/social/ANALYTICS_IMPLEMENTATION.md.
 *
 * This is the one join in the whole funnel. Instagram can prove somebody
 * tapped a link; `users.created_at` proves somebody made an account. Only this
 * payload connects the two, and it is a single line in AuthContext that a
 * refactor could silently drop — with no error, no failing build, and no
 * symptom until someone asks which Reel produced a trainer and finds every row
 * empty.
 *
 * So the tests below assert on the *payload the API is actually called with*,
 * not on any intermediate value.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AuthProvider, useAuth } from '../context/AuthContext';
import '../i18n.js';

const registerMock = vi.fn();

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    authAPI: {
      ...actual.authAPI,
      register: (...args) => registerMock(...args),
      validateToken: vi.fn(() => Promise.reject(new Error('no session'))),
    },
  };
});

/** Renders a button that performs a registration with fixed credentials. */
function RegisterProbe() {
  const { register } = useAuth();
  return (
    <button
      type="button"
      onClick={() =>
        register({
          email: 't@example.test',
          password: 'Passw0rd!x',
          firstName: 'A',
          lastName: 'B',
        })
      }
    >
      go
    </button>
  );
}

const renderProbe = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterProbe />
      </AuthProvider>
    </MemoryRouter>
  );

const grantConsent = () =>
  localStorage.setItem(
    'treniko_cookie_consent',
    JSON.stringify({ necessary: true, analytics: true, preferences: true })
  );

beforeEach(() => {
  registerMock.mockReset();
  registerMock.mockResolvedValue({
    data: { token: 't', user: { id: 'u1', email: 't@example.test' } },
  });
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

const clickRegister = async () => {
  const btn = await screen.findByRole('button', { name: 'go' });
  btn.click();
  await waitFor(() => expect(registerMock).toHaveBeenCalled());
  return registerMock.mock.calls[0][0];
};

describe('registration carries first-touch attribution', () => {
  test('captured attribution is sent as a nested object', async () => {
    grantConsent();
    const { captureAttribution } = await import('../utils/attribution');
    window.history.replaceState({}, '', '/?utm_source=instagram&utm_medium=social&utm_campaign=organic&utm_content=reel-p05');
    captureAttribution();

    renderProbe();
    const payload = await clickRegister();

    expect(payload.attribution).toBeTruthy();
    expect(payload.attribution.utm_source).toBe('instagram');
    expect(payload.attribution.utm_content).toBe('reel-p05');
    expect(payload.attribution.landing_path).toBe('/');

    // Nested, not spread: it must never be mistaken for a registration field.
    expect(payload.email).toBe('t@example.test');
    expect(payload.utm_source).toBeUndefined();
  });

  test('no attribution key at all when nothing was captured', async () => {
    // A direct visit with no consent and no tags. Sending `attribution: null`
    // would be harmless but noisy; sending nothing is the intent.
    renderProbe();
    const payload = await clickRegister();

    expect('attribution' in payload).toBe(false);
    expect(payload.email).toBe('t@example.test');
  });

  test('nothing is sent when consent was refused, even with UTMs in the URL', async () => {
    localStorage.setItem(
      'treniko_cookie_consent',
      JSON.stringify({ necessary: true, analytics: false, preferences: false })
    );
    const { captureAttribution } = await import('../utils/attribution');
    window.history.replaceState({}, '', '/?utm_source=instagram&utm_campaign=organic');
    captureAttribution();

    renderProbe();
    const payload = await clickRegister();

    // The consent gate is the whole reason this is defensible without a
    // separate legal basis. If this ever starts sending, that argument is gone.
    expect('attribution' in payload).toBe(false);
  });

  test('registration still succeeds if attribution storage is unreadable', async () => {
    grantConsent();
    // Only sessionStorage, which is where attribution lives. Breaking all of
    // Storage.prototype would also break the auth session read on mount, which
    // is a different concern and not what this test is about.
    const spy = vi
      .spyOn(window.sessionStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('storage disabled');
      });

    try {
      renderProbe();
      const payload = await clickRegister();
      expect(payload.email).toBe('t@example.test');
      expect('attribution' in payload).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
