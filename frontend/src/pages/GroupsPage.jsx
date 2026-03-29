// frontend/src/pages/GroupsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');

const GROUP_COLORS = [
  '#0ea5e9','#22c55e','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#14b8a6','#f97316',
];

const GroupModal = ({ group, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name:        group?.name        || '',
    description: group?.description || '',
    color:       group?.color       || '#0ea5e9',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const url    = group ? `${API_URL}/groups/${group.id}` : `${API_URL}/groups`;
      const method = group ? 'PUT' : 'POST';
      const res  = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save'); return; }
      onSaved(data.group);
    } catch { setError('Failed to save group'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {group ? t('common.edit') : t('groups.addGroup').replace('+ ', '')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.name')} *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="e.g. Morning HIIT..." autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('form.description')} <span className="text-gray-400 font-normal">({t('common.optional')})</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="input" placeholder="What is this group for?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('form.color')}</label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 btn-secondary">{t('common.cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? t('common.saving') : group ? t('profile.saveChanges') : t('groups.addGroup').replace('+ ', '')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GroupsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [groups,        setGroups]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modalOpen,     setModalOpen]     = useState(false);
  const [editing,       setEditing]       = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/groups`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setGroups(data.groups || []);
    } catch { showToast('Failed to load groups', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved) => {
    setGroups(prev => {
      const idx = prev.findIndex(g => g.id === saved.id);
      return idx >= 0 ? prev.map((g, i) => i === idx ? saved : g) : [...prev, saved];
    });
    setModalOpen(false);
    setEditing(null);
    showToast(editing ? 'Group updated' : 'Group created', 'success');
  };

  const handleDelete = async (group) => {
    try {
      const res = await fetch(`${API_URL}/groups/${group.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
      });
      if (!res.ok) { showToast('Failed to delete group', 'error'); return; }
      setGroups(prev => prev.filter(g => g.id !== group.id));
      showToast('Group deleted', 'success');
    } catch { showToast('Failed to delete', 'error'); }
    finally { setDeleteConfirm(null); }
  };

  const locale = i18n.language === 'hr' ? 'hr-HR' : i18n.language === 'de' ? 'de-DE' : 'en-GB';

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{t('groups.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {groups.length} {groups.length === 1 ? t('groups.group') : t('groups.title').toLowerCase()}
          </p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
          {t('groups.addGroup')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">{t('common.loading')}</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">{t('groups.noGroups')}</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5">Create groups to organise clients and manage group sessions.</p>
          <button onClick={() => setModalOpen(true)} className="btn-primary">{t('groups.addFirst')}</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <div key={group.id}
              onClick={() => navigate(`/dashboard/groups/${group.id}`)}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: group.color || '#0ea5e9' }}>
                    {group.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{group.name}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {group.member_count} {t('groups.members')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); setEditing(group); setModalOpen(true); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    ✏️
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(group); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    🗑️
                  </button>
                </div>
              </div>
              {group.description && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{group.description}</p>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {t('groups.created')} {new Date(group.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-xs text-primary-500 font-medium">{t('groups.view')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <GroupModal group={editing} onClose={() => { setModalOpen(false); setEditing(null); }} onSaved={handleSaved} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full p-6 border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{t('common.delete')}?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              {t('groups.deleteConfirm')}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-secondary">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 btn-danger">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
