import { adminDataAPI } from '../../services/adminApi';
import { DataState, Pager } from '../../components/admin/DataState';
import { PageHeader } from '../../components/admin/AdminLayout';
import { useAdminList } from './useAdminList';
import { formatDateTime } from './adminFormat';

/**
 * The administrator audit trail — `GET /api/admin/audit`.
 *
 * Every write any staff member makes through the admin API lands in
 * `admin_audit_log` with its before and after state. This page is the reason
 * that table exists: a panel that can change another company's subscription
 * without leaving a trace is an unattributable back door.
 *
 * The endpoint has no `search` parameter, so this list is paged but not
 * searched. It does accept `adminId`, `entityType` and `tenantId` filters,
 * which are not wired to controls yet — noted rather than faked.
 */
const AdminActivity = () => {
  const { data, loading, error, reload, paging, setPage } = useAdminList(adminDataAPI.audit);
  const entries = data?.entries ?? [];

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Every change made by a platform administrator, newest first."
      />

      <div className="card overflow-hidden">
        <DataState
          loading={loading}
          error={error}
          onRetry={reload}
          isEmpty={entries.length === 0}
          emptyTitle="No administrator actions recorded"
          emptyHint="This fills up as staff change tenants, trainers or subscriptions. Sign-ins are recorded here too."
          loadingLabel="Loading activity…"
        >
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-3">When</th>
                    <th className="px-6 py-3">Actor</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Resource</th>
                    <th className="px-6 py-3">Changed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {entries.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors align-top">
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatDateTime(e.created_at)}
                      </td>
                      <td className="px-6 py-4 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {e.admin_email || <span className="text-gray-400 italic">deleted account</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="badge-blue">{e.action}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <div>{e.entity_type}</div>
                        {e.tenant_id && (
                          <div className="text-xs text-gray-400 font-mono">tenant {e.tenant_id.slice(0, 8)}…</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {e.changes
                          ? <ChangeSummary changes={e.changes} />
                          : <span className="text-gray-400">—</span>}
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
    </>
  );
};

/**
 * Render the audited diff.
 *
 * The server whitelists what it records, so nothing secret can reach here — but
 * this still renders only field NAMES and short values, never a raw object
 * dump, so a long note or bio cannot flood the row.
 */
const ChangeSummary = ({ changes }) => {
  const after = changes.after ?? changes;
  const before = changes.before ?? null;

  const fields = Object.keys(after || {}).filter((k) => k !== 'before');
  if (fields.length === 0) return <span className="text-gray-400">—</span>;

  const short = (v) => {
    if (v === null || v === undefined) return 'empty';
    const s = String(v);
    return s.length > 32 ? `${s.slice(0, 32)}…` : s;
  };

  return (
    <ul className="space-y-0.5">
      {fields.slice(0, 4).map((f) => (
        <li key={f} className="text-xs">
          <span className="font-medium text-gray-700 dark:text-gray-300">{f}</span>
          {before && before[f] !== undefined && (
            <span className="text-gray-400"> {short(before[f])} →</span>
          )}{' '}
          <span className="text-gray-600 dark:text-gray-400">{short(after[f])}</span>
        </li>
      ))}
      {fields.length > 4 && (
        <li className="text-xs text-gray-400">+{fields.length - 4} more</li>
      )}
    </ul>
  );
};

export default AdminActivity;
