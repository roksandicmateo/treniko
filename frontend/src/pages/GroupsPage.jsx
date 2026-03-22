// frontend/src/pages/GroupsPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');

const GROUP_COLORS = [
  '#0ea5e9','#22c55e','#f59e0b','#ef4444',
  '#8b5cf6','#ec4899','#14b8a6','#f97316',
];

const GroupModal = ({ group, onClose, onSaved }) => {
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
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">{group ? 'Edit Group' : 'New Group'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input" placeholder="e.g. Morning HIIT, Monday Squad..." autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} className="input" placeholder="What is this group for?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {GROUP_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? 'Saving...' : group ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function GroupsPage() {
  const navigate = useNavigate();
  const [groups,      setGroups]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null);
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Groups</h1>
          <p className="text-sm text-gray-500 mt-1">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary">
          + New Group
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading groups...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-600 font-medium mb-1">No groups yet</p>
          <p className="text-sm text-gray-400 mb-5">Create groups to organise clients and manage group sessions.</p>
          <button onClick={() => setModalOpen(true)} className="btn-primary">Create Your First Group</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => (
            <div key={group.id}
              onClick={() => navigate(`/dashboard/groups/${group.id}`)}
              className="bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all group-card">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                    style={{ backgroundColor: group.color || '#0ea5e9' }}>
                    {group.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                    <p className="text-xs text-gray-400">
                      {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-card:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); setEditing(group); setModalOpen(true); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    ✏️
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm(group); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    🗑️
                  </button>
                </div>
              </div>
              {group.description && (
                <p className="text-sm text-gray-500 line-clamp-2">{group.description}</p>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Created {new Date(group.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-xs text-blue-600 font-medium">View →</span>
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
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Group?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Delete <strong>{deleteConfirm.name}</strong>? Members will not be deleted — only the group.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 btn-secondary">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 btn-danger">Delete Group</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
