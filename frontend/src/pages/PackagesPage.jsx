import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import PackageModal from '../components/PackageModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TYPE_COLORS = {
  session_based: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  time_based:    'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  unlimited:     'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400',
};

const PackagesPage = () => {
  const { t } = useTranslation();
  const [packages, setPackages] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState(null);
  const [filter, setFilter] = useState('active');

  const token = () => localStorage.getItem('token');

  const TYPE_LABELS = {
    session_based: `🎯 ${t('packages.sessionBased')}`,
    time_based:    `📅 ${t('packages.timeBased')}`,
    unlimited:     `♾️ ${t('packages.unlimited')}`,
  };

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/packages`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setPackages(data.packages || []);
    } catch { } finally { setLoading(false); }
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
    if (!window.confirm(`Delete "${pkg.name}"?`)) return;
    const res = await fetch(`${API_URL}/packages/${pkg.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    const data = await res.json();
    if (data.error) { alert(data.error); } else { load(); }
  };

  const handleSaved = () => { setModalOpen(false); setEditingPkg(null); load(); };

  const filtered = filter === 'active' ? packages.filter(p => p.is_active) : packages;

  const formatRules = (pkg) => {
    const parts = [];
    if (pkg.total_sessions) parts.push(`${pkg.total_sessions} ${t('packages.sessions')}`);
    if (pkg.duration_days)  parts.push(`${pkg.duration_days} days`);
    if (pkg.sessions_per_period && pkg.period_days) parts.push(`${pkg.sessions_per_period} per ${pkg.period_days} days`);
    return parts.join(' · ') || '—';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('packages.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('packages.subtitle')}</p>
        </div>
        <button onClick={() => { setEditingPkg(null); setModalOpen(true); }} className="btn-primary">
          {t('packages.newPackage')}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit mb-6">
        {[
          { key: 'active', label: `${t('packages.active')} (${packages.filter(p => p.is_active).length})` },
          { key: 'all',    label: `${t('common.all')} (${packages.length})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">{t('common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl text-center py-16">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-gray-500 dark:text-gray-400 mb-2 font-medium">{t('packages.noPackages')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Create training packages to assign to your clients</p>
          <button onClick={() => { setEditingPkg(null); setModalOpen(true); }} className="btn-primary">
            {t('packages.newPackage')}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(pkg => (
            <div key={pkg.id} className={`bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-3 ${!pkg.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{pkg.name}</h3>
                  {pkg.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{pkg.description}</p>}
                </div>
                {!pkg.is_active && (
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full flex-shrink-0">
                    Inactive
                  </span>
                )}
              </div>

              <span className={`text-xs font-medium px-2.5 py-1 rounded-full w-fit ${TYPE_COLORS[pkg.package_type]}`}>
                {TYPE_LABELS[pkg.package_type]}
              </span>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{t('packages.rules')}</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{formatRules(pkg)}</p>
              </div>

              {pkg.price && (
                <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                  {Number(pkg.price).toFixed(2)}{' '}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">{pkg.currency}</span>
                </p>
              )}

              <div className="flex gap-2 mt-auto pt-1">
                <button onClick={() => { setEditingPkg(pkg); setModalOpen(true); }}
                  className="flex-1 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {t('packages.edit')}
                </button>
                <button onClick={() => handleToggleActive(pkg)}
                  className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${
                    pkg.is_active
                      ? 'border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                      : 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                  }`}>
                  {pkg.is_active ? t('packages.deactivate') : t('packages.activate')}
                </button>
                <button onClick={() => handleDelete(pkg)}
                  className="py-1.5 px-3 text-sm rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <PackageModal pkg={editingPkg}
          onClose={() => { setModalOpen(false); setEditingPkg(null); }}
          onSaved={handleSaved} />
      )}
    </div>
  );
};

export default PackagesPage;
