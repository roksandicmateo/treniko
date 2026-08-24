import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminDataAPI } from '../../services/adminApi';
import { DataState, useAdminResource } from '../../components/admin/DataState';
import { PageHeader, StatCard } from '../../components/admin/AdminLayout';
import { formatDate, formatDateTime } from './adminFormat';

/**
 * Platform overview. Every figure comes from `GET /api/admin/overview` and is
 * counted live by the database — nothing here is cached, derived in the browser
 * or estimated.
 */
const AdminDashboard = () => {
  const fetcher = useCallback(() => adminDataAPI.overview(), []);
  const { data, loading, error, reload } = useAdminResource(fetcher);

  const o = data?.overview;

  // The subscriptions endpoint returns one row per (plan, status) pair, so the
  // split has to be summed rather than read off a field.
  const paidPlans = ['pro', 'enterprise'];
  const freeCount = o?.subscriptions
    ?.filter((s) => !paidPlans.includes(s.plan))
    .reduce((n, s) => n + s.count, 0) ?? 0;
  const paidCount = o?.subscriptions
    ?.filter((s) => paidPlans.includes(s.plan))
    .reduce((n, s) => n + s.count, 0) ?? 0;
  const activeSubs = o?.subscriptions
    ?.filter((s) => s.status === 'active')
    .reduce((n, s) => n + s.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={data?.generatedAt ? `Counted live at ${formatDateTime(data.generatedAt)}.` : undefined}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={!loading && !error && !o}
        emptyTitle="No overview available"
        loadingLabel="Counting the platform…"
      >
        {o && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Tenants" value={o.tenants.total} hint={`${o.tenants.last_7_days} in the last 7 days`} />
              <StatCard label="Trainers" value={o.trainers.total} hint={`${o.trainers.verified} email-verified`} />
              <StatCard label="Clients" value={o.usage.clients_total} hint="across all tenants" />
              <StatCard label="Sessions" value={o.usage.sessions_this_period} hint="current billing period" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Active subscriptions" value={activeSubs} />
              <StatCard label="Free plans" value={freeCount} />
              <StatCard label="Paid plans" value={paidCount} hint="pro + enterprise" />
              <StatCard
                label="Locked trainers"
                value={o.trainers.locked}
                hint={o.trainers.locked > 0 ? 'can be unlocked from Trainers' : 'none locked out'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Plan / status breakdown */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Subscriptions</h2>
                </div>
                {o.subscriptions.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-500">No subscriptions yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                          <th className="px-6 py-3">Plan</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Tenants</th>
                          <th className="px-6 py-3 text-right">On trial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {o.subscriptions.map((s) => (
                          <tr key={`${s.plan}-${s.status}`}>
                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">{s.plan}</td>
                            <td className="px-6 py-3">
                              <span className={s.status === 'active' ? 'badge-green' : 'badge-amber'}>{s.status}</span>
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums">{s.count}</td>
                            <td className="px-6 py-3 text-right tabular-nums text-gray-500">{s.trials}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent registrations */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Newest tenants</h2>
                  <Link to="/admin/trainers" className="text-sm text-primary-500 hover:text-primary-600">Trainers →</Link>
                </div>
                {o.newestTenants.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-500">No tenants yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                    {o.newestTenants.map((t) => (
                      <li key={t.id} className="px-6 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(t.created_at)}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {/* Migration 034. Campaign label, not a person. */}
                          {t.utm_source && (
                            <span className="badge-blue" title={[t.utm_campaign, t.utm_content].filter(Boolean).join(' · ')}>
                              {t.utm_source}
                            </span>
                          )}
                          <span className="badge-gray">
                            {t.trainer_count} trainer{t.trainer_count === 1 ? '' : 's'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── Acquisition ───────────────────────────────────────────────
                Signups by channel. Every number here counts an ACCOUNT, never
                a visit — see the "not measured" note below, which is rendered
                deliberately so that an empty panel is never read as a zero. */}
            {o.acquisition && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Acquisition</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Where signups came from. First touch, captured on the landing page and kept for
                    the life of the account.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 border-b border-gray-100 dark:border-gray-800">
                  <StatCard label="Signups" value={o.acquisition.tenants_total} />
                  <StatCard
                    label="With a known source"
                    value={o.acquisition.attributed}
                    hint={
                      o.acquisition.tenants_total > 0
                        ? `${Math.round((o.acquisition.attributed / o.acquisition.tenants_total) * 100)}% of signups`
                        : undefined
                    }
                  />
                  <StatCard
                    label="Direct or unknown"
                    value={o.acquisition.direct_or_unknown}
                    hint="no tags, or analytics cookies declined"
                  />
                </div>

                {o.acquisition.bySource.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-500">
                    No signup has carried a campaign tag yet. The first tagged registration will
                    appear here.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                          <th className="px-6 py-3">Source</th>
                          <th className="px-6 py-3">Campaign</th>
                          <th className="px-6 py-3">Content</th>
                          <th className="px-6 py-3 text-right">Signups</th>
                          <th className="px-6 py-3 text-right">Most recent</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {o.acquisition.bySource.map((r) => (
                          <tr key={`${r.utm_source}-${r.utm_campaign}-${r.utm_content}`}>
                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">{r.utm_source}</td>
                            <td className="px-6 py-3 text-gray-500">{r.utm_campaign}</td>
                            <td className="px-6 py-3 text-gray-500">{r.utm_content}</td>
                            <td className="px-6 py-3 text-right tabular-nums">{r.signups}</td>
                            <td className="px-6 py-3 text-right text-gray-500">{formatDate(r.most_recent)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {o.acquisition.notMeasured && (
                  <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Not measured
                    </p>
                    <ul className="mt-2 space-y-1">
                      {Object.entries(o.acquisition.notMeasured).map(([key, why]) => (
                        <li key={key} className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                          </span>{' '}
                          — {why}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {o.deletionRequests.pending > 0 && (
              <div className="card p-5 border-l-4 border-l-amber-500">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {o.deletionRequests.pending} pending deletion request{o.deletionRequests.pending === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Accounts scheduled for erasure. Processed automatically by the deletion job once the grace period ends.
                </p>
              </div>
            )}
          </div>
        )}
      </DataState>
    </>
  );
};

export default AdminDashboard;
