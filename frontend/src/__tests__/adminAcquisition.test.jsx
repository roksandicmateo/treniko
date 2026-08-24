/**
 * The admin Acquisition panel.
 *
 * Two things are worth a test here, and neither is "does it render".
 *
 *   1. **The numbers shown are the numbers the API sent.** A dashboard that
 *      quietly derives or rounds a figure is worse than no dashboard, because
 *      someone will make a decision on it.
 *   2. **"Not measured" is actually displayed.** Landing-page visits and
 *      signup conversion rate genuinely cannot be produced today. If the panel
 *      silently omitted them, an empty space would be read as a zero — which
 *      is exactly the false confidence this whole exercise is meant to remove.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const overviewMock = vi.fn();

vi.mock('../services/adminApi', () => ({
  adminDataAPI: { overview: (...a) => overviewMock(...a) },
  adminAuthAPI: {},
  default: {},
}));

import AdminDashboard from '../pages/admin/AdminDashboard';

const OVERVIEW = {
  generatedAt: '2026-08-24T10:00:00Z',
  overview: {
    tenants: { total: 9, last_7_days: 2, last_30_days: 5 },
    trainers: { total: 4, verified: 3, locked: 0, dpa_accepted: 3 },
    subscriptions: [{ plan: 'free', status: 'active', count: 9, trials: 4 }],
    usage: { clients_total: 12, sessions_this_period: 30 },
    deletionRequests: { pending: 0 },
    newestTenants: [
      {
        id: 't1', name: 'Alpha Fitness', created_at: '2026-08-20T10:00:00Z',
        trainer_count: 1, utm_source: 'instagram', utm_campaign: 'organic', utm_content: 'reel-p05',
      },
      {
        id: 't2', name: 'Beta Coaching', created_at: '2026-08-19T10:00:00Z',
        trainer_count: 1, utm_source: null, utm_campaign: null, utm_content: null,
      },
    ],
    acquisition: {
      tenants_total: 9,
      attributed: 3,
      direct_or_unknown: 6,
      bySource: [
        { utm_source: 'instagram', utm_campaign: 'organic', utm_content: 'reel-p05', signups: 2, most_recent: '2026-08-20T10:00:00Z' },
        { utm_source: 'facebook', utm_campaign: 'organic', utm_content: 'fb-pin-1', signups: 1, most_recent: '2026-08-18T10:00:00Z' },
      ],
      notMeasured: {
        landingPageVisits: 'No page analytics is installed.',
        signupConversionRate: 'Requires visits; only the numerator exists.',
      },
    },
  },
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <AdminDashboard />
    </MemoryRouter>
  );

beforeEach(() => {
  overviewMock.mockReset();
  overviewMock.mockResolvedValue({ data: OVERVIEW });
});

afterEach(cleanup);

describe('admin acquisition panel', () => {
  test('reports signups by source exactly as the API returned them', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Acquisition')).toBeTruthy());

    // Scoped to the table: "instagram" legitimately appears twice on this page
    // — once as a source badge on the newest-tenants list, once here.
    const table = screen.getByText('Source').closest('table');
    expect(within(table).getByText('instagram')).toBeTruthy();
    expect(within(table).getByText('reel-p05')).toBeTruthy();
    expect(within(table).getByText('fb-pin-1')).toBeTruthy();
    expect(within(table).getByText('facebook')).toBeTruthy();

    // 3 attributed of 9 signups. The percentage is presentation; the counts are
    // the data, and both must match what was sent.
    expect(screen.getByText('With a known source')).toBeTruthy();
    expect(screen.getByText('Direct or unknown')).toBeTruthy();
    expect(screen.getByText('33% of signups')).toBeTruthy();
  });

  test('names what it cannot measure instead of leaving a gap', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Not measured')).toBeTruthy());

    expect(screen.getByText(/No page analytics is installed/)).toBeTruthy();
    expect(screen.getByText(/only the numerator exists/)).toBeTruthy();
  });

  test('a tenant with no attribution shows no source badge', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Beta Coaching')).toBeTruthy());

    const withSource = screen.getByText('Alpha Fitness').closest('li');
    const withoutSource = screen.getByText('Beta Coaching').closest('li');

    expect(within(withSource).getByText('instagram')).toBeTruthy();
    // Nothing invented for the tenant that arrived untagged.
    expect(within(withoutSource).queryByText('instagram')).toBeNull();
    expect(within(withoutSource).queryByText('(none)')).toBeNull();
  });

  test('an account with no tagged signups yet says so, rather than showing nothing', async () => {
    overviewMock.mockResolvedValue({
      data: {
        ...OVERVIEW,
        overview: {
          ...OVERVIEW.overview,
          acquisition: { ...OVERVIEW.overview.acquisition, attributed: 0, direct_or_unknown: 9, bySource: [] },
        },
      },
    });

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Acquisition')).toBeTruthy());
    expect(screen.getByText(/No signup has carried a campaign tag yet/)).toBeTruthy();
  });
});
