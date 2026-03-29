// frontend/src/pages/ProgressPage.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const token   = () => localStorage.getItem('token');

const COLORS = ['#0ea5e9','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
const MONTHS_OPTIONS = [
  { value: '1', label: '1M' },
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '1Y' },
];

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return `${date.getDate()}. ${date.toLocaleString('default', { month: 'short' })}`;
};

const fmtWeek = (d) => {
  if (!d) return '';
  return `${new Date(d).getDate()}. ${new Date(d).toLocaleString('default', { month: 'short' })}`;
};

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, unit, icon, color }) => (
  <div className={`rounded-2xl p-4 ${color}`}>
    <div className="text-2xl mb-1">{icon}</div>
    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value ?? '—'}<span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{unit}</span></p>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
  </div>
);

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{fmtDate(label)}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          {p.name}: <span className="text-gray-800 dark:text-gray-200">{p.value} {p.unit || 'kg'}</span>
        </p>
      ))}
    </div>
  );
};

export default function ProgressPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [clients,    setClients]    = useState([]);
  const [clientId,   setClientId]   = useState('');
  const [months,     setMonths]     = useState('6');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [selectedEx, setSelectedEx] = useState([]);  // exercise IDs to show on chart
  const [chartMode,  setChartMode]  = useState('weight'); // weight | volume

  // Load clients
  useEffect(() => {
    fetch(`${API_URL}/clients?isActive=true`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(d => {
        const list = d.clients || [];
        setClients(list);
        if (list.length > 0) setClientId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Load progress data when client or months changes
  const loadProgress = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/progress/client/${clientId}?months=${months}`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
        // Default: show top 3 exercises by data points
        const exCounts = json.exercises.map(e => ({
          id: e.id,
          count: json.strengthData.filter(s => s.exercise_id === e.id).length,
        })).sort((a, b) => b.count - a.count);
        setSelectedEx(exCounts.slice(0, 3).map(e => e.id));
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [clientId, months]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  // Build chart data: one row per unique date, columns per exercise
  const buildStrengthChartData = () => {
    if (!data) return [];
    const filtered = data.strengthData.filter(s => selectedEx.includes(s.exercise_id));
    const dates = [...new Set(filtered.map(s => s.session_date))].sort();
    return dates.map(date => {
      const row = { date };
      selectedEx.forEach(exId => {
        const ex = data.exercises.find(e => e.id === exId);
        const point = filtered.find(s => s.exercise_id === exId && s.session_date === date);
        if (ex && point) {
          row[ex.name] = chartMode === 'weight' ? point.max_weight : Math.round(point.volume);
        }
      });
      return row;
    });
  };

  const strengthChartData  = buildStrengthChartData();
  const selectedExercises  = data?.exercises.filter(e => selectedEx.includes(e.id)) || [];
  const stats              = data?.stats;
  const prs                = data?.personalRecords || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">📈 Progress</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track client strength & training habits</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Client selector */}
          <select value={clientId} onChange={e => setClientId(e.target.value)} className="input text-sm w-48">
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
            ))}
          </select>
          {/* Period selector */}
          <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl">
            {MONTHS_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setMonths(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  months === o.value
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">{t('common.loading')}</div>
      ) : !data ? (
        <div className="text-center py-24 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-gray-600 dark:text-gray-400 font-medium">No progress data yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Complete training sessions to see progress charts</p>
        </div>
      ) : clients.length === 0 ? (
        <div className="text-center py-24 text-gray-400 dark:text-gray-500">No clients found</div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Sessions" value={stats?.total_sessions} icon="📅" color="bg-blue-50 dark:bg-blue-900/20" />
            <StatCard label="Total Hours" value={stats?.total_hours} unit="h" icon="⏱️" color="bg-purple-50 dark:bg-purple-900/20" />
            <StatCard label="Total Sets" value={stats?.total_sets} icon="💪" color="bg-green-50 dark:bg-green-900/20" />
            <StatCard label="Exercises" value={stats?.unique_exercises} icon="🏋️" color="bg-orange-50 dark:bg-orange-900/20" />
          </div>

          {/* Strength chart */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Strength Progress</h2>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Max weight per session</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Chart mode toggle */}
                <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg">
                  {[['weight','Max Weight (kg)'],['volume','Volume (kg·reps)']].map(([mode, label]) => (
                    <button key={mode} onClick={() => setChartMode(mode)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        chartMode === mode ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Exercise filter pills */}
            {data.exercises.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {data.exercises.map((ex, i) => {
                  const isSelected = selectedEx.includes(ex.id);
                  return (
                    <button key={ex.id} onClick={() => setSelectedEx(prev =>
                      isSelected ? prev.filter(id => id !== ex.id) : [...prev, ex.id]
                    )}
                      className={`px-3 py-1 rounded-full text-xs font-medium border-2 transition-colors ${
                        isSelected ? 'border-transparent text-white' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-transparent'
                      }`}
                      style={isSelected ? { backgroundColor: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length] } : {}}>
                      {ex.name}
                    </button>
                  );
                })}
              </div>
            )}

            {strengthChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={strengthChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  {selectedExercises.map((ex, i) => (
                    <Line key={ex.id} type="monotone" dataKey={ex.name}
                      stroke={COLORS[i % COLORS.length]} strokeWidth={2.5}
                      dot={{ r: 4, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
                      activeDot={{ r: 6 }} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
                {data.exercises.length === 0
                  ? 'No weighted exercises logged yet'
                  : 'Select exercises above to view progress'}
              </div>
            )}
          </div>

          {/* Session frequency */}
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Session Frequency</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Sessions per week</p>
            {data.frequencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.frequencyData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="week_start" tickFormatter={fmtWeek} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val, name) => [val, name === 'session_count' ? 'Sessions' : 'Minutes']}
                    labelFormatter={fmtWeek}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontSize: '12px' }} />
                  <Bar dataKey="session_count" fill="#0ea5e9" radius={[6,6,0,0]} name="Sessions" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-sm">No sessions in this period</div>
            )}
          </div>

          {/* Personal records */}
          {prs.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">🏆 Personal Records</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {prs.map((pr, i) => (
                  <div key={pr.exercise_id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mb-1">{pr.exercise_name}</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{pr.max_weight}<span className="text-xs font-normal text-gray-400 ml-0.5">kg</span></p>
                    {pr.reps && <p className="text-xs text-gray-500 dark:text-gray-400">× {pr.reps} reps</p>}
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{fmtDate(pr.achieved_date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No data state */}
          {data.exercises.length === 0 && data.frequencyData.length === 0 && (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-gray-600 dark:text-gray-400 font-medium">No completed trainings yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Log and complete training sessions to see progress</p>
              <button onClick={() => navigate('/dashboard/trainings')} className="btn-primary mt-4">
                Go to Trainings
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
