/**
 * The product showcase on the landing page.
 *
 * ── What this is, and what it is not ─────────────────────────────────────────
 * It is a faithful reconstruction of four real screens — the dashboard, the
 * client list, packages and payments — built from the same Tailwind tokens the
 * application itself uses, inside a browser chrome.
 *
 * It is **not** a screenshot, and it is not presented as one. That is a
 * deliberate choice rather than a shortcut:
 *
 *   - A screenshot of production would contain a real trainer's clients. There
 *     are only a handful of accounts, so "anonymised" would not be anonymous.
 *   - A screenshot of a seeded demo tenant would be honest but ships as a
 *     ~200 kB image that cannot reflow on a phone and goes stale the first time
 *     a padding value changes.
 *   - This reflows to 375 px, costs no bytes beyond the markup, and stays in
 *     step with the design system because it *is* the design system.
 *
 * Everything shown is real behaviour, checked against the code:
 *   - the four dashboard tiles are the ones in DashboardPage.jsx
 *   - session states are the four in migration 013 (scheduled / completed /
 *     cancelled / no_show)
 *   - the package alert rule is dashboardController.js: session-based packages
 *     with two or fewer sessions left, or ending within seven days
 *   - payment status is the CHECK constraint in migration 020: paid | pending
 *   - amounts are EUR, matching the app's own Intl currency setting
 *
 * The data is synthetic: a first name and an initial, no email, no phone, no
 * date of birth, no health note. Nothing here could belong to a real person.
 */

import { useState } from 'react';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Clients' },
  { id: 'packages', label: 'Packages' },
  { id: 'payments', label: 'Payments' },
];

/* ── Shared bits ───────────────────────────────────────────────────────────── */

const Panel = ({ title, action, children, className = '' }) => (
  <div className={`rounded-xl border border-gray-100 bg-white p-3 ${className}`}>
    <div className="mb-2.5 flex items-center justify-between">
      <p className="text-xs font-semibold text-gray-900">{title}</p>
      {action && <span className="text-[10px] font-medium text-sky-600">{action}</span>}
    </div>
    {children}
  </div>
);

const Bar = ({ pct, tone = 'bg-sky-500' }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
    <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
  </div>
);

/* ── Views ─────────────────────────────────────────────────────────────────── */

