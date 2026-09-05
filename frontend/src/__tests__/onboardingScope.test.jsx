/**
 * The onboarding checklist must belong to an account, not to a browser.
 *
 * ── The bug ──────────────────────────────────────────────────────────────────
 * The dismissal flag was the bare key `treniko_onboarding_dismissed`. localStorage
 * is per-origin, so the first account to finish onboarding on a device set it for
 * every account that would ever sign in on that device afterwards.
 *
 * The second account then landed on a dashboard with four zeroes, a "✅ All
 * packages are healthy" panel, and exactly one call to action — "Schedule a
 * session" — which cannot succeed before a client exists. No checklist, no
 * "add your first client", and nothing on screen to suggest anything was
 * missing: a hidden checklist looks identical to a completed one.
 *
 * It was found by registering a second account in a browser that had already
 * used TRENIKO, which is precisely the situation that matters most — the
 * founder demonstrating on their own laptop, or a trainer signing up on a
 * device someone else has used.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';

import OnboardingChecklist from '../components/OnboardingChecklist';

// The component reads the tenant from auth context and the data from the API.
// Both are stubbed so the test is about scoping, nothing else.
let mockUser = { tenantId: 'tenant-A' };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
}));

// The checklist asks one endpoint for three booleans. It used to ask three,
// one of which fetched every session the tenant had ever had in order to find
// out whether there was one.
const accountWith = (state) =>
  vi.fn().mockImplementation(() =>
    Promise.resolve({ json: () => Promise.resolve({ success: true, onboarding: state }) }));

const emptyAccount = () =>
  accountWith({ has_client: false, has_package: false, has_session: false });

const renderChecklist = () =>
  render(<MemoryRouter><OnboardingChecklist /></MemoryRouter>);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 'stub');
  global.fetch = emptyAccount();
  mockUser = { tenantId: 'tenant-A' };
});

afterEach(() => vi.clearAllMocks());

describe('onboarding checklist is scoped to the account', () => {
  test('a brand-new tenant sees it even when another tenant finished on this browser', async () => {
    // Tenant A finished. This is the state that used to hide it for everyone.
    localStorage.setItem('treniko_onboarding_dismissed:tenant-A', 'true');
    // And the legacy browser-wide flag, left behind by an older build.
    localStorage.setItem('treniko_onboarding_dismissed', 'true');

    mockUser = { tenantId: 'tenant-B' };
    renderChecklist();

    // getAllByText, not getByText: the label appears twice — once in the step
    // list and once in the "next step" line — and getByText throws on multiple
    // matches, which would fail for a reason unrelated to what is being tested.
    await waitFor(() => expect(screen.getAllByText(/onboarding\.addClient/).length).toBeGreaterThan(0));
  });

  test('the tenant that dismissed it does not see it again', async () => {
    localStorage.setItem('treniko_onboarding_dismissed:tenant-A', 'true');
    const { container } = renderChecklist();

    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe('');
  });

  test('completing every step stores the flag under this tenant only', async () => {
    // An account that already has a client, a package and a session.
    global.fetch = accountWith({ has_client: true, has_package: true, has_session: true });

    renderChecklist();

    await waitFor(() =>
      expect(localStorage.getItem('treniko_onboarding_dismissed:tenant-A')).toBe('true'));
    // The bare key is what caused the bug; nothing may write it again.
    expect(localStorage.getItem('treniko_onboarding_dismissed')).toBeNull();
  });

  test('nothing is read or written before the tenant is known', async () => {
    // On a cold load the user resolves after first render. Keying on undefined
    // would recreate the shared-across-accounts bug under a different name.
    mockUser = null;
    const { container } = renderChecklist();

    await new Promise((r) => setTimeout(r, 30));
    expect(container.textContent).toBe('');
    expect(Object.keys(localStorage).filter((k) => k.includes('onboarding'))).toEqual([]);
  });
});
