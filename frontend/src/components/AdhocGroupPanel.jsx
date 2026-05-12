import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');
const hdr     = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

const STATUS_CONFIG = {
  scheduled: { label: 'Zakazano',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  completed: { label: 'Prisutan',  color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  no_show:   { label: 'Nije došao', color: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' },
  cancelled: { label: 'Otkazano',  color: 'bg-gray-100 text-gray-500' },
};

export default function AdhocGroupPanel({ sessionId, tenantId }) {
  const { t } = useTranslation();
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading]     = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/sessions/${sessionId}/attendees`, { headers: hdr() });
      const d = await r.json();
      setAttendees(d.attendees || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [sessionId]);

  const toggle = async (clientId, current) => {
    const next = current === 'completed' ? 'scheduled' : 'completed';
    setAttendees(prev => prev.map(a => a.client_id === clientId ? { ...a, status: next } : a));
    await fetch(`${API_URL}/sessions/${sessionId}/attendees/${clientId}`, {
      method: 'PUT', headers: hdr(), body: JSON.stringify({ status: next })
    }).catch(() => load());
  };

  if (loading) return <p className="text-xs text-gray-400 py-2">{t('common.loading')}</p>;
  if (attendees.length === 0) return <p className="text-xs text-gray-400 py-2">Nema sudionika</p>;

  const present = attendees.filter(a => a.status === 'completed').length;

  return (
    <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Sudionici</p>
        <span className="text-xs text-gray-400">{present}/{attendees.length} prisutnih</span>
      </div>
      <div className="space-y-1.5">
        {attendees.map(a => {
          const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.scheduled;
          return (
            <div key={a.client_id}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              onClick={() => toggle(a.client_id, a.status)}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${a.status === 'completed' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <p className="flex-1 text-sm text-gray-700 dark:text-gray-300">{a.first_name} {a.last_name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
