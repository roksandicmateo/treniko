import { useCallback, useEffect, useState } from 'react';
import { adminErrorMessage } from '../../services/adminApi';

/**
 * Loading, empty and error rendering for admin pages, plus the hook that feeds
 * it. Every list and every panel goes through here so that no admin screen can
 * ever render blank — a blank screen is indistinguishable from a broken one.
 */

/** Spinner. Sized for a panel, not a page. */
export const Loading = ({ label = 'Loading…' }) => (
  <div className="py-16 text-center" role="status" aria-live="polite">
    <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{label}</p>
  </div>
);

/** Nothing to show, and that is a normal state rather than a fault. */
export const Empty = ({ title = 'Nothing here yet', hint }) => (
  <div className="py-16 text-center">
    <p className="text-gray-700 dark:text-gray-300 font-medium">{title}</p>
    {hint && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{hint}</p>}
  </div>
);

/** Something failed. Always says what, and always offers a way out. */
export const ErrorState = ({ message, onRetry }) => (
  <div className="py-16 text-center" role="alert">
    <p className="text-red-600 dark:text-red-400 font-medium">Could not load this</p>
    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="btn btn-secondary mt-4">Try again</button>
    )}
  </div>
);

/**
 * Choose the right state for a panel, or render its children.
 *
 * Order matters: an error wins over loading (a retry must be reachable), and
 * loading wins over empty (an empty list and a list that has not arrived yet
 * are different things and must not look the same).
 */
export const DataState = ({ loading, error, isEmpty, onRetry, emptyTitle, emptyHint, loadingLabel, children }) => {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading) return <Loading label={loadingLabel} />;
  if (isEmpty) return <Empty title={emptyTitle} hint={emptyHint} />;
  return children;
};

/**
 * Fetch-with-state for a single admin request.
 *
 * `fetcher` must be stable (wrap it in useCallback at the call site) — it is a
 * dependency, and an inline arrow would re-run the request on every render.
 *
 * A request whose result arrives after the component unmounted, or after a
 * newer request was issued, is discarded rather than written to state. Without
 * that, typing quickly in a search box lets a slow early response overwrite a
 * fast later one and the table shows results for the wrong query.
 */
export const useAdminResource = (fetcher, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);

    fetcher()
      .then((res) => { if (current) setData(res.data); })
      .catch((err) => { if (current) setError(adminErrorMessage(err)); })
      .finally(() => { if (current) setLoading(false); });

    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { data, loading, error, reload };
};

/**
 * Pager for the server-paginated list endpoints.
 *
 * Paging is done by the API (`page`, `pageSize`, `total`), not in the browser:
 * the admin endpoints cap `pageSize` at 100 server-side precisely so no client
 * can ask for the whole table.
 */
export const Pager = ({ page, pageSize, total, onPage }) => {
  const pages = Math.max(1, Math.ceil((total || 0) / (pageSize || 25)));
  if (pages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-t border-gray-100 dark:border-gray-800">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-secondary disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
          {page} / {pages}
        </span>
        <button
          className="btn btn-secondary disabled:opacity-40"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
};

/** The search box the list pages share. Server-side search — see useAdminList. */
export const SearchBox = ({ value, onChange, placeholder = 'Search…' }) => (
  <input
    type="search"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    aria-label={placeholder}
    className="input max-w-xs"
  />
);

export default DataState;
