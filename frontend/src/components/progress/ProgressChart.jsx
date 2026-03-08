import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { progressService } from '../../services/trainingService';
import AddProgressModal from './AddProgressModal';

export default function ProgressChart({ clientId }) {
  const [data,           setData]           = useState({});
  const [selectedMetric, setSelectedMetric] = useState('');
  const [loading,        setLoading]        = useState(true);
  const [showAdd,        setShowAdd]        = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    progressService.getForClient(clientId)
      .then((r) => {
        setData(r.data);
        const keys = Object.keys(r.data);
        if (keys.length > 0) {
          setSelectedMetric((prev) => (keys.includes(prev) ? prev : keys[0]));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const metrics = Object.keys(data);
  const entries = data[selectedMetric] || [];

  const chartData = entries.map((e) => ({
    date:  new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    value: parseFloat(e.value),
  }));

  const firstVal = chartData[0]?.value;
  const lastVal  = chartData[chartData.length - 1]?.value;
  const unit     = entries[0]?.unit || '';

  const diff       = firstVal != null && lastVal != null ? lastVal - firstVal : null;
  const diffStr    = diff != null ? (diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)) : null;
  const diffColor  = diff == null ? '' : diff >= 0 ? 'text-green-600' : 'text-red-600';
  const avgVal     = entries.length > 0
    ? (entries.reduce((s, e) => s + parseFloat(e.value), 0) / entries.length).toFixed(1)
    : null;

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">Loading progress data...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metric tabs + add button */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {metrics.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMetric(m)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedMetric === m
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m}
            </button>
          ))}
          {metrics.length === 0 && (
            <span className="text-gray-400 text-sm">No metrics tracked yet</span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          + Add Entry
        </button>
      </div>

      {/* Stats row */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">First</p>
            <p className="font-semibold text-gray-800">{firstVal} {unit}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">Latest</p>
            <p className="font-semibold text-gray-800">{lastVal} {unit}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">Change</p>
            <p className={`font-semibold ${diffColor}`}>{diffStr} {unit}</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 ? (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                domain={['dataMin - 1', 'dataMax + 1']}
              />
              <Tooltip
                contentStyle={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '12px',
                  fontSize: '13px',
                }}
                formatter={(v) => [`${v} ${unit}`, selectedMetric]}
              />
              {firstVal != null && (
                <ReferenceLine y={firstVal} stroke="#D1D5DB" strokeDasharray="4 4" />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563EB"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#2563EB', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : chartData.length === 1 ? (
        <div className="bg-blue-50 rounded-xl p-4 text-center text-sm text-blue-600">
          Add more entries to see a chart. Currently 1 data point.
        </div>
      ) : (
        <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center">
          <p className="text-gray-400 text-sm">No progress entries yet for <strong>{selectedMetric}</strong></p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 text-blue-600 text-sm hover:underline"
          >
            Add first entry →
          </button>
        </div>
      )}

      {/* History table */}
      {entries.length > 0 && (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-xs">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((e, i, arr) => {
                const prevVal = arr[i + 1]?.value;
                const change  = prevVal != null ? (parseFloat(e.value) - parseFloat(prevVal)).toFixed(1) : null;
                const isPos   = change != null && parseFloat(change) > 0;
                return (
                  <tr key={e.id} className="border-t border-gray-50">
                    <td className="px-4 py-2.5 text-gray-600">
                      {new Date(e.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-800">
                      {e.value} {e.unit}
                    </td>
                    <td className={`px-4 py-2.5 text-right text-xs ${change == null ? 'text-gray-300' : isPos ? 'text-green-600' : 'text-red-500'}`}>
                      {change == null ? '—' : isPos ? `+${change}` : change}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddProgressModal
          clientId={clientId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}
