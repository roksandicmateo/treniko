import { useState, useEffect } from 'react';
import { clientsAPI, subscriptionsAPI } from '../services/api';
import { showToast } from '../components/Toast';
import LimitReachedModal from '../components/LimitReachedModal';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    loadClients();
    loadSubscription();
  }, []);

  const loadClients = async () => {
    try {
      const response = await clientsAPI.getAll();
      setClients(response.data.clients);
    } catch (error) {
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

  const handleAdd = () => {
    // Check if limit is reached
    if (subscription && subscription.clients_limit_reached) {
      setLimitModalOpen(true);
      return;
    }

    setEditingClient(null);
    setFormData({ firstName: '', lastName: '', email: '', phone: '' });
    setModalOpen(true);
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      firstName: client.first_name,
      lastName: client.last_name,
      email: client.email || '',
      phone: client.phone || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await clientsAPI.update(editingClient.id, formData);
        showToast('Client updated successfully', 'success');
      } else {
        await clientsAPI.create(formData);
        showToast('Client added successfully', 'success');
      }
      setModalOpen(false);
      loadClients();
      loadSubscription(); // Refresh subscription to update usage
    } catch (error) {
      if (error.response?.data?.upgradeRequired) {
        // Limit reached error from backend
        setModalOpen(false);
        setLimitModalOpen(true);
        loadSubscription();
      } else {
        showToast(error.response?.data?.message || 'Failed to save client', 'error');
      }
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    
    try {
      await clientsAPI.delete(id);
      showToast('Client deleted successfully', 'success');
      loadClients();
      loadSubscription();
    } catch (error) {
      showToast('Failed to delete client', 'error');
    }
  };

  const handleViewClient = (id) => {
    window.location.href = `/dashboard/clients/${id}`;
  };

  if (loading) {
    return <div className="text-center py-12">Loading clients...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <button onClick={handleAdd} className="btn-primary">
          + Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500 mb-4">No clients yet</p>
          <button onClick={handleAdd} className="btn-primary">
            Add Your First Client
          </button>
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
              {clients.map((client) => (
                <tr 
                  key={client.id} 
                  onClick={() => handleViewClient(client.id)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {client.first_name} {client.last_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.email || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {client.phone || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {client.is_active ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(client);
                      }}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(client.id);
                      }}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  {editingClient ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Limit Reached Modal */}
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
