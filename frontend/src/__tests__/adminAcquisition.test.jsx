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
      views: {
        views_total: 140,
        last_7_days: 40,
        last_30_days: 140,
        measuring_since: '2026-08-24T10:00:00Z',
        byChannel: [
          // 2 of 100 = 2%
          { utm_source: 'instagram', utm_campaign: 'organic', views: 100, signups: 2 },
          // views but no signups - the common, important case
          { utm_source: 'facebook', utm_campaign: 'organic', views: 40, signups: 0 },
          // signups but no views - predates the counter, or beacon blocked
          { utm_source: '(direct)', utm_campaign: '(none)', views: 0, signups: 1 },
        ],
      },
      notMeasured: {
        uniqueVisitors:
          'Views are counted without any cookie or identifier, so repeat views by one person cannot be collapsed.',
        trialToPaidConversion:
          'There is no payment processor in the product, so no paid conversion can occur.',
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
  test('reports the funnel exactly as the API returned it', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Acquisition')).toBeTruthy());

    // Scoped to the table: "instagram" legitimately appears twice on this page
    // — once as a source badge on the newest-tenants list, once here.
    const table = screen.getByText('Source').closest('table');
    expect(within(table).getByText('instagram')).toBeTruthy();
    expect(within(table).getByText('facebook')).toBeTruthy();

    expect(screen.getByText('Page views')).toBeTruthy();
    expect(screen.getByText('With a known source')).toBeTruthy();
    expect(screen.getByText('33% of signups')).toBeTruthy();

    // 2 signups from 100 views.
    expect(within(table).getByText('2%')).toBeTruthy();
    // 0 from 40 is a real 0%, not a missing value - it is the most useful
    // number on the page and must never be hidden.
    expect(within(table).getByText('0%')).toBeTruthy();
  });

  test('a channel with signups but no views says so instead of inventing a rate', async () => {
    renderDashboard();
    const table = await waitFor(() => screen.getByText('Source').closest('table'));

    const row = within(table).getByText('(direct)').closest('tr');
    // 1 signup / 0 views is not 0%, not 100% and not infinity. It is unknown,
    // and the only honest thing to print is that.
    expect(within(row).getByText('not measured')).toBeTruthy();
  });

  test('no overall visit-to-signup rate is claimed while the windows differ', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Acquisition')).toBeTruthy());

    // Views start when the counter shipped; signups go back further. An
    // aggregate rate would be arithmetically valid and factually wrong.
    expect(screen.getByText(/Page views counted since/)).toBeTruthy();
    expect(screen.getByText(/no overall visit-to-signup rate is shown/)).toBeTruthy();
    expect(screen.getByText(/page loads, not/)).toBeTruthy();
  });

  test('names what it still cannot measure instead of leaving a gap', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Not measured')).toBeTruthy());

    expect(screen.getByText(/repeat views by one person cannot be collapsed/)).toBeTruthy();
    expect(screen.getByText(/no payment processor/)).toBeTruthy();
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
          acquisition: {
            ...OVERVIEW.overview.acquisition,
            attributed: 0,
            direct_or_unknown: 9,
            bySource: [],
            views: { views_total: 0, last_7_days: 0, last_30_days: 0, measuring_since: null, byChannel: [] },
          },
        },
      },
    });

    renderDashboard();
    await waitFor(() => expect(screen.getByText('Acquisition')).toBeTruthy());
    expect(screen.getByText(/Nothing measured yet/)).toBeTruthy();
  });
});
