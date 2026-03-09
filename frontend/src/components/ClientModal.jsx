// frontend/src/components/ClientModal.jsx  (UPDATED)
import { useState, useEffect } from 'react';
import { clientsAPI } from '../services/api';
import ConsentModal from './ConsentModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ClientModal = ({ client, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Consent state — only required for new clients
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

  // For existing clients, check if consent already exists
  const [existingConsent, setExistingConsent] = useState(false);

  useEffect(() => {
    if (client) {
      setFormData({
        firstName: client.first_name || '',
        lastName: client.last_name || '',
        email: client.email || '',
        phone: client.phone || '',
      });
      // Check existing consent for edit mode
      checkExistingConsent(client.id);
    }
  }, [client]);

  const checkExistingConsent = async (clientId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/clients/${clientId}/consent`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setExistingConsent(data.has_consent);
      setConsentGiven(data.has_consent);
    } catch {
      // ignore
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  // Called when user clicks Save — for new clients, show consent modal first
  const handleSaveClick = () => {
    if (!client && !consentGiven) {
      // New client — need consent before saving
      setShowConsentModal(true);
    } else {
      handleSubmit();
    }
  };

  // Called after consent is confirmed in the modal
  const handleConsentAccepted = async () => {
    setConsentLoading(true);
    try {
      // First create the client
      const response = await clientsAPI.create(formData);
      const newClientId = response.data.client?.id || response.data.id;

      // Then record consent
      if (newClientId) {
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/clients/${newClientId}/consent`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
      }

      setShowConsentModal(false);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save client');
      setShowConsentModal(false);
    } finally {
      setConsentLoading(false);
    }
  };

  // Regular submit for editing existing clients
  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await clientsAPI.update(client.id, formData);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save client');
    } finally {
      setLoading(false);
    }
  };

  const clientDisplayName = formData.firstName
    ? `${formData.firstName} ${formData.lastName}`.trim()
    : 'this client';

  return (
    <>
      {/* Consent modal — shown before creating new client */}
      {showConsentModal && (
        <ConsentModal
          clientName={clientDisplayName}
          onAccept={handleConsentAccepted}
          onDecline={() => setShowConsentModal(false)}
        />
      )}

      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {client ? 'Edit Client' : 'Add New Client'}
          </h2>

          {/* Consent status badge — shown in edit mode */}
          {client && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-4 ${
              existingConsent
                ? 'bg-green-50 text-green-700'
                : 'bg-yellow-50 text-yellow-700'
            }`}>
              <span>{existingConsent ? '✅' : '⚠️'}</span>
              <span>
                {existingConsent
                  ? 'Health data consent recorded'
                  : 'No health data consent on file'}
              </span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="input"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="input"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input"
              />
            </div>

            {/* GDPR notice for new clients */}
            {!client && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  🔒 <strong>GDPR:</strong> You will be asked to confirm health data consent before this client is saved.
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 btn-secondary"
                disabled={loading || consentLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                className="flex-1 btn-primary"
                disabled={loading || consentLoading || !formData.firstName || !formData.lastName}
              >
                {loading || consentLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ClientModal;
