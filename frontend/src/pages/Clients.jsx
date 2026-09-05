import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsAPI, subscriptionsAPI } from '../services/api';
import { showToast } from '../components/Toast';
import LimitReachedModal from '../components/LimitReachedModal';
import ConsentModal from '../components/ConsentModal';
import { useTranslation } from 'react-i18next';
import { ClientListSkeleton } from '../components/SkeletonLoader';
import ConfirmModal from '../components/ConfirmModal';
import { useDateLocale } from '../utils/locale';
import Icon from '../components/Icon';
import { formatDayLabel, formatTime } from '../utils/datetime';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Clients = () => {
  const { t } = useTranslation();
  // The active UI language, not the browser's. Passing `undefined` to
  // toLocaleDateString below formatted dates in the OS locale, so an English
  // UI on a Croatian machine showed Croatian dates. See utils/locale.js.
  const dateLocale = useDateLocale();
  const navigate = useNavigate();
  const [clients,      setClients]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState('Active');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData,     setFormData]     = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [search,       setSearch]       = useState('');
  const [searching,    setSearching]    = useState(false);
  const [currentPage,  setCurrentPage]  = useState(1);
  const PAGE_SIZE = 20;
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, type: 'warning' });
  const showConfirm = (title, message, onConfirm, type = 'warning') => setConfirmModal({ open: true, title, message, onConfirm, type });

  // Two states, not three. "Inactive" and "archived" were separate columns in
  // the database and the same thing to a trainer, with the difference explained
  // nowhere. Both read as paused; the client detail page sets both columns
  // together (see pauseClient there), and the filter reads either.
  const FILTERS = [
    { key: 'Active', label: t('clients.active') },
    { key: 'Paused', label: t('clients.onPause') },
  ];

  useEffect(() => { loadClients(); loadSubscription(); }, []);

  const loadClients = async (term = '') => {
    try {
      // The API has supported `?search=` since it was written; the UI never
      // called it, so with thirty clients the only way to find one was to page
      // through the list. Searching on the server also means a match on a
      // client sitting on page three still shows up.
      const response = await clientsAPI.getAll(term ? { search: term } : undefined);
      setClients(response.data.clients);
    } catch { showToast(t('common.error'), 'error'); }
    finally { setLoading(false); setSearching(false); }
  };

  // Debounced: one request per pause in typing rather than one per keystroke.
  useEffect(() => {
    const term = search.trim();
    if (term.length === 0 && !searching) {
      // Nothing to debounce on the first render or after a clear that already
      // reloaded; the initial effect below does the unfiltered load.
    }
    setSearching(true);
    const timer = setTimeout(() => { loadClients(term); setCurrentPage(1); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadSubscription = async () => {
    try {
      const response = await subscriptionsAPI.getStatus();
      setSubscription(response.data.subscription);
    } catch (error) { console.error('Failed to load subscription:', error); }
  };

  // Reset to page 1 when the filter changes. The comment promising this was
  // there; the code was not. Switching from a filter with several pages to one
  // with a single page left currentPage past the end, and the list rendered as
  // an empty table with no pagination controls to escape with.
  useEffect(() => { setCurrentPage(1); }, [filter]);

  const filteredClients = clients.filter(c => {
    if (filter === 'Active') return c.is_active && !c.is_archived;
    if (filter === 'Paused') return !c.is_active || c.is_archived;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = {
    Active: clients.filter(c => c.is_active && !c.is_archived).length,
    Paused: clients.filter(c => !c.is_active || c.is_archived).length,
  };

  // Pausing and deleting a client now live on the client's own page, where the
  // consequences are visible — they were four small text links per row on a
  // phone, next to each other, three of which nobody performs from a list.
  // Reactivating stays here because it is the one action a trainer takes FROM
  // this screen: they filter to paused and bring someone back.
  const handleReactivate = async (e, client) => {
    e.stopPropagation();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/clients/${client.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false, isActive: true })
      });
      if (res.status === 403) {
        const data = await res.json();
        if (data.upgradeRequired) { setLimitModalOpen(true); loadSubscription(); return; }
      }
      if (!res.ok) { showToast(t('common.error'), 'error'); return; }
      showToast(t('clients.clientReactivated'), 'success');
      loadClients(); loadSubscription();
    } catch { showToast(t('common.error'), 'error'); }
  };
  const handleAdd = () => {
    if (subscription && subscription.clients_limit_reached) { setLimitModalOpen(true); return; }
    setEditingClient(null);
    setFormData({ firstName: '', lastName: '', email: '', phone: '' });
    setModalOpen(true);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({ firstName: client.first_name, lastName: client.last_name, email: client.email || '', phone: client.phone || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingClient) { setShowConsentModal(true); return; }
    await saveClient();
  };

  const handleConsentAccepted = async () => {
    setPendingSubmit(true);
    try {
      const response = await clientsAPI.create(formData);
      const newClientId = response.data.client?.id || response.data.id;
      if (newClientId) {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/clients/${newClientId}/consent`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
      }
      setShowConsentModal(false); setModalOpen(false);
      showToast(t('clients.clientAdded'), 'success');
      loadClients(); loadSubscription();
    } catch (error) {
      if (error.response?.data?.upgradeRequired) {
        setShowConsentModal(false); setModalOpen(false);
        setLimitModalOpen(true); loadSubscription();
      } else {
        showToast(error.response?.data?.message || t('common.error'), 'error');
        setShowConsentModal(false);
      }
    } finally { setPendingSubmit(false); }
  };

  const saveClient = async () => {
    try {
      await clientsAPI.update(editingClient.id, formData);
      showToast(t('clients.clientUpdated'), 'success');
      setModalOpen(false); loadClients(); loadSubscription();
    } catch (error) { showToast(error.response?.data?.message || t('common.error'), 'error'); }
  };

  // `window.location.href` tore the whole SPA down and rebuilt it — a blank
  // screen, a fresh bundle parse and a re-validation round trip every time a
  // trainer tapped a client. On a phone on mobile data that is seconds, not
  // milliseconds. Client-side navigation keeps the app alive.
  const handleViewClient = (id) => navigate(`/dashboard/clients/${id}`);

  if (loading) return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
      </div>
      <ClientListSkeleton />
    </div>
  );

  const clientDisplayName = `${formData.firstName} ${formData.lastName}`.trim();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('clients.title')}</h1>
        <button onClick={handleAdd} className="btn-primary">{t('clients.addClient')}</button>
      </div>

      {/* Search. The endpoint has always supported it; the UI did not, so a
          trainer with thirty clients paged through them to find one. */}
      <div className="relative mb-4">
        <Icon name="search" className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <label htmlFor="client-search" className="sr-only">{t('clients.searchLabel')}</label>
        <input
          id="client-search"
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('common.searchPlaceholder')}
          className="input pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label={t('common.clearSearch')}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit mb-6">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {f.label} <span className="text-xs ml-1 opacity-60">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {filteredClients.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-center py-14 px-6">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {search.trim() ? t('clients.noSearchResults') : t('clients.noClients')}
          </p>
          {search.trim()
            ? (
              <button onClick={() => setSearch('')} className="btn-secondary">{t('common.clearSearch')}</button>
            )
            : filter === 'Active' && <button onClick={handleAdd} className="btn-primary">{t('clients.addFirst')}</button>}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
          {/* The wrapper scrolls horizontally rather than the page: at 375px a
              wide row used to push the whole document sideways. */}
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clients.name')}</th>
                {/* The two columns the list is actually opened for. The phone
                    number was here and the session balance was not, so finding
                    out how many sessions someone had left meant opening them
                    and then their packages tab. */}
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clients.remaining')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">{t('clients.nextSession')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden lg:table-cell">{t('clients.lastSession')}</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">{t('clients.status')}</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  <span className="sr-only">{t('clients.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedClients.map(client => {
                const paused = !client.is_active || client.is_archived;
                const remaining = client.sessions_remaining == null ? null : Number(client.sessions_remaining);
                return (
                  <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="px-4 sm:px-6 py-3">
                      {/* A link rather than a click handler on the row: the row
                          was not reachable by keyboard and announced nothing to
                          a screen reader. */}
                      <button
                        type="button"
                        onClick={() => handleViewClient(client.id)}
                        className={`text-left font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded ${
                          paused ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        {client.first_name} {client.last_name}
                      </button>
                      <span className="block text-xs text-gray-400 dark:text-gray-500 truncate max-w-[220px]">
                        {client.email || client.phone || ''}
                      </span>
                    </td>

                    <td className="px-4 sm:px-6 py-3 whitespace-nowrap">
                      {remaining == null ? (
                        <span className="text-sm text-gray-400 dark:text-gray-600">
                          {client.active_package_name ? t('packages.unlimited') : t('clients.noPackage')}
                        </span>
                      ) : (
                        <span className={`text-sm font-semibold tabular-nums ${
                          remaining <= 1 ? 'text-red-600 dark:text-red-400'
                            : remaining <= 3 ? 'text-amber-700 dark:text-amber-400'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}>
                          {remaining}
                        </span>
                      )}
                    </td>

                    <td className="px-4 sm:px-6 py-3 whitespace-nowrap hidden sm:table-cell text-sm text-gray-600 dark:text-gray-400 tabular-nums">
                      {client.next_session_date
                        ? formatDayLabel(client.next_session_date, dateLocale, t)
                        : <span className="text-gray-300 dark:text-gray-600">{t('clients.noUpcoming')}</span>}
                    </td>

                    <td
                      data-testid="client-last-session"
                      className="px-4 sm:px-6 py-3 whitespace-nowrap hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400 tabular-nums"
                    >
                      {client.last_session_date
                        ? new Date(client.last_session_date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
                        : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>

                    <td className="px-4 sm:px-6 py-3 whitespace-nowrap hidden md:table-cell">
                      {paused
                        ? <span className="badge-gray">{t('clients.onPause')}</span>
                        : <span className="badge-green">{t('clients.active')}</span>}
                    </td>

                    <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-right">
                      {/* Four text links per row were four small targets side by
                          side on a phone, three of which were lifecycle changes
                          nobody makes from a list. Editing stays; the rest live
                          on the client, where the consequences are visible. */}
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleEdit(client); }}
                        aria-label={`${t('common.edit')} ${client.first_name} ${client.last_name}`}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 dark:hover:text-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                      {paused && (
                        <button
                          type="button"
                          onClick={e => handleReactivate(e, client)}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-800 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 mr-1"
                        >
                          {t('clients.reactivate')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleViewClient(client.id)}
                        aria-label={`${t('attention.openClient')}: ${client.first_name} ${client.last_name}`}
                        className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      >
                        <Icon name="chevronR" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('common.showing')} {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredClients.length)} {t('common.of')} {filteredClients.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ←
            </button>
            {[...Array(totalPages)].map((_, i) => {
              const page = i + 1;
              if (totalPages <= 7 || Math.abs(page - currentPage) <= 2 || page === 1 || page === totalPages) {
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-sm rounded-lg font-medium ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    {page}
                  </button>
                );
              }
              if (Math.abs(page - currentPage) === 3) return <span key={page} className="text-gray-400 px-1">…</span>;
              return null;
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {editingClient ? t('clients.editProfile') : t('clients.addNew')}
            </h2>
            {!editingClient && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 mb-4">
                <p className="text-xs text-blue-700 dark:text-blue-400">🔒 <strong>GDPR:</strong> {t('clients.gdprNotice')}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.firstName')} *</label>
                <input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.lastName')} *</label>
                <input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.email')}</label>
                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('clients.phone')}</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="input" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">{t('common.cancel')}</button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingClient ? t('clients.saveChanges') : t('clients.addClient')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConsentModal && (
        <ConsentModal clientName={clientDisplayName} onAccept={handleConsentAccepted} onDecline={() => setShowConsentModal(false)} />
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal(m => ({ ...m, open: false }))}
        onConfirm={() => { confirmModal.onConfirm?.(); setConfirmModal(m => ({ ...m, open: false })); }}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
      />
      <LimitReachedModal
        isOpen={limitModalOpen} onClose={() => setLimitModalOpen(false)}
        limitType="clients" currentCount={subscription?.clients_count || 0}
        maxCount={subscription?.max_clients || 0} planName={subscription?.plan_display_name || 'Free'}
      />
    </div>
  );
};

export default Clients;
