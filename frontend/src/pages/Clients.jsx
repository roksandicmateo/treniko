import { useState, useEffect } from 'react';
import { clientsAPI, subscriptionsAPI } from '../services/api';
import { showToast } from '../components/Toast';
import LimitReachedModal from '../components/LimitReachedModal';
import ConsentModal from '../components/ConsentModal';
import { useTranslation } from 'react-i18next';
import { ClientListSkeleton } from '../components/SkeletonLoader';
import ConfirmModal from '../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Clients = () => {
  const { t } = useTranslation();
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
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null, type: 'warning' });
  const showConfirm = (title, message, onConfirm, type = 'warning') => setConfirmModal({ open: true, title, message, onConfirm, type });

  const FILTERS = [
    { key: 'Active',   label: t('clients.active') },
    { key: 'Inactive', label: t('clients.inactive') },
    { key: 'Archived', label: t('clients.archived') },
  ];

  useEffect(() => { loadClients(); loadSubscription(); }, []);

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      setClients(response.data.clients);
    } catch { showToast(t('common.error'), 'error'); }
    finally { setLoading(false); }
  };

  const loadSubscription = async () => {
    try {
      const response = await subscriptionsAPI.getStatus();
      setSubscription(response.data.subscription);
    } catch (error) { console.error('Failed to load subscription:', error); }
  };

  // Reset to page 1 when filter changes
  const filteredClients = clients.filter(c => {
    if (filter === 'Active')   return c.is_active && !c.is_archived;
    if (filter === 'Inactive') return !c.is_active && !c.is_archived;
    if (filter === 'Archived') return c.is_archived;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = filteredClients.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = {
    Active:   clients.filter(c => c.is_active && !c.is_archived).length,
    Inactive: clients.filter(c => !c.is_active && !c.is_archived).length,
    Archived: clients.filter(c => c.is_archived).length,
  };

  const handleSetStatus = async (client, updates, successMsg) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(`${API_URL}/clients/${client.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      showToast(successMsg, 'success');
      loadClients(); loadSubscription();
    } catch { showToast(t('common.error'), 'error'); }
  };

  const handleArchive    = (e, client) => { e.stopPropagation(); showConfirm(t('clients.archive'), t('clients.archiveConfirm'), () => handleSetStatus(client, { isArchived: true, isActive: false }, t('clients.archived')), 'warning'); };
  const handleReactivate = (e, client) => { e.stopPropagation(); handleSetStatus(client, { isArchived: false, isActive: true }, t('clients.active')); };
  const handleDeactivate = (e, client) => { e.stopPropagation(); handleSetStatus(client, { isActive: false }, t('clients.inactive')); };

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
      showToast(t('clients.active'), 'success');
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
      showToast(t('common.save'), 'success');
      setModalOpen(false); loadClients(); loadSubscription();
    } catch (error) { showToast(error.response?.data?.message || t('common.error'), 'error'); }
  };

  const handleDelete = async (id) => {
    showConfirm(t('common.delete'), t('clients.deleteConfirm'), async () => {
    try {
      await clientsAPI.delete(id);
      showToast(t('common.delete'), 'success');
      loadClients(); loadSubscription();
    } catch { showToast(t('common.error'), 'error'); }
    }, 'danger');
  };

  const handleViewClient = (id) => { window.location.href = `/dashboard/clients/${id}`; };

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
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-center py-16">
          <p className="text-gray-400 dark:text-gray-500 mb-4">{t('clients.noClients')}</p>
          {filter === 'Active' && <button onClick={handleAdd} className="btn-primary">{t('clients.addFirst')}</button>}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clients.name')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clients.email')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">{t('clients.phone')}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clients.status')}</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('clients.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {paginatedClients.map(client => (
                <tr key={client.id} onClick={() => handleViewClient(client.id)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`font-medium ${client.is_archived ? 'text-gray-400' : 'text-gray-900 dark:text-gray-100'}`}>
                      {client.first_name} {client.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{client.email || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell">{client.phone || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {client.completed_sessions > 0 ? (
                        <span className="font-medium text-gray-800 dark:text-gray-200">{client.completed_sessions}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                      {client.completed_sessions > 0 && (
                        <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">{t('training.completed').toLowerCase()}</span>
                      )}
                    </div>
                    {client.last_session_date && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {new Date(client.last_session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.is_archived
                      ? <span className="badge-yellow">{t('clients.archived')}</span>
                      : client.is_active
                        ? <span className="badge-green">{t('clients.active')}</span>
                        : <span className="badge-gray">{t('clients.inactive')}</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                    {client.is_active && !client.is_archived && <>
                      <button onClick={e => { e.stopPropagation(); handleEdit(client); }} className="text-primary-500 hover:text-primary-700">{t('common.edit')}</button>
                      <button onClick={e => handleDeactivate(e, client)} className="text-amber-500 hover:text-amber-700">{t('clients.deactivate')}</button>
                      <button onClick={e => handleArchive(e, client)} className="text-gray-400 hover:text-gray-600">{t('clients.archive')}</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(client.id); }} className="text-red-500 hover:text-red-700">{t('common.delete')}</button>
                    </>}
                    {!client.is_active && !client.is_archived && <>
                      <button onClick={e => { e.stopPropagation(); handleEdit(client); }} className="text-primary-500 hover:text-primary-700">{t('common.edit')}</button>
                      <button onClick={e => handleReactivate(e, client)} className="text-green-500 hover:text-green-700">{t('clients.reactivate')}</button>
                      <button onClick={e => handleArchive(e, client)} className="text-gray-400 hover:text-gray-600">{t('clients.archive')}</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(client.id); }} className="text-red-500 hover:text-red-700">{t('common.delete')}</button>
                    </>}
                    {client.is_archived && <>
                      <button onClick={e => handleReactivate(e, client)} className="text-green-500 hover:text-green-700">{t('clients.reactivate')}</button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(client.id); }} className="text-red-500 hover:text-red-700">{t('common.delete')}</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
