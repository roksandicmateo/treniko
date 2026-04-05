import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { progressService } from '../../services/trainingService';

const METRICS = [
  { key: 'maxWeight',   label: 'Max Weight', unit: 'kg',  desc: 'Heaviest working set' },
  { key: 'estOneRM',    label: 'Est. 1RM',   unit: 'kg',  desc: 'Epley formula (working sets)' },
  { key: 'totalVolume', label: 'Volume',     unit: 'kg',  desc: 'Sets × Reps × Weight' },
];

export default function StrengthProgress({ clientId }) {
  const { t } = useTranslation();
  const [data,             setData]             = useState({});
  const [loading,          setLoading]          = useState(true);
  const [selectedExercise, setSelectedExercise] = useState('');
  const [selectedMetric,   setSelectedMetric]   = useState('maxWeight');
  const [search,           setSearch]           = useState('');

  const load = useCallback(() => {
    setLoading(true);
    progressService.getStrength(clientId)
      .then((r) => {
        setData(r.data);
        const keys = Object.keys(r.data);
        if (keys.length > 0) setSelectedExercise(keys[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const exercises   = Object.keys(data).filter((n) =>
    n.toLowerCase().includes(search.toLowerCase())
  );
  const selected    = data[selectedExercise];
  const entries     = selected?.entries || [];
  const metricInfo  = METRICS.find((m) => m.key === selectedMetric);

  const chartData = entries.map((e) => ({
    date:        new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    maxWeight:   e.maxWeight,
    estOneRM:    parseFloat(e.estOneRM),
    totalVolume: e.totalVolume,
  }));

  // PR = highest value of selected metric across all sessions
  const prValue = entries.length > 0
    ? Math.max(...entries.map((e) => parseFloat(e[selectedMetric] || 0)))
    : null;
  const prEntry = entries.find((e) => parseFloat(e[selectedMetric] || 0) === prValue);

  const latestEntry = entries[entries.length - 1];
  const firstEntry  = entries[0];

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">{t('common.loading')}</div>;

  if (Object.keys(data).length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl py-16 text-center">
        <div className="text-4xl mb-3">🏋️</div>
        <p className="text-gray-500 font-medium mb-1">{t('progress.noStrengthData')}</p>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          {t('progress.strengthAutoTracked')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4">

      {/* ── Exercise sidebar ── */}
      <div className="w-44 flex-shrink-0">
        <input
          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs placeholder-gray-400 mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={t('common.search') + '…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {exercises.map((name) => {
            const ex      = data[name];
            const lastVal = ex.entries[ex.entries.length - 1]?.maxWeight;
            return (
              <button key={name} onClick={() => setSelectedExercise(name)}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  selectedExercise === name
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}>
                <div className="font-medium truncate">{name}</div>
                {lastVal != null && (
                  <div className={`text-xs mt-0.5 ${selectedExercise === name ? 'text-blue-200' : 'text-gray-400'}`}>
                    {lastVal} kg
                  </div>
                )}
              </button>
            );
          })}
          {exercises.length === 0 && (
            <p className="text-gray-400 text-xs px-2 pt-1">{t('common.noResults')}</p>
          )}
        </div>
      </div>

      {/* ── Main panel ── */}
      {selected && (
        <div className="flex-1 min-w-0 space-y-3">

          {/* Category + name */}
          <div className="flex items-center gap-2">
            {selected.category && (
              <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {selected.category}
              </span>
            )}
            <h3 className="font-semibold text-gray-900 text-sm">{selectedExercise}</h3>
          </div>

          {/* PR banner */}
          {prValue != null && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">
                  {t('prs.title')} · {metricInfo?.label}
                </p>
                <p className="font-bold text-amber-900 text-xl">
                  {parseFloat(prValue).toFixed(1)} {metricInfo?.unit}
                </p>
                {prEntry?.date && (
                  <p className="text-xs text-amber-500 mt-0.5">
                    {new Date(prEntry.date).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Metric selector */}
          <div className="flex gap-1.5 flex-wrap">
            {METRICS.map((m) => (
              <button key={m.key} onClick={() => setSelectedMetric(m.key)}
                title={m.desc}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedMetric === m.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t('progress.statSessions'), val: entries.length, unit: '' },
              { label: t('progress.first'), val: firstEntry  ? parseFloat(firstEntry[selectedMetric]).toFixed(1)  : '—', unit: metricInfo?.unit },
              { label: t('progress.latest'),  val: latestEntry ? parseFloat(latestEntry[selectedMetric]).toFixed(1) : '—', unit: metricInfo?.unit },
            ].map(({ label, val, unit }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-2.5 text-center">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-bold text-gray-800 text-sm">{val} <span className="font-normal text-gray-400 text-xs">{unit}</span></p>
              </div>
            ))}
          </div>

          {/* Chart */}
          {chartData.length > 1 ? (
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                    domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip
                    contentStyle={{ border: '1px solid #E5E7EB', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(v) => [`${parseFloat(v).toFixed(1)} ${metricInfo?.unit}`, metricInfo?.label]}
                  />
                  <Line type="monotone" dataKey={selectedMetric} stroke="#2563EB" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-blue-50 rounded-xl p-4 text-center text-sm text-blue-600">
  {t('progress.logMoreSessions')}
            </div>
          )}

          {/* Session-by-session table */}
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-400">
                  <th className="px-3 py-2 text-left font-medium">{t('common.date')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('progress.maxKg')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('prs.est1RM')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('progress.chartVolume')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('training.sets')}</th>
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((e) => (
                  <tr key={String(e.date)} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-600">
                      {new Date(e.date).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-gray-800">{e.maxWeight} kg</td>
                    <td className="px-3 py-2 text-right text-gray-600">{e.estOneRM} kg</td>
                    <td className="px-3 py-2 text-right text-gray-500">{e.totalVolume.toFixed(0)} kg</td>
                    <td className="px-3 py-2 text-right text-gray-500">{e.setCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 text-center">
  {t('progress.strengthFormula')}
          </p>
        </div>
      )}
    </div>
  );
}
