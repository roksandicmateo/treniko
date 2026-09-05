import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { formatShortDate, localeFor } from '../utils/datetime';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Correcting a package by hand, and seeing why the balance is what it is.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Trainers make deals and mistakes: "he was ill, give him that one back",
 * "we did two extra last week, put them on". Neither could be expressed. The
 * balance moved only through session status, so the only way to correct it was
 * to invent or delete a session in the calendar — corrupting the training
 * history to fix a number.
 *
 * An adjustment is a row in the same ledger every charge goes to
 * (`package_session_usage`, migration 037), with a reason and an author, and
 * `sessions_used` is recomputed from that ledger. So the balance still equals
 * the sum of its explanations, and the history below IS those explanations.
 */
export default function PackageAdjustPanel({ clientId, clientPackage, onChanged }) {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);

  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(null);
  const [direction, setDirection] = useState('give_back');
  const [amount, setAmount] = useState('1');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('token');

  const loadLedger = async () => {
    try {
      const res = await fetch(
        `${API_URL}/clients/${clientId}/packages/${clientPackage.id}/ledger`,
        { headers: { Authorization: `Bearer ${token()}` } }
      );
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && entries === null) loadLedger();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const count = Number.parseInt(amount, 10);
    if (!Number.isInteger(count) || count < 1) { setError(t('packages.adjustAmount')); return; }
    if (reason.trim().length < 3) { setError(t('packages.adjustReason')); return; }

    setSaving(true);
    try {
      const res = await fetch(
        `${API_URL}/clients/${clientId}/packages/${clientPackage.id}/adjust`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Giving sessions back is a credit, so it is negative on the ledger.
            quantity: direction === 'give_back' ? -count : count,
            reason: reason.trim(),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.error || t('common.error')); return; }

      setReason('');
      setAmount('1');
      await loadLedger();
      onChanged?.();
    } catch {
      setError(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const labelFor = (entry) => {
    if (entry.kind === 'session') return t('packages.entrySession');
    if (entry.kind === 'group_session') return t('packages.entryGroupSession');
    return t('packages.entryAdjustment');
  };

  return (
    <div className="mt-3 border-t border-gray-200 dark:border-gray-700 pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded"
      >
        <Icon name="chevronD" className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
        {t('packages.adjust')} · {t('packages.ledger')}
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <form onSubmit={submit} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3 space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('packages.adjustHint')}</p>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'give_back', label: t('packages.adjustGiveBack') },
                { key: 'take_off',  label: t('packages.adjustAdd') },
              ].map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setDirection(option.key)}
                  aria-pressed={direction === option.key}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    direction === option.key
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="w-24">
                <label htmlFor={`adj-amount-${clientPackage.id}`} className="sr-only">
                  {t('packages.adjustAmount')}
                </label>
                <input
                  id={`adj-amount-${clientPackage.id}`}
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label htmlFor={`adj-reason-${clientPackage.id}`} className="sr-only">
                  {t('packages.adjustReason')}
                </label>
                <input
                  id={`adj-reason-${clientPackage.id}`}
                  type="text"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={t('packages.adjustReasonPH')}
                  className="input"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}

            <button type="submit" disabled={saving} className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </form>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
              {t('packages.ledger')}
            </h5>
            {entries === null ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('common.loading')}</p>
            ) : entries.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">{t('packages.noSessionsYet')}</p>
            ) : (
              <ul className="space-y-1">
                {entries.map(entry => (
                  <li key={entry.id} className="flex items-baseline gap-2 text-xs">
                    <span className={`font-semibold tabular-nums w-8 flex-shrink-0 ${
                      entry.quantity < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {entry.quantity > 0 ? `−${entry.quantity}` : `+${Math.abs(entry.quantity)}`}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 flex-1 min-w-0 truncate">
                      {labelFor(entry)}{entry.reason ? ` · ${entry.reason}` : ''}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                      {formatShortDate(entry.used_at, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
