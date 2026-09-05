import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { formatDayLabel, formatTime, formatMoney, localeFor } from '../utils/datetime';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * "What do I have to deal with?"
 *
 * ── Why this is the top of the dashboard ─────────────────────────────────────
 * The screen used to open with four counters — active clients, sessions today,
 * completed this month, active packages — and none of them changes a decision.
 * Meanwhile three things the trainer actually has to act on were nowhere in the
 * product at all: who owes money (the endpoint existed and no screen called
 * it), who has gone quiet (the column existed and nothing read it), and which
 * past sessions are still unmarked.
 *
 * That last one comes first on purpose. Every package balance and every figure
 * on this screen is computed from session status, so an unmarked session from
 * last Tuesday makes everything else quietly wrong. Marking it is one tap here
 * rather than a trip to the calendar.
 */

const Group = ({ icon, tone, title, hint, count, children }) => {
  const [open, setOpen] = useState(true);
  const tones = {
    critical: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900',
    warning:  'text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
    neutral:  'text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700',
  };

  return (
    <div className={`rounded-xl border ${tones[tone]}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl"
      >
        <Icon name={icon} className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {hint && <span className="block text-xs opacity-80 mt-0.5">{hint}</span>}
        </span>
        <span className="text-sm font-bold tabular-nums flex-shrink-0">{count}</span>
        <Icon name="chevronD" className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-2 pb-2 space-y-1">{children}</div>}
    </div>
  );
};

const Row = ({ onClick, primary, secondary, trailing, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={ariaLabel}
    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left bg-white/70 dark:bg-gray-900/50 hover:bg-white dark:hover:bg-gray-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
  >
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{primary}</span>
      <span className="block text-xs text-gray-500 dark:text-gray-400 truncate tabular-nums">{secondary}</span>
    </span>
    {trailing}
  </button>
);

export default function AttentionPanel({ attention, onSessionClick, onChanged }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = localeFor(i18n.language);
  const [busyId, setBusyId] = useState(null);

  if (!attention) return null;

  const {
    unmarkedSessions = [], unpaidPayments = [], expiringPackages = [], quietClients = [],
    unpaidTotal = 0, unpaidCurrency = 'EUR', inactiveDays = 21, total = 0,
  } = attention;

  if (total === 0) {
    return (
      <section className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-4 flex items-center gap-3">
        <Icon name="check" className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{t('attention.allClear')}</p>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">{t('attention.allClearHint')}</p>
        </div>
      </section>
    );
  }

  /**
   * Mark a past session complete from here.
   *
   * The whole point of surfacing unmarked sessions is that clearing them is
   * cheap. Sending the trainer to the calendar to do it would leave the list
   * exactly as full as it was.
   */
  const markComplete = async (session) => {
    setBusyId(session.id);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/sessions/${session.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section
      aria-label={t('attention.title')}
      className="rounded-2xl border-2 border-gray-900 dark:border-gray-100 bg-white dark:bg-gray-900 p-4 sm:p-5"
    >
      <header className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('attention.title')}</h2>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t('attention.itemsToHandle', { count: total })}
        </span>
      </header>

      <div className="space-y-2.5">
        {unmarkedSessions.length > 0 && (
          <Group
            icon="clock" tone="critical" count={unmarkedSessions.length}
            title={t('attention.unmarked')} hint={t('attention.unmarkedHint')}
          >
            {unmarkedSessions.map(s => (
              <Row
                key={s.id}
                onClick={() => onSessionClick(s)}
                primary={s.is_group ? (s.group_title || t('sessions.adhocGroup')) : `${s.first_name} ${s.last_name}`}
                secondary={`${formatDayLabel(s.session_date, locale, t)} · ${formatTime(s.start_time)}`}
                trailing={
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); markComplete(s); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); markComplete(s); }
                    }}
                    className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 disabled:opacity-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    {busyId === s.id
                      ? <Icon name="refresh" className="h-3.5 w-3.5 animate-spin" />
                      : <Icon name="check" className="h-3.5 w-3.5" />}
                    {t('attention.markSession')}
                  </span>
                }
              />
            ))}
          </Group>
        )}

        {unpaidPayments.length > 0 && (
          <Group
            icon="money" tone="warning" count={unpaidPayments.length}
            title={t('attention.unpaid')}
            hint={`${t('attention.unpaidHint')} ${formatMoney(unpaidTotal, unpaidCurrency, locale)}`}
          >
            {unpaidPayments.map(p => (
              <Row
                key={p.id}
                onClick={() => navigate(`/dashboard/clients/${p.client_id}`)}
                primary={`${p.first_name} ${p.last_name}`}
                secondary={t('attention.unpaidDays', { count: Number(p.days_outstanding) || 0 })}
                trailing={
                  <span className="text-sm font-semibold text-amber-800 dark:text-amber-300 tabular-nums flex-shrink-0">
                    {formatMoney(p.amount, p.currency, locale)}
                  </span>
                }
              />
            ))}
          </Group>
        )}

        {expiringPackages.length > 0 && (
          <Group
            icon="packages" tone="warning" count={expiringPackages.length}
            title={t('attention.expiring')}
          >
            {expiringPackages.map(cp => {
              const left = cp.total_sessions != null ? cp.total_sessions - cp.sessions_used : null;
              const days = cp.days_left != null ? Number(cp.days_left) : null;
              return (
                <Row
                  key={cp.id}
                  onClick={() => navigate(`/dashboard/clients/${cp.client_id}`)}
                  primary={`${cp.first_name} ${cp.last_name}`}
                  secondary={cp.package_name}
                  trailing={
                    <span className="text-right flex-shrink-0">
                      {left !== null && (
                        <span className="block text-xs font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
                          {t('counts.sessionLeft', { count: left })}
                        </span>
                      )}
                      {days !== null && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {days <= 0 ? t('packages.expiresToday') : t('counts.dayLeft', { count: days })}
                        </span>
                      )}
                    </span>
                  }
                />
              );
            })}
          </Group>
        )}

        {quietClients.length > 0 && (
          <Group
            icon="clients" tone="neutral" count={quietClients.length}
            title={t('attention.quiet')} hint={t('attention.quietHint', { days: inactiveDays })}
          >
            {quietClients.map(c => (
              <Row
                key={c.client_id}
                onClick={() => navigate(`/dashboard/clients/${c.client_id}`)}
                primary={`${c.first_name} ${c.last_name}`}
                secondary={c.days_since == null
                  ? t('attention.neverTrained')
                  : t('attention.lastTrained', { count: Number(c.days_since) })}
                trailing={<Icon name="chevronR" className="h-4 w-4 text-gray-400 flex-shrink-0" />}
              />
            ))}
          </Group>
        )}
      </div>
    </section>
  );
}
