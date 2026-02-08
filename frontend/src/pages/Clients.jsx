import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clientsAPI } from '../services/api';
import ClientModal from '../components/ClientModal';

const Clients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadClients();
  }, [search, showActiveOnly]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const params = {
        search: search || undefined,
        isActive: showActiveOnly ? 'true' : undefined,
      };
      const response = await clientsAPI.getAll(params);
      setClients(response.data.clients);
      setError('');
    } catch (err) {
      setError('Failed to load clients');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewClient = (clientId) => {
    navigate(`/dashboard/clients/${clientId}`);
  };

  const handleAddClient = () => {
    setSelectedClient(null);
    setModalOpen(true);
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setModalOpen(true);
  };

  const handleDeleteClient = async (clientId) => {
    if (!confirm('Are you sure you want to delete this client? This will also delete all their training sessions.')) {
      return;
    }

    try {
      await clientsAPI.delete(clientId);
      loadClients();
    } catch (err) {
      alert('Failed to delete client');
      console.error(err);
    }
  };

  const handleDeactivateClient = async (clientId) => {
    try {
      await clientsAPI.deactivate(clientId);
      loadClients();
    } catch (err) {
      alert('Failed to deactivate client');
      console.error(err);
    }
  };

  const handleSaveClient = () => {
    setModalOpen(false);
    loadClients();
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
        <button onClick={handleAddClient} className="btn-primary">
          + Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="rounded text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Active clients only</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Clients Table */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search ? 'No clients found matching your search' : 'No clients yet. Add your first client!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
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
                      <div className="text-sm font-medium text-gray-900">
                        {client.first_name} {client.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{client.email || '—'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{client.phone || '—'}</div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClient(client);
                        }}
                        className="text-primary-600 hover:text-primary-900 mr-4"
                      >
                        Edit
                      </button>
                      {client.is_active && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeactivateClient(client.id);
                          }}
                          className="text-yellow-600 hover:text-yellow-900 mr-4"
                        >
                          Deactivate
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClient(client.id);
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
      </div>

      {/* Client Modal */}
      {modalOpen && (
        <ClientModal
          client={selectedClient}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveClient}
        />
      )}
    </div>
  );
};

export default Clients;
