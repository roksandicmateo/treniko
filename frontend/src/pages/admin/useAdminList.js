import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminResource } from '../../components/admin/DataState';

// SearchBox lives in DataState.jsx: this file is .js, and Vite only transforms
// JSX in .jsx files. Re-exported here so list pages keep one import.
export { SearchBox } from '../../components/admin/DataState';

/**
 * Server-paginated, server-filtered list state.
 *
 * Filtering and paging are the API's job, not the browser's: the admin
 * endpoints accept `search`, `page` and `pageSize` and cap the page size at 100
 * server-side, so the client cannot ask for a whole table. Nothing here filters
 * an already-fetched array.
 *
 * @param {(params: object) => Promise} endpoint  e.g. adminDataAPI.trainers
 * @param {object} [extraParams]                  fixed filters for this page
 * @param {number} [pageSize]
 */
export const useAdminList = (endpoint, extraParams = {}, pageSize = 25) => {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce the search box. Without this every keystroke is a request, and
  // the server-side rate limiter is a shared budget with the rest of the panel.
  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);            // a new query always starts at page 1
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Serialised so the fetcher's identity is stable unless a value really moved.
  const extraKey = JSON.stringify(extraParams);

  const fetcher = useCallback(
    () => endpoint({ page, pageSize, ...(search ? { search } : {}), ...JSON.parse(extraKey) }),
    [endpoint, page, pageSize, search, extraKey]
  );

  const { data, loading, error, reload } = useAdminResource(fetcher, [page, search, extraKey]);

  const paging = useMemo(
    () => ({
      page: data?.page ?? page,
      pageSize: data?.pageSize ?? pageSize,
      total: data?.total ?? 0,
    }),
    [data, page, pageSize]
  );

  return {
    data, loading, error, reload,
    searchInput, setSearchInput,
    search,
    paging, setPage,
  };
};

export default useAdminList;

