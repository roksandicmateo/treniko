import { useTranslation } from 'react-i18next';
import Icon from './Icon';
import { formatDayLabel, formatTime, formatShortDate, formatMoney, localeFor, daysFromToday } from '../utils/datetime';

/**
 * The four facts a trainer opens a client for.
 *
 * ── What was wrong ───────────────────────────────────────────────────────────
 * The header showed three counters — total sessions, completed, upcoming — and
 * none of the things the page is actually opened to find out. How many sessions
 * are left lived behind the packages tab; whether they had paid lived behind
 * the billing tab; when they are next in was fetched and never rendered. Three
 * questions, two extra taps and two extra requests each.
 *
 * Everything here comes from the single `GET /api/clients/:id` the page already
 * makes (the endpoint was extended rather than a new one added), so this costs
 * no round trips.
 */

const Cell = ({ label, children, tone = 'neutral' }) => {
  const tones = {
    neutral:  'text-gray-900 dark:text-gray-100',
    good:     'text-emerald-700 dark:text-emerald-400',
    warning:  'text-amber-700 dark:text-amber-400',
    critical: 'text-red-700 dark:text-red-400',
    muted:    'text-gray-400 dark:text-gray-500',
  };
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold truncate ${tones[tone]}`}>{children}</p>
    </div>
  );
};

export default function ClientSummaryHeader({ client, onSchedule }) {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);

  const pkg = client.active_package;
  const remaining = pkg && pkg.sessions_remaining != null ? Number(pkg.sessions_remaining) : null;
  const daysLeft = pkg && pkg.days_left != null ? Number(pkg.days_left) : null;
  const pay = client.payment_summary || {};
  const pending = Number(pay.total_pending || 0);
  const next = client.next_session;
  const last = client.last_session;
  const lastDays = last ? -daysFromToday(last.session_date) : null;

  const packageTone = remaining == null ? 'neutral'
    : remaining <= 1 ? 'critical'
    : remaining <= 3 ? 'warning'
    : 'good';

  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Cell
          label={t('clients.remaining')}
          tone={pkg ? packageTone : 'muted'}
        >
          {!pkg ? t('clients.noPackage')
            : remaining == null ? t('packages.unlimited')
            : `${remaining} / ${pkg.total_sessions}`}
        </Cell>

        <Cell
          label={t('packages.expires')}
          tone={daysLeft != null && daysLeft <= 7 ? 'warning' : 'neutral'}
        >
          {!pkg ? '—'
            : pkg.end_date
              ? `${formatShortDate(pkg.end_date, locale)}${daysLeft != null ? ` · ${t('counts.dayLeft', { count: Math.max(daysLeft, 0) })}` : ''}`
              : '—'}
        </Cell>

        <Cell label={t('clients.nextSession')} tone={next ? 'neutral' : 'muted'}>
          {next
            ? `${formatDayLabel(next.session_date, locale, t)} · ${formatTime(next.start_time)}`
            : t('clients.noUpcoming')}
        </Cell>

        <Cell
          label={t('clients.lastSession')}
          tone={lastDays != null && lastDays > 21 ? 'warning' : 'neutral'}
        >
          {last
            ? `${formatShortDate(last.session_date, locale)}${lastDays != null ? ` · ${t('counts.day', { count: lastDays })}` : ''}`
            : t('attention.neverTrained')}
        </Cell>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Icon
            name={pending > 0 ? 'alert' : 'check'}
            className={`h-4 w-4 ${pending > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}
          />
          <span className={pending > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-600 dark:text-gray-400'}>
            {pending > 0
              ? t('clients.unpaidAmount', { amount: formatMoney(pending, pay.currency || 'EUR', locale) })
              : Number(pay.total_paid || 0) > 0
                ? `${t('clients.paid')} · ${formatMoney(pay.total_paid, pay.currency || 'EUR', locale)}`
                : t('clients.noPayments')}
          </span>
        </div>

        {onSchedule && (
          <button
            type="button"
            onClick={onSchedule}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            <Icon name="plus" className="h-4 w-4" />
            {t('clients.scheduleSession').replace('+ ', '')}
          </button>
        )}
      </div>
    </section>
  );
}
