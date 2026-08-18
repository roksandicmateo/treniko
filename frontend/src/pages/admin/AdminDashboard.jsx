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
                        <span className="badge-gray shrink-0">
                          {t.trainer_count} trainer{t.trainer_count === 1 ? '' : 's'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

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
