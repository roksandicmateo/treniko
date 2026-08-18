import { useCallback } from 'react';
import { adminDataAPI, healthCheck } from '../../services/adminApi';
import { DataState, useAdminResource } from '../../components/admin/DataState';
import { PageHeader } from '../../components/admin/AdminLayout';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { formatDateTime } from './adminFormat';

const Row = ({ label, value, state, note }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="min-w-0">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
      {note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xl">{note}</p>}
    </div>
    <div className="shrink-0">
      {state === 'ok' && <span className="badge-green">{value}</span>}
      {state === 'warn' && <span className="badge-amber">{value}</span>}
      {state === 'bad' && <span className="badge-red">{value}</span>}
      {!state && <span className="text-sm text-gray-500 dark:text-gray-400">{value}</span>}
    </div>
  </div>
);

/**
 * Read-only system status.
 *
 * Deliberately modest, because the backend exposes very little that is safe to
 * show here and this page does not invent the rest. What exists:
 *
 *   - `GET /health` — public liveness, returns { status, timestamp } only.
 *   - `GET /api/admin/overview` — proves the API *and* the database are
 *     answering, since it is a dozen live counts. If it returns, Postgres is up.
 *
 * What does not exist, and is therefore reported as unavailable rather than
 * guessed: migration status, application version/commit, and RLS enforcement
 * state. Each would need a new backend endpoint; see the implementation report.
 */
const AdminSystem = () => {
  const { admin } = useAdminAuth();

  const healthFetcher = useCallback(() => healthCheck(), []);
  const { data: health, loading: healthLoading, error: healthError, reload: reloadHealth } =
    useAdminResource(healthFetcher);

  // Overview doubles as a database probe: it is a dozen live COUNT queries.
  const dbFetcher = useCallback(() => adminDataAPI.overview(), []);
  const { data: db, loading: dbLoading, error: dbError, reload: reloadDb } = useAdminResource(dbFetcher);

  return (
    <>
      <PageHeader
        title="System"
        subtitle="Read-only status. Nothing on this page can change anything."
      />

      <div className="space-y-6">
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Services</h2>
            <button onClick={() => { reloadHealth(); reloadDb(); }} className="btn btn-secondary">Refresh</button>
          </div>

          <Row
            label="API"
            note="Public liveness endpoint GET /health."
            state={healthLoading ? undefined : healthError ? 'bad' : 'ok'}
            value={healthLoading ? 'checking…' : healthError ? 'unreachable' : (health?.status ?? 'healthy')}
          />

          <Row
            label="Database"
            note="Inferred from the overview endpoint, which runs a dozen live counts. If it answers, PostgreSQL answered."
            state={dbLoading ? undefined : dbError ? 'bad' : 'ok'}
            value={dbLoading ? 'checking…' : dbError ? 'not responding' : 'responding'}
          />

          <Row
            label="Admin API authentication"
            note="Your session was verified against platform_admins on page load."
            state="ok"
            value={admin ? `signed in as ${admin.role}` : 'unknown'}
          />

          <Row
            label="Last successful check"
            value={healthLoading || dbLoading ? '—' : formatDateTime(new Date().toISOString())}
          />
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Not available</h2>
          </div>

          <Row
            label="Migration status"
            note="The backend has no endpoint that reports applied/pending migrations. It is available on the server with `npm run db:status`."
            state="warn"
            value="no endpoint"
          />
          <Row
            label="Application version / commit"
            note="Nothing in the API reports the deployed commit. Check with `git rev-parse HEAD` on the server."
            state="warn"
            value="no endpoint"
          />
          <Row
            label="RLS enforcement state"
            note="The application logs this at startup (config/rlsStatus.js) but does not expose it over HTTP."
            state="warn"
            value="no endpoint"
          />
        </div>

        <DataState
          loading={false}
          error={null}
          isEmpty={false}
        >
          <p className="text-xs text-gray-400 dark:text-gray-500">
            These three are reported as unavailable rather than estimated. Adding them means adding
            backend endpoints, which was deliberately out of scope for this panel.
          </p>
        </DataState>
      </div>
    </>
  );
};

export default AdminSystem;
