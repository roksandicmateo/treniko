// frontend/src/components/ProfileMenu.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ProfileMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [deletionPending, setDeletionPending] = useState(false);
  const [deletionDate, setDeletionDate] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setShowDeleteConfirm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    fetch(`${API_URL}/subscriptions/status`, { headers })
      .then(r => r.json())
      .then(d => setSubscription(d.subscription))
      .catch(() => {});

    fetch(`${API_URL}/account/deletion-status`, { headers })
      .then(r => r.json())
      .then(d => {
        setDeletionPending(d.pending);
        if (d.pending) setDeletionDate(d.scheduled_delete_at);
      })
      .catch(() => {});
  }, [open]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/export`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `treniko-export-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/account/request-deletion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      setDeletionPending(true);
      setDeletionDate(data.scheduled_delete_at);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDeletion = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/account/cancel-deletion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    if (data.success) {
      setDeletionPending(false);
      setDeletionDate(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : '?';

  const planName = subscription?.plan_display_name || 'Free';
  const planColor = planName === 'Enterprise'
    ? 'text-purple-600 bg-purple-50'
    : planName === 'Pro'
    ? 'text-blue-600 bg-blue-50'
    : 'text-gray-600 bg-gray-100';

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold">
          {initials}
        </div>
        <span className="text-sm font-medium text-gray-700 hidden sm:block">
          {user?.firstName} {user?.lastName}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">

          <div className="px-5 py-4 bg-gradient-to-br from-primary-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-lg font-bold">
                {initials}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>

          <div className="p-3 space-y-1">

            {/* My Profile */}
            <div
              className="px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => { navigate('/dashboard/profile'); setOpen(false); }}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">👤</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">My Profile</p>
                  <p className="text-xs text-gray-400">Personal info & settings</p>
                </div>
              </div>
            </div>

            {/* Subscription */}
            <div
              className="px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => { navigate('/dashboard/subscription'); setOpen(false); }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-base">💳</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Subscription</p>
                    <p className="text-xs text-gray-400">Manage your plan</p>
                  </div>
                </div>
                {subscription && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${planColor}`}>
                    {planName}
                  </span>
                )}
              </div>
            </div>

            <div className="border-t border-gray-100 my-1" />
            <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">GDPR & Privacy</p>

            {/* Export data */}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
            >
              <span className="text-base">📦</span>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {exporting ? 'Exporting...' : 'Export My Data'}
                </p>
                <p className="text-xs text-gray-400">Download ZIP with all your data</p>
              </div>
            </button>

            {/* Account deletion */}
            {!deletionPending ? (
              !showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left"
                >
                  <span className="text-base">🗑️</span>
                  <div>
                    <p className="text-sm font-medium text-red-600">Request Account Deletion</p>
                    <p className="text-xs text-gray-400">Scheduled 30 days from request</p>
                  </div>
                </button>
              ) : (
                <div className="px-3 py-3 bg-red-50 rounded-xl">
                  <p className="text-xs text-red-700 font-medium mb-2">
                    ⚠️ This will schedule deletion of all your data in 30 days. Are you sure?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-1.5 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestDeletion}
                      className="flex-1 py-1.5 text-xs rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
                    >
                      Yes, Request
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="px-3 py-3 bg-yellow-50 rounded-xl">
                <p className="text-xs text-yellow-800 font-medium mb-1">⏳ Deletion scheduled</p>
                <p className="text-xs text-yellow-700 mb-2">
                  Your account will be deleted on{' '}
                  {deletionDate ? new Date(deletionDate).toLocaleDateString() : '...'}
                </p>
                <button
                  onClick={handleCancelDeletion}
                  className="w-full py-1.5 text-xs rounded-lg border border-yellow-400 text-yellow-800 hover:bg-yellow-100 transition-colors font-medium"
                >
                  Cancel Deletion
                </button>
              </div>
            )}

            <div className="border-t border-gray-100 my-1" />

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-base">🚪</span>
              <p className="text-sm font-medium text-gray-700">Log Out</p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileMenu;
