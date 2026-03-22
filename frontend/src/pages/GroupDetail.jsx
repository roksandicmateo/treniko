// frontend/src/pages/GroupDetail.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast';
import SessionModal from '../components/SessionModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');

const STATUS_CONFIG = {
  scheduled:  { label: 'Scheduled',  color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  completed:  { label: 'Completed',  color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled:  { label: 'Cancelled',  color: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
  no_show:    { label: 'No-show',    color: 'bg-red-100 text-red-600',     dot: 'bg-red-500' },
};

// ── Add Members Modal ─────────────────────────────────────────────────────────
function AddMembersModal({ groupId, existingIds, onClose, onAdded }) {
  const [clients,  setClients]  = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    fetch(`${API_URL}/clients?isActive=true`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setClients((d.clients || []).filter(c => !existingIds.includes(c.id) && !c.is_archived)));
  }, [existingIds]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleAdd = async () => {
    if (selected.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(selected.map(clientId =>
        fetch(`${API_URL}/groups/${groupId}/members`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        })
      ));
      onAdded();
    } catch { showToast('Failed to add members', 'error'); }
    finally { setSaving(false); }
  };

  const filtered = clients.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Add Members</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search clients..." className="input mb-3" autoFocus />

        <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              {clients.length === 0 ? 'All active clients are already in this group' : 'No clients match your search'}
            </p>
          ) : (
            filtered.map(c => (
              <button key={c.id} type="button" onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                  selected.includes(c.id) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  selected.includes(c.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {selected.includes(c.id) ? '✓' : `${c.first_name[0]}${c.last_name[0]}`}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.first_name} {c.last_name}</p>
                  {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex gap-3 pt-4 mt-4 border-t border-gray-100">
          <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
          <button onClick={handleAdd} disabled={saving || selected.length === 0}
            className="flex-1 btn-primary disabled:opacity-50">
            {saving ? 'Adding...' : `Add ${selected.length > 0 ? `(${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member Session Feed ───────────────────────────────────────────────────────
function MemberFeed({ groupId, member, onSessionClick, onSchedule }) {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/groups/${groupId}/members/${member.id}/feed?limit=10`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [groupId, member.id]);

  useEffect(() => { load(); }, [load]);

  const upcoming = sessions.filter(s => s.status === 'scheduled' && new Date(s.session_date) >= new Date());
  const past     = sessions.filter(s => s.status !== 'scheduled' || new Date(s.session_date) < new Date());

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Member header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
            {member.first_name[0]}{member.last_name[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{member.first_name} {member.last_name}</p>
            <p className="text-xs text-gray-400">
              {member.completed_sessions || 0} completed · {member.total_sessions || 0} total
            </p>
          </div>
        </div>
        <button onClick={() => onSchedule(member)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors">
          + Session
        </button>
      </div>

      {/* Sessions */}
      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="text-xs text-gray-400 text-center py-6">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-gray-400 mb-2">No sessions yet</p>
            <button onClick={() => onSchedule(member)}
              className="text-xs text-blue-600 hover:underline">Schedule first session →</button>
          </div>
        ) : (
          [...upcoming, ...past].slice(0, 8).map(s => {
            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
            return (
              <div key={s.id} onClick={() => onSessionClick(s, member)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {new Date(s.session_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' · '}{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                  </p>
                  {s.session_type && <p className="text-xs text-gray-400 truncate">{s.session_type}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main GroupDetail ──────────────────────────────────────────────────────────
export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group,          setGroup]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [sessionModal,   setSessionModal]   = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDate,    setSessionDate]    = useState(null);
  const [sessionClientId, setSessionClientId] = useState(null);
  const [feedRefresh,    setFeedRefresh]    = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/groups/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (!res.ok) { navigate('/dashboard/groups'); return; }
      setGroup(data.group);
    } catch { navigate('/dashboard/groups'); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const handleRemoveMember = async (member) => {
    if (!window.confirm(`Remove ${member.first_name} ${member.last_name} from this group?`)) return;
    try {
      await fetch(`${API_URL}/groups/${id}/members/${member.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
      });
      setGroup(g => ({ ...g, members: g.members.filter(m => m.id !== member.id) }));
      showToast('Member removed', 'success');
    } catch { showToast('Failed to remove member', 'error'); }
  };

  const handleScheduleForMember = (member) => {
    setSelectedSession(null);
    setSessionClientId(member.id);
    setSessionDate(new Date().toISOString().split('T')[0]);
    setSessionModal(true);
  };

  const handleSessionClick = (session, member) => {
    setSelectedSession({
      id:          session.id,
      clientId:    member.id,
      sessionDate: session.session_date,
      startTime:   session.start_time,
      endTime:     session.end_time,
      sessionType: session.session_type,
      notes:       session.notes,
      isCompleted: session.is_completed,
      status:      session.status,
      clientName:  `${member.first_name} ${member.last_name}`,
    });
    setSessionModal(true);
  };

  const handleSessionSaved = () => {
    setSessionModal(false);
    setSelectedSession(null);
    setFeedRefresh(n => n + 1);
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">Loading...</div>;
  if (!group)  return null;

  const existingMemberIds = group.members?.map(m => m.id) || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard/groups')}
            className="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">
            ← Groups
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
              style={{ backgroundColor: group.color || '#0ea5e9' }}>
              {group.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
              <p className="text-sm text-gray-500">
                {group.members?.length || 0} member{(group.members?.length || 0) !== 1 ? 's' : ''}
                {group.description ? ` · ${group.description}` : ''}
              </p>
            </div>
          </div>
        </div>
        <button onClick={() => setAddMembersOpen(true)} className="btn-primary flex-shrink-0">
          + Add Members
        </button>
      </div>

      {/* Members grid */}
      {group.members?.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-600 font-medium mb-1">No members yet</p>
          <p className="text-sm text-gray-400 mb-5">Add clients to this group to start scheduling group sessions.</p>
          <button onClick={() => setAddMembersOpen(true)} className="btn-primary">Add First Member</button>
        </div>
      ) : (
        <div>
          {/* Member chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {group.members.map(m => (
              <div key={m.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-1.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                  {m.first_name[0]}
                </div>
                <span className="text-sm text-gray-700 font-medium">{m.first_name} {m.last_name}</span>
                <button onClick={() => handleRemoveMember(m)}
                  className="text-gray-300 hover:text-red-500 transition-colors text-sm leading-none ml-1">×</button>
              </div>
            ))}
          </div>

          {/* Member feeds */}
          <div className="grid sm:grid-cols-2 gap-4">
            {group.members.map(m => (
              <MemberFeed
                key={`${m.id}-${feedRefresh}`}
                groupId={id}
                member={m}
                onSessionClick={handleSessionClick}
                onSchedule={handleScheduleForMember}
              />
            ))}
          </div>
        </div>
      )}

      {/* Add members modal */}
      {addMembersOpen && (
        <AddMembersModal
          groupId={id}
          existingIds={existingMemberIds}
          onClose={() => setAddMembersOpen(false)}
          onAdded={() => { setAddMembersOpen(false); load(); showToast('Members added', 'success'); }}
        />
      )}

      {/* Session modal */}
      {sessionModal && (
        <SessionModal
          session={selectedSession}
          initialDate={sessionDate}
          initialTime={null}
          initialClientId={sessionClientId}
          onClose={() => { setSessionModal(false); setSelectedSession(null); }}
          onSave={handleSessionSaved}
        />
      )}
    </div>
  );
}
