import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminDataAPI } from '../../services/adminApi';
import { DataState, useAdminResource } from '../../components/admin/DataState';
import { PageHeader } from '../../components/admin/AdminLayout';
import { formatDate, formatDateTime, formatUsage, statusBadge, isLocked } from './adminFormat';

const Field = ({ label, children }) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 break-words">{children ?? '—'}</dd>
  </div>
);

/**
 * One trainer, plus the tenant they belong to.
 *
 * Two requests, because the API models them separately: the trainer comes from
 * `GET /trainers/:id`, and the subscription and usage from `GET /tenants/:id`
 * once the tenant id is known. Nothing is combined client-side that the server
 * already joins.
 *
 * Read-only. The API does expose PATCH and unlock endpoints, but the brief
 * asked for no destructive or mutating actions in this first version.
 */
const AdminTrainerDetail = () => {
  const { id } = useParams();

  const trainerFetcher = useCallback(() => adminDataAPI.trainer(id), [id]);
  const { data: tData, loading, error, reload } = useAdminResource(trainerFetcher, [id]);

  const trainer = tData?.trainer;
  const tenantId = trainer?.tenant_id;

  const tenantFetcher = useCallback(
    () => (tenantId ? adminDataAPI.tenant(tenantId) : Promise.resolve({ data: null })),
    [tenantId]
  );
  const { data: tenantData } = useAdminResource(tenantFetcher, [tenantId]);

  const sub = tenantData?.subscription;

  return (
    <>
      <PageHeader title="Trainer">
        <Link to="/admin/trainers" className="btn btn-secondary">← All trainers</Link>
      </PageHeader>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={!loading && !error && !trainer}
        emptyTitle="Trainer not found"
        emptyHint="It may have been deleted since this page was opened."
        loadingLabel="Loading trainer…"
      >
        {trainer && (
          <div className="space-y-6">
            <div className="card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {trainer.first_name} {trainer.last_name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{trainer.email}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {isLocked(trainer.locked_until)
                    ? <span className="badge-red">locked</span>
                    : <span className="badge-green">active</span>}
                  {trainer.email_verified
                    ? <span className="badge-gray">email verified</span>
                    : <span className="badge-amber">email unverified</span>}
                  {trainer.dpa_accepted
                    ? <span className="badge-gray">DPA accepted</span>
                    : <span className="badge-amber">DPA pending</span>}
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <Field label="Tenant">{trainer.tenant_name}</Field>
                <Field label="Phone">{trainer.phone}</Field>
                <Field label="City">{trainer.city}</Field>
                <Field label="Country">{trainer.country}</Field>
                <Field label="Website">{trainer.website}</Field>
                <Field label="Language">{trainer.language}</Field>
                <Field label="Registered">{formatDate(trainer.created_at)}</Field>
                <Field label="Profile updated">{formatDate(trainer.profile_updated_at)}</Field>
                <Field label="DPA accepted at">{formatDateTime(trainer.dpa_accepted_at)}</Field>
                <Field label="Failed logins">{trainer.failed_login_attempts}</Field>
                <Field label="Locked until">
                  {isLocked(trainer.locked_until) ? formatDateTime(trainer.locked_until) : 'not locked'}
                </Field>
              </dl>
            </div>

            {/* Subscription + usage for the trainer's tenant */}
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Subscription and usage</h3>
              {!sub ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No subscription found for this tenant.</p>
              ) : (
                <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  <Field label="Plan">{sub.plan_display_name || sub.plan_name}</Field>
                  <Field label="Status">
                    <span className={statusBadge(sub.subscription_status)}>{sub.subscription_status}</span>
                  </Field>
                  <Field label="Trial">{sub.is_trial ? `yes, until ${formatDate(sub.trial_end)}` : 'no'}</Field>
                  <Field label="Clients">{formatUsage(sub.clients_count, sub.max_clients)}</Field>
                  <Field label="Sessions this period">
                    {formatUsage(sub.sessions_count, sub.max_sessions_per_month)}
                  </Field>
                  <Field label="Period ends">{formatDate(sub.current_period_end)}</Field>
                  <Field label="At client limit">{sub.clients_limit_reached ? 'yes' : 'no'}</Field>
                  <Field label="Read-only mode">{sub.is_read_only ? 'yes' : 'no'}</Field>
                  <Field label="Days until expiry">{sub.days_until_expiry}</Field>
                </dl>
              )}
            </div>

            {/* Admin actions taken against this trainer */}
            <div className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Staff actions on this account</h3>
              </div>
              {(tData.adminHistory ?? []).length === 0 ? (
                <p className="px-6 py-8 text-sm text-gray-500 dark:text-gray-400">
                  No administrator has changed this account.
                </p>
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                  {tData.adminHistory.map((h) => (
                    <li key={h.id} className="px-6 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{h.action}</span>
                        <span className="text-xs text-gray-500">{formatDateTime(h.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">by {h.admin_email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500">
              This account's clients, sessions and payments are tenant-scoped and are not readable by
              platform staff. Only the counts above are available. See the Clients page for why.
            </p>
          </div>
        )}
      </DataState>
    </>
  );
};

export default AdminTrainerDetail;
