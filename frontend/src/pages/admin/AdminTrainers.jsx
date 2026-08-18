import { Link } from 'react-router-dom';
import { adminDataAPI } from '../../services/adminApi';
import { DataState, Pager } from '../../components/admin/DataState';
import { PageHeader } from '../../components/admin/AdminLayout';
import { useAdminList, SearchBox } from './useAdminList';
import { formatDate, isLocked } from './adminFormat';

/**
 * Every trainer on the platform.
 *
 * `GET /api/admin/trainers` returns an explicit column list that excludes
 * `password_hash`, `verification_token` and `verification_token_expires` — the
 * server never sends them, so this table cannot render them by mistake.
 *
 * Read-only by design: the brief asked for no destructive actions yet. The
 * detail view is where account status, subscription and usage live.
 */
const AdminTrainers = () => {
  const {
    data, loading, error, reload,
    searchInput, setSearchInput, search,
    paging, setPage,
  } = useAdminList(adminDataAPI.trainers);

  const trainers = data?.trainers ?? [];

  return (
    <>
      <PageHeader
        title="Trainers"
        subtitle="Every trainer account. Search runs on the server across name and email."
      >
        <SearchBox value={searchInput} onChange={setSearchInput} placeholder="Search name or email…" />
      </PageHeader>

      <div className="card overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={trainers.length === 0}
          emptyTitle={search ? `No trainers match “${search}”` : 'No trainers yet'}
          emptyHint={search ? 'Try a different name or email.' : 'Trainers appear here as soon as they register.'}
          loadingLabel="Loading trainers…"
        >
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-3">Trainer</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Tenant</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Registered</th>
                    <th className="px-6 py-3">Last updated</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {trainers.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {t.first_name} {t.last_name}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{t.email}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{t.tenant_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1.5">
                          {isLocked(t.locked_until)
                            ? <span className="badge-red">locked</span>
                            : <span className="badge-green">active</span>}
                          {t.email_verified
                            ? <span className="badge-gray">verified</span>
                            : <span className="badge-amber">unverified</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(t.created_at)}</td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(t.updated_at)}</td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <Link to={`/admin/trainers/${t.id}`} className="text-primary-500 hover:text-primary-600 font-medium">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...paging} onPage={setPage} />
          </>
        </DataState>
      </div>

      <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        “Last updated” is the profile row's <code>updated_at</code>. The trainer schema records no
        last-login time, so genuine last-activity is not available here — see the System page.
      </p>
    </>
  );
};

export default AdminTrainers;
