import TenantTable, { tenantColumn, trainersColumn, BusinessDataNotice } from './TenantTable';
import { formatCount, formatDate, formatUsage, statusBadge } from './adminFormat';

/**
 * The three tenant-scoped views: Clients, Subscriptions and Sessions.
 *
 * All three read `GET /api/admin/tenants` and differ only in columns, so they
 * are thin configurations of one shared table.
 */

// ── Clients ─────────────────────────────────────────────────────────────────
export const AdminClients = () => (
  <TenantTable
    title="Clients"
    subtitle="Client counts per tenant, against each plan's limit."
    notice={<BusinessDataNotice what="client records" />}
    columns={[
      tenantColumn,
      { key: 'plan', header: 'Plan', render: (t) => t.plan_display_name || t.plan_name },
      { key: 'clients', header: 'Clients', align: 'right', render: (t) => formatUsage(t.clients_count, t.max_clients) },
      {
        key: 'atlimit',
        header: 'At limit',
        render: (t) => (t.clients_limit_reached
          ? <span className="badge-amber">at limit</span>
          : <span className="badge-gray">headroom</span>),
      },
      trainersColumn,
      { key: 'created', header: 'Tenant since', render: (t) => formatDate(t.created_at) },
    ]}
  />
);

// ── Subscriptions ───────────────────────────────────────────────────────────
export const AdminSubscriptions = () => (
  <TenantTable
    title="Subscriptions"
    subtitle="Plan, status, limits and usage for every tenant."
    columns={[
      tenantColumn,
      { key: 'plan', header: 'Plan', render: (t) => t.plan_display_name || t.plan_name },
      {
        key: 'status',
        header: 'Status',
        render: (t) => (
          <span className="flex flex-wrap gap-1.5">
            <span className={statusBadge(t.subscription_status)}>{t.subscription_status}</span>
            {t.is_trial && <span className="badge-blue">trial</span>}
            {t.is_read_only && <span className="badge-red">read-only</span>}
          </span>
        ),
      },
      { key: 'clients', header: 'Clients', align: 'right', render: (t) => formatUsage(t.clients_count, t.max_clients) },
      {
        key: 'sessions',
        header: 'Sessions',
        align: 'right',
        render: (t) => formatUsage(t.sessions_count, t.max_sessions_per_month),
      },
      { key: 'ends', header: 'Period ends', render: (t) => formatDate(t.current_period_end) },
      {
        key: 'expiry',
        header: 'Days left',
        align: 'right',
        render: (t) => (t.days_until_expiry === null || t.days_until_expiry === undefined
          ? '—'
          : <span className={t.days_until_expiry < 7 ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
              {t.days_until_expiry}
            </span>),
      },
    ]}
  />
);

// ── Sessions ────────────────────────────────────────────────────────────────
export const AdminSessions = () => (
  <TenantTable
    title="Sessions"
    subtitle="Session volume per tenant for the current billing period, against each plan's monthly limit."
    notice={<BusinessDataNotice what="training sessions" />}
    columns={[
      tenantColumn,
      { key: 'plan', header: 'Plan', render: (t) => t.plan_display_name || t.plan_name },
      {
        key: 'sessions',
        header: 'Sessions this period',
        align: 'right',
        render: (t) => formatUsage(t.sessions_count, t.max_sessions_per_month),
      },
      { key: 'clients', header: 'Clients', align: 'right', render: (t) => formatCount(t.clients_count) },
      { key: 'ends', header: 'Period ends', render: (t) => formatDate(t.current_period_end) },
      trainersColumn,
    ]}
  />
);
