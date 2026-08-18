import { Link } from 'react-router-dom';
import { adminDataAPI } from '../../services/adminApi';
import { DataState, Pager } from '../../components/admin/DataState';
import { PageHeader } from '../../components/admin/AdminLayout';
import { useAdminList, SearchBox } from './useAdminList';

/**
 * Shared table for the three pages that are all views of the same resource.
 *
 * Clients, Subscriptions and Sessions all read `GET /api/admin/tenants`, which
 * returns one row per tenant carrying its plan, status, limits and usage
 * counts. They differ only in which of those columns they show, so they share
 * one component rather than three near-identical copies.
 *
 * `columns` is a list of { key, header, render, align } — `render` receives the
 * tenant row.
 */
const TenantTable = ({ title, subtitle, notice, columns, searchPlaceholder = 'Search tenant…' }) => {
  const {
    data, loading, error, reload,
    searchInput, setSearchInput, search,
    paging, setPage,
  } = useAdminList(adminDataAPI.tenants);

  const tenants = data?.tenants ?? [];

  return (
    <>
      <PageHeader title={title} subtitle={subtitle}>
        <SearchBox value={searchInput} onChange={setSearchInput} placeholder={searchPlaceholder} />
      </PageHeader>

      {notice}

      <div className="card overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={tenants.length === 0}
          emptyTitle={search ? `No tenants match “${search}”` : 'No tenants yet'}
          emptyHint={search ? 'Try a different name.' : 'Tenants appear here as soon as someone registers.'}
          loadingLabel="Loading tenants…"
        >
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    {columns.map((c) => (
                      <th key={c.key} className={`px-6 py-3 ${c.align === 'right' ? 'text-right' : ''}`}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {tenants.map((t) => (
                    <tr key={t.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      {columns.map((c) => (
                        <td
                          key={c.key}
                          className={`px-6 py-4 ${c.align === 'right' ? 'text-right tabular-nums' : ''} ${
                            c.key === 'tenant' ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
                          } whitespace-nowrap`}
                        >
                          {c.render(t)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager {...paging} onPage={setPage} />
          </>
        </DataState>
      </div>
    </>
  );
};

/** The tenant name column, shared by all three views. */
export const tenantColumn = {
  key: 'tenant',
  header: 'Tenant',
  render: (t) => t.tenant_name,
};

/** A link through to the tenant's trainers, shared by all three views. */
export const trainersColumn = {
  key: 'trainers',
  header: 'Trainers',
  align: 'right',
  render: (t) => (
    <Link to={`/admin/trainers?tenantId=${t.tenant_id}`} className="text-primary-500 hover:text-primary-600">
      {t.trainer_count}
    </Link>
  ),
};

/**
 * The standing explanation for why row-level business data is absent.
 *
 * Shown on Clients and Sessions. It is not an apology for a missing feature —
 * it is the security model, and staff should know it rather than assume the
 * page is broken.
 */
export const BusinessDataNotice = ({ what }) => (
  <div className="card p-5 mb-6 border-l-4 border-l-primary-500">
    <p className="font-semibold text-gray-900 dark:text-gray-100">
      Individual {what} are not visible to platform staff
    </p>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
      {what[0].toUpperCase() + what.slice(1)} are tenant-scoped and protected by row-level security
      in PostgreSQL. Administration requests deliberately carry no tenant context, so the database
      returns no rows — the boundary is enforced by the database, not by this page hiding anything.
      A trainer's client records carry health notes and dates of birth, and there is no support task
      that needs staff to read them.
    </p>
    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
      The counts below come from <code>subscription_usage</code>, which database triggers maintain and
      which holds no personal data.
    </p>
  </div>
);

export default TenantTable;
