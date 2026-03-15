// frontend/src/pages/PackagesPage.jsx  (NEW FILE)
import { useState, useEffect } from 'react';
import PackageModal from '../components/PackageModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TYPE_LABELS = {
  session_based: '🎯 Session-based',
  time_based: '📅 Time-based',
  unlimited: '♾️ Unlimited',
};

const TYPE_COLORS = {
  session_based: 'bg-blue-50 text-blue-700',
  time_based: 'bg-purple-50 text-purple-700',
  unlimited: 'bg-green-50 text-green-700',
};

const PackagesPage = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [filter, setFilter] = useState('active'); // active | all

  const token = () => localStorage.getItem('token');

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/packages`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setPackages(data.packages || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggleActive = async (pkg) => {
    await fetch(`${API_URL}/packages/${pkg.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !pkg.is_active })
    });
    load();
  };

  const handleDelete = async (pkg) => {
    if (!window.confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return;
    const res = await fetch(`${API_URL}/packages/${pkg.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    });
    const data = await res.json();
    if (data.error) {
      alert(data.error);
    } else {
      load();
    }
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingPkg(null);
    load();
  };

  const filtered = filter === 'active'
    ? packages.filter(p => p.is_active)
    : packages;

  const formatRules = (pkg) => {
    const parts = [];
    if (pkg.total_sessions) parts.push(`${pkg.total_sessions} sessions`);
    if (pkg.duration_days) parts.push(`${pkg.duration_days} days`);
    if (pkg.sessions_per_period && pkg.period_days)
      parts.push(`${pkg.sessions_per_period} per ${pkg.period_days} days`);
    return parts.join(' · ') || '—';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Packages</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage training packages for your clients</p>
        </div>
        <button
          onClick={() => { setEditingPkg(null); setModalOpen(true); }}
          className="btn-primary"
        >
          + New Package
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {['active', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'active' ? `Active (${packages.filter(p => p.is_active).length})` : `All (${packages.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading packages...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-gray-500 mb-2 font-medium">No packages yet</p>
          <p className="text-sm text-gray-400 mb-6">
            Create training packages to assign to your clients
          </p>
          <button
            onClick={() => { setEditingPkg(null); setModalOpen(true); }}
            className="btn-primary"
          >
            + Create First Package
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(pkg => (
            <div
              key={pkg.id}
              className={`card p-5 flex flex-col gap-3 ${!pkg.is_active ? 'opacity-60' : ''}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{pkg.name}</h3>
                  {pkg.description && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{pkg.description}</p>
                  )}
                </div>
                {!pkg.is_active && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                    Inactive
                  </span>
                )}
              </div>

              {/* Type badge */}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full w-fit ${TYPE_COLORS[pkg.package_type]}`}>
                {TYPE_LABELS[pkg.package_type]}
              </span>

              {/* Rules */}
              <div className="bg-gray-50 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Rules</p>
                <p className="text-sm text-gray-700">{formatRules(pkg)}</p>
              </div>

              {/* Price */}
              {pkg.price && (
                <p className="text-lg font-bold text-gray-800">
                  {Number(pkg.price).toFixed(2)}{' '}
                  <span className="text-sm font-normal text-gray-500">{pkg.currency}</span>
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-1">
                <button
                  onClick={() => { setEditingPkg(pkg); setModalOpen(true); }}
                  className="flex-1 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(pkg)}
                  className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                    pkg.is_active
                      ? 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
                      : 'border-green-300 text-green-700 hover:bg-green-50'
                  }`}
                >
                  {pkg.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(pkg)}
                  className="py-1.5 px-3 text-sm rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <PackageModal
          pkg={editingPkg}
          onClose={() => { setModalOpen(false); setEditingPkg(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default PackagesPage;