function DashboardView() {
  const sessions = [
    { time: '08:00', name: 'Alex M.', kind: '1-on-1', tone: 'bg-green-500', tag: 'Completed', tagTone: 'bg-green-100 text-green-700' },
    { time: '12:30', name: 'Jordan T.', kind: '1-on-1', tone: 'bg-sky-500', tag: null },
    { time: '17:15', name: 'Morning Group', kind: 'Group · 6', tone: 'bg-sky-500', tag: null },
    { time: '18:30', name: 'Riley P.', kind: '1-on-1', tone: 'bg-gray-300', tag: 'No-show', tagTone: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {[
          ['Active clients', '18', 'bg-blue-50'],
          ['Sessions today', '4', 'bg-purple-50'],
          ['Done this month', '52', 'bg-green-50'],
          ['Active packages', '11', 'bg-orange-50'],
        ].map(([label, value, tone]) => (
          <div key={label} className={`rounded-xl ${tone} px-3 py-3`}>
            <p className="text-xl font-bold leading-none text-gray-900">{value}</p>
            <p className="mt-1.5 text-[11px] leading-tight text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        <Panel title="Today's sessions" action="Open calendar" className="lg:col-span-3">
          <ul className="space-y-1.5">
            {sessions.map((s) => (
              <li key={s.time} className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-2.5 py-2">
                <span className={`h-7 w-1.5 flex-shrink-0 rounded-full ${s.tone}`} />
                <span className="w-11 flex-shrink-0 text-[11px] font-semibold tabular-nums text-gray-700">{s.time}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-gray-700">{s.name}</span>
                <span className="hidden flex-shrink-0 text-[10px] text-gray-400 sm:inline">{s.kind}</span>
                {s.tag && (
                  <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${s.tagTone}`}>
                    {s.tag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Package alerts" action="All packages" className="lg:col-span-2">
          <ul className="space-y-1.5">
            {[
              ['Sam K.', '2 sessions left', 'bg-amber-50 text-amber-800'],
              ['Casey B.', '1 session left', 'bg-red-50 text-red-700'],
            ].map(([name, note, tone]) => (
              <li key={name} className={`rounded-lg px-2.5 py-2 ${tone}`}>
                <p className="text-[11px] font-semibold">{name}</p>
                <p className="text-[10px] opacity-80">{note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[10px] leading-snug text-gray-400">
            Packages count down as sessions are completed.
          </p>
        </Panel>
      </div>
    </div>
  );
}

function ClientsView() {
  const rows = [
    ['Alex M.', '10-session pack', '6 / 10', 'Active', 'bg-green-100 text-green-700'],
    ['Jordan T.', '20-session pack', '18 / 20', 'Active', 'bg-green-100 text-green-700'],
    ['Sam K.', '10-session pack', '8 / 10', 'Active', 'bg-green-100 text-green-700'],
    ['Riley P.', 'Single sessions', '—', 'Active', 'bg-green-100 text-green-700'],
    ['Casey B.', '10-session pack', '9 / 10', 'Active', 'bg-green-100 text-green-700'],
    ['Morgan L.', '—', '—', 'Archived', 'bg-gray-100 text-gray-500'],
  ];

  return (
    <Panel title="Clients" action="Add client">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              {['Client', 'Package', 'Used', 'Status'].map((h) => (
                <th key={h} className="pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, pack, used, status, tone]) => (
              <tr key={name} className="border-b border-gray-50 last:border-0">
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-50 text-[10px] font-bold text-sky-600">
                      {name[0]}
                    </span>
                    <span className="text-[11px] font-medium text-gray-800">{name}</span>
                  </span>
                </td>
                <td className="py-2 pr-2 text-[11px] text-gray-500">{pack}</td>
                <td className="py-2 pr-2 text-[11px] tabular-nums text-gray-500">{used}</td>
                <td className="py-2">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${tone}`}>{status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-[10px] text-gray-400">
        Archived clients keep their history and stop counting against your plan.
      </p>
    </Panel>
  );
}

function PackagesView() {
  const packs = [
    ['Alex M.', '10-session pack', 6, 10],
    ['Jordan T.', '20-session pack', 18, 20],
    ['Sam K.', '10-session pack', 8, 10],
    ['Casey B.', '10-session pack', 9, 10],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {packs.map(([name, label, used, total]) => {
        const left = total - used;
        const pct = Math.round((used / total) * 100);
        const low = left <= 2;
        return (
          <div key={name} className="rounded-xl border border-gray-100 bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-gray-900">{name}</p>
                <p className="truncate text-[10px] text-gray-500">{label}</p>
              </div>
              <span
                className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                  low ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {left} left
              </span>
            </div>
            <div className="mt-3">
              <Bar pct={pct} tone={low ? 'bg-amber-500' : 'bg-sky-500'} />
              <p className="mt-1.5 text-[10px] tabular-nums text-gray-400">
                {used} of {total} sessions used
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentsView() {
  const rows = [
    ['Jordan T.', '20-session pack', '€560.00', 'Card', 'Paid', 'bg-green-100 text-green-700'],
    ['Alex M.', '10-session pack', '€300.00', 'Cash', 'Paid', 'bg-green-100 text-green-700'],
    ['Sam K.', '10-session pack', '€300.00', 'Transfer', 'Pending', 'bg-amber-100 text-amber-800'],
    ['Riley P.', 'Single session', '€35.00', 'Cash', 'Paid', 'bg-green-100 text-green-700'],
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          ['This month', '€1,195'],
          ['Outstanding', '€300'],
          ['Payments', '14'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-gray-50 px-3 py-3">
            <p className="text-base font-bold leading-none tabular-nums text-gray-900">{value}</p>
            <p className="mt-1.5 text-[10px] text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <Panel title="Recent payments" action="Billing summary">
        <ul className="space-y-1.5">
          {rows.map(([name, what, amount, method, status, tone]) => (
            <li key={name + amount} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-gray-800">{name}</span>
                <span className="block truncate text-[10px] text-gray-400">{what}</span>
              </span>
              <span className="hidden flex-shrink-0 text-[10px] text-gray-400 sm:inline">{method}</span>
              <span className="flex-shrink-0 text-[11px] font-semibold tabular-nums text-gray-800">{amount}</span>
              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${tone}`}>{status}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

const VIEWS = {
  dashboard: DashboardView,
  clients: ClientsView,
  packages: PackagesView,
  payments: PaymentsView,
};

/* ── Frame ─────────────────────────────────────────────────────────────────── */

export default function ProductShowcase() {
  const [tab, setTab] = useState('dashboard');
  const View = VIEWS[tab];

  return (
    <figure className="m-0">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-900/10">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
          </span>
          <span className="mx-auto hidden rounded-md bg-white px-3 py-1 text-[10px] text-gray-400 ring-1 ring-gray-100 sm:block">
            treniko.com/dashboard
          </span>
        </div>

        {/* view switcher */}
        <div
          role="tablist"
          aria-label="TRENIKO screens"
          className="flex gap-1 overflow-x-auto border-b border-gray-100 px-2 py-2"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              id={`showcase-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`showcase-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                tab === t.id ? 'bg-sky-50 text-sky-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`showcase-panel-${tab}`}
          aria-labelledby={`showcase-tab-${tab}`}
          className="bg-gray-50/60 p-3 sm:p-4"
        >
          <View />
        </div>
      </div>

      <figcaption className="mt-3 text-center text-xs text-gray-400">
        TRENIKO&rsquo;s screens, rebuilt here with sample data. No real client information is shown.
      </figcaption>
    </figure>
  );
}
