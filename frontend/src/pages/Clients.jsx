import { useState, useEffect } from 'react';
import { clientsAPI, subscriptionsAPI } from '../services/api';
import { showToast } from '../components/Toast';
import LimitReachedModal from '../components/LimitReachedModal';
import ConsentModal from '../components/ConsentModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const FILTERS = ['Active', 'Inactive', 'Archived'];

const Clients = () => {
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

  useEffect(() => { loadClients(); loadSubscription(); }, []);

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      setClients(response.data.clients);
    } catch {
      showToast('Failed to load clients', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscription = async () => {
    try {
      const response = await subscriptionsAPI.getStatus();
      setSubscription(response.data.subscription);
    } catch (error) {
      console.error('Failed to load subscription:', error);
    }
  };

  const filteredClients = clients.filter(c => {
    if (filter === 'Active')   return c.is_active && !c.is_archived;
    if (filter === 'Inactive') return !c.is_active && !c.is_archived;
    if (filter === 'Archived') return c.is_archived;
    return true;
  });

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
      loadClients();
      loadSubscription();
    } catch {
      showToast('Failed to update client', 'error');
    }
  };

  const handleArchive = (e, client) => {
    e.stopPropagation();
    if (!window.confirm(`Archive ${client.first_name} ${client.last_name}?`)) return;
    handleSetStatus(client, { isArchived: true, isActive: false }, 'Client archived');
  };

  const handleReactivate = (e, client) => {
    e.stopPropagation();
    handleSetStatus(client, { isArchived: false, isActive: true }, 'Client reactivated');
  };

  const handleDeactivate = (e, client) => {
    e.stopPropagation();
    handleSetStatus(client, { isActive: false }, 'Client deactivated');
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
      setShowConsentModal(false);
      setModalOpen(false);
      showToast('Client added and consent recorded', 'success');
      loadClients();
      loadSubscription();
    } catch (error) {
      if (error.response?.data?.upgradeRequired) {
        setShowConsentModal(false);
        setModalOpen(false);
        setLimitModalOpen(true);
        loadSubscription();
      } else {
        showToast(error.response?.data?.message || 'Failed to save client', 'error');
        setShowConsentModal(false);
      }
    } finally {
      setPendingSubmit(false);
    }
  };

  const saveClient = async () => {
    try {
      await clientsAPI.update(editingClient.id, formData);
      showToast('Client updated successfully', 'success');
      setModalOpen(false);
      loadClients();
      loadSubscription();
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to save client', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      await clientsAPI.delete(id);
      showToast('Client deleted successfully', 'success');
      loadClients();
      loadSubscription();
    } catch {
      showToast('Failed to delete client', 'error');
    }
  };

  const handleViewClient = (id) => { window.location.href = `/dashboard/clients/${id}`; };

  if (loading) return <div className="text-center py-12">Loading clients...</div>;

  const clientDisplayName = `${formData.firstName} ${formData.lastName}`.trim();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <button onClick={handleAdd} className="btn-primary">+ Add Client</button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f} <span className="text-xs ml-1 opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>

      {filteredClients.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">
            {filter === 'Active' ? 'No active clients yet' : filter === 'Inactive' ? 'No inactive clients' : 'No archived clients'}
          </p>
          {filter === 'Active' && <button onClick={handleAdd} className="btn-primary">Add Your First Client</button>}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id} onClick={() => handleViewClient(client.id)} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`font-medium ${client.is_archived ? 'text-gray-400' : 'text-gray-900'}`}>
                      {client.first_name} {client.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.email || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.phone || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.is_archived ? (
                      <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Archived</span>
                    ) : client.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Active</span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Inactive</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-3">
                    {client.is_active && !client.is_archived && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(client); }} className="text-primary-600 hover:text-primary-900">Edit</button>
                        <button onClick={(e) => handleDeactivate(e, client)} className="text-yellow-600 hover:text-yellow-900">Deactivate</button>
                        <button onClick={(e) => handleArchive(e, client)} className="text-gray-500 hover:text-gray-700">Archive</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} className="text-red-600 hover:text-red-900">Delete</button>
                      </>
                    )}
                    {!client.is_active && !client.is_archived && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(client); }} className="text-primary-600 hover:text-primary-900">Edit</button>
                        <button onClick={(e) => handleReactivate(e, client)} className="text-green-600 hover:text-green-900">Reactivate</button>
                        <button onClick={(e) => handleArchive(e, client)} className="text-gray-500 hover:text-gray-700">Archive</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} className="text-red-600 hover:text-red-900">Delete</button>
                      </>
                    )}
                    {client.is_archived && (
                      <>
                        <button onClick={(e) => handleReactivate(e, client)} className="text-green-600 hover:text-green-900">Reactivate</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(client.id); }} className="text-red-600 hover:text-red-900">Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
            {!editingClient && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-700">🔒 <strong>GDPR:</strong> You will be asked to confirm health data consent before this client is saved.</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" />
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">{editingClient ? 'Save Changes' : 'Add Client'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConsentModal && (
        <ConsentModal clientName={clientDisplayName} onAccept={handleConsentAccepted} onDecline={() => setShowConsentModal(false)} />
      )}

      <LimitReachedModal
        isOpen={limitModalOpen}
        onClose={() => setLimitModalOpen(false)}
        limitType="clients"
        currentCount={subscription?.clients_count || 0}
        maxCount={subscription?.max_clients || 0}
        planName={subscription?.plan_display_name || 'Free'}
      />
    </div>
  );
};

export default Clients;
