// frontend/src/pages/GroupDetail.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast';
import SessionModal from '../components/SessionModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-400' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
  no_show:   { label: 'No-show',   color: 'bg-red-100 text-red-600',     dot: 'bg-red-500' },
};

const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtT = (t) => t?.slice(0, 5) || '';

// ── Schedule Group Session Modal ──────────────────────────────────────────────
function ScheduleGroupSessionModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState({
    sessionDate: new Date().toISOString().split('T')[0],
    startTime: '09:00', endTime: '10:00',
    sessionType: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const sessionTypes = ['Strength Training', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 'Boxing', 'Consultation', 'Other'];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/groups/${group.id}/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to schedule'); return; }
      onSaved(data);
    } catch { setError('Failed to schedule session'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">Schedule Group Session</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Creates a session for all {group.members?.length || 0} members of <strong>{group.name}</strong>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.sessionDate}
              onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input type="time" value={form.startTime}
                onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input type="time" value={form.endTime}
                onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session Type</label>
            <select value={form.sessionType} onChange={e => setForm(f => ({ ...f, sessionType: e.target.value }))} className="input">
              <option value="">Select type (optional)</option>
              {sessionTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="input" placeholder="Session notes, workout plan..." />
          </div>

          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary disabled:opacity-50">
              {saving ? 'Scheduling...' : `Schedule for ${group.members?.length || 0} members`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Members Modal ─────────────────────────────────────────────────────────
function AddMembersModal({ groupId, existingIds, onClose, onAdded }) {
  const [clients,  setClients]  = useState([]);
  const [selected, setSelected] = useState([]);
  const [saving,   setSaving]   = useState(false);
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    fetch(`${API_URL}/clients`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => setClients((d.clients || []).filter(c => !existingIds.includes(c.id) && !c.is_archived && c.is_active)));
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
            <p className="text-sm text-gray-400 text-center py-8">No available clients</p>
          ) : filtered.map(c => (
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
          ))}
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

// ── Session History Row ───────────────────────────────────────────────────────
function GroupSessionRow({ session, onMemberClick, groupId, navigate }) {
  const [expanded, setExpanded] = useState(false);
  const attendanceRate = session.total_members > 0
    ? Math.round((session.completed / session.total_members) * 100)
    : 0;

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Session header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(e => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">
              {fmt(session.session_date)}
            </p>
            <span className="text-xs text-gray-400">
              {fmtT(session.start_time)} – {fmtT(session.end_time)}
            </span>
            {session.session_type && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {session.session_type}
              </span>
            )}
          </div>
          {/* Attendance bar */}
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-24">
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${attendanceRate}%` }} />
            </div>
            <span className="text-xs text-gray-500">
              {session.completed}/{session.total_members} attended
              {session.no_shows > 0 && ` · ${session.no_shows} no-show`}
              {session.scheduled > 0 && ` · ${session.scheduled} upcoming`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); navigate(`/dashboard/groups/${groupId}/sessions/${session.representative_id || session.id}`); }}
            className="text-xs text-blue-600 hover:underline font-medium">Open →</button>
          <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded member attendance */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60">
          {session.members?.map(m => {
            const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.scheduled;
            return (
              <div key={m.id}
                onClick={() => onMemberClick(m, session)}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer transition-colors">
                <div className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                  {m.first_name[0]}{m.last_name[0]}
                </div>
                <p className="flex-1 text-sm text-gray-700 font-medium">
                  {m.first_name} {m.last_name}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="text-xs text-blue-500 hover:underline flex-shrink-0">Edit →</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main GroupDetail ──────────────────────────────────────────────────────────
export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [group,        setGroup]        = useState(null);
  const [sessions,     setSessions]     = useState([]);
  const [monthStats,   setMonthStats]   = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [tab,          setTab]          = useState('sessions'); // sessions | members
  const [addMembersOpen,      setAddMembersOpen]      = useState(false);
  const [scheduleGroupOpen,   setScheduleGroupOpen]   = useState(false);
  const [sessionModal,        setSessionModal]        = useState(false);
  const [selectedSession,     setSelectedSession]     = useState(null);
  const [selectedDate,        setSelectedDate]        = useState(null);
  const [selectedClientId,    setSelectedClientId]    = useState(null);
  const [memberFeedOpen,      setMemberFeedOpen]      = useState(null); // clientId
  const [memberSessions,      setMemberSessions]      = useState([]);
  const [memberSessionsLoading, setMemberSessionsLoading] = useState(false);
  const [attendanceTarget,      setAttendanceTarget]      = useState(null);
  const [attendanceModalOpen,   setAttendanceModalOpen]   = useState(false);

  const loadGroup = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/groups/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (!res.ok) { navigate('/dashboard/groups'); return; }
      setGroup(data.group);
    } catch { navigate('/dashboard/groups'); }
  }, [id, navigate]);

  const loadSessions = useCallback(async () => {
    try {
      const res  = await fetch(`${API_URL}/groups/${id}/sessions`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      setSessions(data.sessions || []);
      setMonthStats(data.stats || null);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    Promise.all([loadGroup(), loadSessions()]).finally(() => setLoading(false));
  }, [loadGroup, loadSessions]);

  const loadMemberFeed = async (clientId) => {
    setMemberSessionsLoading(true);
    setMemberFeedOpen(clientId);
    try {
      const res  = await fetch(`${API_URL}/groups/${id}/members/${clientId}/feed?limit=20`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      setMemberSessions(data.sessions || []);
    } catch { /* ignore */ }
    finally { setMemberSessionsLoading(false); }
  };

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

  // Update member attendance status directly
  const handleMemberSessionClick = async (memberAttendance, groupSession) => {
    setAttendanceTarget({ memberAttendance, groupSession });
    setAttendanceModalOpen(true);
  };

  // Schedule individual session for a member
  const handleScheduleIndividual = (member) => {
    setSelectedSession(null);
    setSelectedClientId(member.id);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSessionModal(true);
  };

  const handleSessionSaved = () => {
    setSessionModal(false);
    setSelectedSession(null);
    loadSessions();
    if (memberFeedOpen) loadMemberFeed(memberFeedOpen);
  };

  const updateAttendance = async (status) => {
    if (!attendanceTarget) return;
    const { memberAttendance, groupSession } = attendanceTarget;
    try {
      await fetch(`${API_URL}/groups/${id}/sessions/${groupSession.id}/attendance/${memberAttendance.client_id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setAttendanceModalOpen(false);
      setAttendanceTarget(null);
      loadSessions();
      showToast('Attendance updated', 'success');
    } catch { showToast('Failed to update attendance', 'error'); }
  };

  const handleGroupSessionScheduled = (data) => {
    setScheduleGroupOpen(false);
    showToast(`Session scheduled for ${data.memberCount} members`, 'success');
    loadSessions();
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">Loading...</div>;
  if (!group)  return null;

  const existingMemberIds = group.members?.map(m => m.id) || [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => navigate('/dashboard/groups')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Groups</button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
            style={{ backgroundColor: group.color || '#0ea5e9' }}>
            {group.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
            <p className="text-xs text-gray-400">
              {group.members?.length || 0} members
              {group.description ? ` · ${group.description}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAddMembersOpen(true)}
            className="btn-secondary text-sm">+ Members</button>
          <button onClick={() => setScheduleGroupOpen(true)}
            className="btn-primary text-sm">📅 Schedule Group Session</button>
        </div>
      </div>

      {/* Stats bar */}
      {monthStats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{monthStats.sessions_this_month || 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Sessions this month</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{monthStats.total_completed || 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">Completed</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{monthStats.total_no_shows || 0}</p>
            <p className="text-xs text-gray-400 mt-0.5">No-shows</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['sessions', '📅 Sessions'], ['members', '👥 Members']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div>
          {sessions.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">📅</p>
              <p className="text-gray-600 font-medium mb-1">No sessions yet</p>
              <p className="text-sm text-gray-400 mb-5">Schedule a group session to start tracking attendance.</p>
              <button onClick={() => setScheduleGroupOpen(true)} className="btn-primary">
                Schedule First Session
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s, i) => (
                <GroupSessionRow
                  key={`${s.session_date}-${s.start_time}-${i}`}
                  session={s}
                  onMemberClick={handleMemberSessionClick}
                  groupId={id}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div>
          {group.members?.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-3xl mb-3">👥</p>
              <p className="text-gray-600 font-medium mb-1">No members yet</p>
              <button onClick={() => setAddMembersOpen(true)} className="btn-primary mt-4">Add Members</button>
            </div>
          ) : (
            <div className="space-y-2">
              {group.members.map(m => (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Member row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                      {m.first_name[0]}{m.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-gray-400">
                        {m.completed_sessions || 0} completed · {m.total_sessions || 0} total
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleScheduleIndividual(m)}
                        className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium transition-colors">
                        + Session
                      </button>
                      <button
                        onClick={() => memberFeedOpen === m.id ? setMemberFeedOpen(null) : loadMemberFeed(m.id)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                        {memberFeedOpen === m.id ? 'Hide ▲' : 'History ▼'}
                      </button>
                      <button onClick={() => navigate(`/dashboard/clients/${m.id}`)}
                        className="text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors">
                        Profile →
                      </button>
                      <button onClick={() => handleRemoveMember(m)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Collapsible session history */}
                  {memberFeedOpen === m.id && (
                    <div className="border-t border-gray-100 bg-gray-50/60">
                      {memberSessionsLoading ? (
                        <div className="text-xs text-gray-400 text-center py-4">Loading...</div>
                      ) : memberSessions.length === 0 ? (
                        <div className="text-xs text-gray-400 text-center py-4">No sessions yet</div>
                      ) : (
                        memberSessions.map(s => {
                          const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.scheduled;
                          return (
                            <div key={s.id}
                              onClick={() => {
                                setSelectedSession({
                                  id: s.id, clientId: m.id,
                                  sessionDate: s.session_date,
                                  startTime: s.start_time, endTime: s.end_time,
                                  sessionType: s.session_type, notes: s.notes,
                                  isCompleted: s.is_completed, status: s.status,
                                  clientName: `${m.first_name} ${m.last_name}`,
                                });
                                setSessionModal(true);
                              }}
                              className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 last:border-0 hover:bg-white cursor-pointer transition-colors">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                              <p className="flex-1 text-xs text-gray-600">
                                {fmt(s.session_date)} · {fmtT(s.start_time)}–{fmtT(s.end_time)}
                                {s.session_type ? ` · ${s.session_type}` : ''}
                                {s.group_id ? ' 👥' : ''}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {addMembersOpen && (
        <AddMembersModal groupId={id} existingIds={existingMemberIds}
          onClose={() => setAddMembersOpen(false)}
          onAdded={() => { setAddMembersOpen(false); loadGroup(); showToast('Members added', 'success'); }} />
      )}

      {/* Attendance update modal */}
      {attendanceModalOpen && attendanceTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Update Attendance</h3>
              <button onClick={() => setAttendanceModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              <strong>{attendanceTarget.memberAttendance.first_name} {attendanceTarget.memberAttendance.last_name}</strong>
              {' — '}{new Date(attendanceTarget.groupSession.session_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              {' '}{attendanceTarget.groupSession.start_time?.slice(0,5)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => updateAttendance('completed')}
                className="py-3 rounded-xl border-2 border-green-300 text-green-700 hover:bg-green-50 font-medium text-sm transition-colors">
                ✅ Completed
              </button>
              <button onClick={() => updateAttendance('no_show')}
                className="py-3 rounded-xl border-2 border-red-300 text-red-600 hover:bg-red-50 font-medium text-sm transition-colors">
                ❌ No-show
              </button>
              <button onClick={() => updateAttendance('cancelled')}
                className="py-3 rounded-xl border-2 border-gray-300 text-gray-500 hover:bg-gray-50 font-medium text-sm transition-colors">
                🚫 Cancelled
              </button>
              <button onClick={() => updateAttendance('scheduled')}
                className="py-3 rounded-xl border-2 border-blue-300 text-blue-600 hover:bg-blue-50 font-medium text-sm transition-colors">
                📅 Scheduled
              </button>
            </div>
          </div>
        </div>
      )}

      {scheduleGroupOpen && group.members?.length > 0 && (
        <ScheduleGroupSessionModal group={group} onClose={() => setScheduleGroupOpen(false)}
          onSaved={handleGroupSessionScheduled} />
      )}

      {sessionModal && (
        <SessionModal
          session={selectedSession}
          initialDate={selectedDate}
          initialTime={null}
          onClose={() => { setSessionModal(false); setSelectedSession(null); }}
          onSave={handleSessionSaved}
        />
      )}
    </div>
  );
}
