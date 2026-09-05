// frontend/src/components/AssignPackageModal.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { formatMoney, localeFor } from '../utils/datetime';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TYPE_LABEL_KEYS = {
  session_based: 'packages.typeSessionBased',
  time_based:    'packages.typeTimeBased',
  unlimited:     'packages.typeUnlimited',
};

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'card', 'other'];

/**
 * Assigning a package.
 *
 * ── What this screen is for ──────────────────────────────────────────────────
 * It is where a deal gets recorded, and it used to record only half of one: the
 * template, a start date and a note. Two things the trainer had actually agreed
 * could not be entered at all.
 *
 *   the price      Individual rates are the rule in personal training — "35 for
 *                  you, because you come twice a week". The column exists on
 *                  client_packages and was always copied from the template, so
 *                  a trainer with individual pricing kept the real numbers
 *                  somewhere else, which is the spreadsheet this product is
 *                  meant to replace.
 *   the payment    Buying the block and starting it are one event to a trainer
 *                  and were two unrelated screens here.
 *                  `client_payments.client_package_id` has existed since
 *                  migration 020 and nothing ever wrote it.
 *
 * Both are optional and both default to the template, so the fast path — assign
 * the standard package, done — is still three taps.
 */
const AssignPackageModal = ({ clientName, onClose, onAssigned }) => {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  const navigate = useNavigate();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    // The local calendar date. `toISOString()` reports the UTC day, so a
    // package assigned at 01:00 in Zagreb used to start "yesterday".
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [notes, setNotes]   = useState('');
  const [price, setPrice]   = useState('');
  const [sessions, setSessions] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/packages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setPackages((d.packages || []).filter(p => p.is_active));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selectedPkg = packages.find(p => p.id === selected);

  // Choosing a template fills the deal in with its numbers; the trainer edits
  // from there rather than typing everything.
  const choose = (pkg) => {
    setSelected(pkg.id);
    setPrice(pkg.price != null ? String(pkg.price) : '');
    setSessions(pkg.total_sessions != null ? String(pkg.total_sessions) : '');
    setError('');
  };

  const handleAssign = async () => {
    if (!selected) { setError(t('packages.selectPackage')); return; }
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/clients/${onAssigned.clientId}/packages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: selected,
          startDate,
          notes,
          // Sent only when the trainer changed them, so the server keeps using
          // the template's own values otherwise.
          ...(price !== '' && Number(price) !== Number(selectedPkg?.price ?? NaN) ? { price } : {}),
          ...(sessions !== '' && Number(sessions) !== Number(selectedPkg?.total_sessions ?? NaN)
            ? { totalSessions: sessions } : {}),
          ...(markPaid ? { markPaid: true, paymentMethod, paymentAmount: price || undefined } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || t('common.error')); return; }
      onAssigned.onSuccess(data.package);
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const endsOn = selectedPkg?.duration_days
    ? new Date(new Date(startDate).getTime() + selectedPkg.duration_days * 86400000)
        .toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('packages.assignPackage')}
        className="bg-white dark:bg-gray-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('packages.assignPackage')}</h2>
            {clientName && (
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {t('packages.assignTo')} {clientName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="h-9 w-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-gray-500"
          >
            <Icon name="x" className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
          ) : packages.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t('packages.createFirst')}</p>
              <button onClick={() => navigate('/dashboard/packages')} className="btn-primary">
                {t('packages.goToPackages')}
              </button>
            </div>
          ) : (
            <>
              <fieldset>
                <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('packages.selectPackage')} *
                </legend>
                <div className="space-y-2">
                  {packages.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                        selected === p.id
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="package"
                        checked={selected === p.id}
                        onChange={() => choose(p)}
                        className="mt-1"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{p.name}</span>
                          {p.price != null && (
                            <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums flex-shrink-0">
                              {formatMoney(p.price, p.currency || 'EUR', locale)}
                            </span>
                          )}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {t(TYPE_LABEL_KEYS[p.package_type] || 'packages.typeSessionBased')}
                          {p.total_sessions ? ` · ${t('counts.session', { count: p.total_sessions })}` : ''}
                          {p.duration_days ? ` · ${t('counts.day', { count: p.duration_days })}` : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {selectedPkg && (
                <div className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-800 p-4 dark:border-gray-700">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="pkg-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {t('packages.priceForClient')}
                      </label>
                      <div className="relative">
                        <input
                          id="pkg-price"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={e => setPrice(e.target.value)}
                          className="input pr-12"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                          {selectedPkg.currency || 'EUR'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('packages.priceHint')}</p>
                    </div>

                    {selectedPkg.package_type === 'session_based' && (
                      <div>
                        <label htmlFor="pkg-sessions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {t('packages.sessionsForClient')}
                        </label>
                        <input
                          id="pkg-sessions"
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={sessions}
                          onChange={e => setSessions(e.target.value)}
                          className="input"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="pkg-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('packages.startDate')}
                    </label>
                    <input
                      id="pkg-start"
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="input"
                    />
                    {endsOn && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {t('packages.expires')}: <strong>{endsOn}</strong>
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 dark:bg-gray-800">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={markPaid}
                        onChange={e => setMarkPaid(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                          {t('packages.markPaid')}
                        </span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {t('packages.markPaidHint')}
                        </span>
                      </span>
                    </label>

                    {markPaid && (
                      <div className="mt-3 pl-7">
                        <label htmlFor="pkg-method" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          {t('packages.paymentMethod')}
                        </label>
                        <select
                          id="pkg-method"
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value)}
                          className="input"
                        >
                          {PAYMENT_METHODS.map(m => (
                            <option key={m} value={m}>{t(`billing.method.${m}`)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="pkg-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('common.notes')}
                    </label>
                    <input
                      id="pkg-notes"
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder={t('packages.notesPH')}
                      className="input"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <Icon name="alert" className="h-4 w-4 flex-shrink-0" />{error}
                </p>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 btn-secondary">
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={saving || !selected}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('packages.assignPackage')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignPackageModal;
