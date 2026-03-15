// frontend/src/components/progress/PRSummary.jsx  (NEW FILE)
import { useState, useEffect, useCallback } from 'react';
import { progressService } from '../../services/trainingService';

const ESTIMATE_1RM = (weight, reps) => {
  if (!weight || !reps || reps <= 0) return null;
  return parseFloat((weight * (1 + Math.min(reps, 30) / 30.0)).toFixed(1));
};

export default function PRSummary({ clientId }) {
  const [data,    setData]    = useState({});
  const [loading, setLoading] = useState(true);
  const [sortBy,  setSortBy]  = useState('exercise'); // exercise | date | weight

  const load = useCallback(() => {
    setLoading(true);
    progressService.getStrength(clientId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">Loading PRs...</div>;

  if (Object.keys(data).length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-xl py-16 text-center">
        <div className="text-4xl mb-3">🏆</div>
        <p className="text-gray-500 font-medium mb-1">No PRs yet</p>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          PRs are automatically tracked when you log weighted exercises.
        </p>
      </div>
    );
  }

  // Build PR list — one entry per exercise
  const prs = Object.entries(data).map(([name, ex]) => {
    const entries = ex.entries || [];
    const maxWeightEntry = entries.reduce((best, e) =>
      e.maxWeight > (best?.maxWeight ?? 0) ? e : best, null
    );
    const best1RMEntry = entries.reduce((best, e) => {
      const rm = parseFloat(e.estOneRM);
      return rm > (parseFloat(best?.estOneRM) ?? 0) ? e : best;
    }, null);
    const maxVolumeEntry = entries.reduce((best, e) =>
      e.totalVolume > (best?.totalVolume ?? 0) ? e : best, null
    );

    return {
      name,
      category:    ex.category,
      sessions:    entries.length,
      maxWeight:   maxWeightEntry?.maxWeight,
      maxWeightDate: maxWeightEntry?.date,
      best1RM:     best1RMEntry ? parseFloat(best1RMEntry.estOneRM) : null,
      best1RMDate: best1RMEntry?.date,
      maxVolume:   maxVolumeEntry?.totalVolume,
      lastTrained: entries[entries.length - 1]?.date,
    };
  });

  // Sort
  const sorted = [...prs].sort((a, b) => {
    if (sortBy === 'weight') return (b.maxWeight ?? 0) - (a.maxWeight ?? 0);
    if (sortBy === 'date')   return new Date(b.lastTrained) - new Date(a.lastTrained);
    return a.name.localeCompare(b.name);
  });

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Personal Records</h3>
          <p className="text-xs text-gray-400 mt-0.5">{prs.length} exercise{prs.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {[['exercise', 'A–Z'], ['weight', 'Weight'], ['date', 'Recent']].map(([val, label]) => (
            <button key={val} onClick={() => setSortBy(val)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                sortBy === val ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PR cards */}
      <div className="space-y-2">
        {sorted.map(pr => (
          <div key={pr.name} className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">🏆</span>
                  <p className="font-semibold text-gray-900 truncate">{pr.name}</p>
                  {pr.category && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">
                      {pr.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 ml-6">
                  {pr.sessions} session{pr.sessions !== 1 ? 's' : ''} · Last: {formatDate(pr.lastTrained)}
                </p>
              </div>

              {/* PR values */}
              <div className="flex gap-4 flex-shrink-0 text-right">
                {pr.maxWeight != null && (
                  <div>
                    <p className="text-lg font-bold text-gray-900">{pr.maxWeight} <span className="text-xs font-normal text-gray-400">kg</span></p>
                    <p className="text-xs text-gray-400">Max Weight</p>
                    <p className="text-xs text-gray-300">{formatDate(pr.maxWeightDate)}</p>
                  </div>
                )}
                {pr.best1RM != null && (
                  <div>
                    <p className="text-lg font-bold text-blue-600">{pr.best1RM} <span className="text-xs font-normal text-gray-400">kg</span></p>
                    <p className="text-xs text-gray-400">Est. 1RM</p>
                    <p className="text-xs text-gray-300">{formatDate(pr.best1RMDate)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center">
        PRs use working sets only · 1RM estimated via Epley formula
      </p>
    </div>
  );
}
