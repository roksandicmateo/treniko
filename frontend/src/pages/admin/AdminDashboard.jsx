import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminDataAPI } from '../../services/adminApi';
import { DataState, useAdminResource } from '../../components/admin/DataState';
import { PageHeader, StatCard } from '../../components/admin/AdminLayout';
import { formatDate, formatDateTime } from './adminFormat';

/**
 * Platform overview. Every figure comes from `GET /api/admin/overview` and is
 * counted live by the database — nothing here is cached, derived in the browser
 * or estimated.
 */
const AdminDashboard = () => {
  const fetcher = useCallback(() => adminDataAPI.overview(), []);
  const { data, loading, error, reload } = useAdminResource(fetcher);

  const o = data?.overview;

  // Views and signups arrive as separate per-channel rows from a FULL OUTER
  // JOIN, so a channel appears whether it has one, the other, or both.
  const channels = o?.acquisition?.views?.byChannel ?? [];
  const pages = o?.acquisition?.views?.byPath ?? [];
  const referrers = o?.acquisition?.views?.byReferrer ?? [];
  const funnel = o?.funnel?.bySource ?? [];
  const funnelCampaigns = o?.funnel?.byCampaign ?? [];
  const minForRate = o?.funnel?.minimumForRate ?? 30;

  /**
   * A stage-to-stage percentage, or the words instead.
   *
   * Mirrors utils/acquisitionFunnel.js on the server: below the threshold there
   * is no number, because a rate off four accounts is a claim nobody can
   * support and it is the kind of figure that gets quoted back months later as
   * though it were measured.
   */
  const rate = (numerator, denominator) =>
    denominator >= minForRate ? `${Math.round((numerator / denominator) * 100)}%` : null;
  const measuringSince = o?.acquisition?.views?.measuring_since ?? null;

  // The subscriptions endpoint returns one row per (plan, status) pair, so the
  // split has to be summed rather than read off a field.
  const paidPlans = ['pro', 'enterprise'];
  const freeCount = o?.subscriptions
    ?.filter((s) => !paidPlans.includes(s.plan))
    .reduce((n, s) => n + s.count, 0) ?? 0;
  const paidCount = o?.subscriptions
    ?.filter((s) => paidPlans.includes(s.plan))
    .reduce((n, s) => n + s.count, 0) ?? 0;
  const activeSubs = o?.subscriptions
    ?.filter((s) => s.status === 'active')
    .reduce((n, s) => n + s.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={data?.generatedAt ? `Counted live at ${formatDateTime(data.generatedAt)}.` : undefined}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={!loading && !error && !o}
        emptyTitle="No overview available"
        loadingLabel="Counting the platform…"
      >
        {o && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Raw row count, kept because it is the truth about the table —
                  but labelled so it is not read as the signup count. Accounts
                  live in the Activation panel below. */}
              <StatCard label="Tenant rows" value={o.tenants.total} hint={`${o.tenants.last_7_days} in the last 7 days · see Activation for accounts`} />
              <StatCard label="Trainers" value={o.trainers.total} hint={`${o.trainers.verified} email-verified`} />
              <StatCard label="Clients" value={o.usage.clients_total} hint="across all tenants" />
              <StatCard label="Sessions" value={o.usage.sessions_this_period} hint="current billing period" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard label="Active subscriptions" value={activeSubs} />
              <StatCard label="Free plans" value={freeCount} />
              <StatCard label="Paid plans" value={paidCount} hint="pro + enterprise" />
              <StatCard
                label="Locked trainers"
                value={o.trainers.locked}
                hint={o.trainers.locked > 0 ? 'can be unlocked from Trainers' : 'none locked out'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Plan / status breakdown */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Subscriptions</h2>
                </div>
                {o.subscriptions.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-500">No subscriptions yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                          <th className="px-6 py-3">Plan</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Tenants</th>
                          <th className="px-6 py-3 text-right">On trial</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {o.subscriptions.map((s) => (
                          <tr key={`${s.plan}-${s.status}`}>
                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">{s.plan}</td>
                            <td className="px-6 py-3">
                              <span className={s.status === 'active' ? 'badge-green' : 'badge-amber'}>{s.status}</span>
                            </td>
                            <td className="px-6 py-3 text-right tabular-nums">{s.count}</td>
                            <td className="px-6 py-3 text-right tabular-nums text-gray-500">{s.trials}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent registrations */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Newest tenants</h2>
                  <Link to="/admin/trainers" className="text-sm text-primary-500 hover:text-primary-600">Trainers →</Link>
                </div>
                {o.newestTenants.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-500">No tenants yet.</p>
                ) : (
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                    {o.newestTenants.map((t) => (
                      <li key={t.id} className="px-6 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                          <p className="text-xs text-gray-500">{formatDate(t.created_at)}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {/* Migration 034. Campaign label, not a person. */}
                          {t.utm_source && (
                            <span className="badge-blue" title={[t.utm_campaign, t.utm_content].filter(Boolean).join(' · ')}>
                              {t.utm_source}
                            </span>
                          )}
                          <span className="badge-gray">
                            {t.trainer_count} trainer{t.trainer_count === 1 ? '' : 's'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ── The funnel, by source ─────────────────────────────────────
                The join everything else was missing. Acquisition says where
                visitors came from; activation says whether anyone became a
                user; this says WHICH SOURCE produced the ones who did, which
                is the only version of the question worth acting on.

                Percentages are withheld below `minimumForRate` rather than
                rendered small. A conversion rate computed from four accounts
                is not a cautious number, it is a wrong one. */}
            {funnel.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                    Funnel by source
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Visit → registration → verified → first client → first package → first booking.
                    Each account counts once per stage, so a trainer with five clients advances
                    “first client” by one.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                        <th className="px-6 py-3">Source</th>
                        <th className="px-6 py-3 text-right">Visits</th>
                        <th className="px-6 py-3 text-right">Registered</th>
                        <th className="px-6 py-3 text-right">Verified</th>
                        <th className="px-6 py-3 text-right">First client</th>
                        <th className="px-6 py-3 text-right">First package</th>
                        <th className="px-6 py-3 text-right">First booking</th>
                        <th className="px-6 py-3 text-right">Visit → reg.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {funnel.map((r) => (
                        <tr key={r.source}>
                          <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100 break-all">
                            {r.source}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.visits}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.registrations}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.verified}</td>
                          <td className="px-6 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                            {r.first_client}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.first_package}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.first_booking}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-gray-500">
                            {rate(r.registrations, r.visits) ?? (
                              <span className="text-xs">Not enough data yet</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium">(direct)</span> means measured, with no source —
                    someone typed the address or the referrer was withheld.{' '}
                    <span className="font-medium">(unattributed)</span> means an account created
                    before attribution existed, so it was never measured at all. The two are kept
                    apart on purpose: collapsing them would make development accounts read as
                    measured direct signups. Rates appear once a source has at least {minForRate}{' '}
                    visits.
                  </p>
                </div>

                {funnelCampaigns.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <div className="px-6 pt-5 pb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        By campaign
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Accounts that arrived with UTM tags, split by medium, campaign and content.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                            <th className="px-6 py-3">Source</th>
                            <th className="px-6 py-3">Medium</th>
                            <th className="px-6 py-3">Campaign</th>
                            <th className="px-6 py-3">Content</th>
                            <th className="px-6 py-3 text-right">Registered</th>
                            <th className="px-6 py-3 text-right">First client</th>
                            <th className="px-6 py-3 text-right">First booking</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                          {funnelCampaigns.map((r) => (
                            <tr key={`${r.utm_source}-${r.utm_medium}-${r.utm_campaign}-${r.utm_content}`}>
                              <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">{r.utm_source}</td>
                              <td className="px-6 py-3 text-gray-500">{r.utm_medium}</td>
                              <td className="px-6 py-3 text-gray-500">{r.utm_campaign}</td>
                              <td className="px-6 py-3 text-gray-500 break-all">{r.utm_content}</td>
                              <td className="px-6 py-3 text-right tabular-nums">{r.registrations}</td>
                              <td className="px-6 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                                {r.first_client}
                              </td>
                              <td className="px-6 py-3 text-right tabular-nums">{r.first_booking}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Activation ────────────────────────────────────────────────
                Deliberately ABOVE acquisition. Acquisition answers where people
                came from; this answers whether any of them became a user, and
                if the answer is none then no acquisition number below it means
                anything yet.

                `Accounts` is not the tenant row count. A tenant can outlive the
                account it belonged to — deletion before the fix in
                jobs/deletionJob.js left the shell behind — so the raw row count
                overstates signups, and every rate derived from it by the same
                margin. The discrepancy is shown rather than hidden, because a
                number that quietly disagrees with the database is worse than a
                number with a footnote. */}
            {o.activation && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Activation</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Registering is not adopting. Adding a first client is the earliest action only a
                    working trainer takes — it is the number that decides whether TRENIKO has a real
                    user.
                  </p>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 p-6">
                  <StatCard label="Accounts" value={o.activation.accounts ?? 0}
                    hint="Tenants that still have a user" />
                  <StatCard label="Email verified" value={o.activation.verified ?? 0} />
                  <StatCard label="Added a client" value={o.activation.with_client ?? 0}
                    hint="The activation event" />
                  <StatCard label="Booked a session" value={o.activation.with_training ?? 0} />
                  <StatCard label="Created a package" value={o.activation.with_package ?? 0} />
                </div>

                {o.activation.with_client === 0 && o.activation.accounts > 0 && (
                  <div className="px-6 pb-5 -mt-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        No account has ever added a client.
                      </span>{' '}
                      Every account so far registered and stopped. Until this is above zero the
                      product has not been used by anyone, and no traffic or conversion figure below
                      is worth optimising.
                    </p>
                  </div>
                )}

                {o.activation.tenant_rows > o.activation.accounts && (
                  <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {o.activation.tenant_rows} tenant rows exist against {o.activation.accounts}{' '}
                      accounts. The difference is empty shells left by account deletions that ran
                      before <code>jobs/deletionJob.js</code> removed the tenant too. They carry no
                      personal data. Counting rows instead of accounts would overstate signups.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Acquisition ───────────────────────────────────────────────
                Signups by channel. Every number here counts an ACCOUNT, never
                a visit — see the "not measured" note below, which is rendered
                deliberately so that an empty panel is never read as a zero. */}
            {o.acquisition && (
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">Acquisition</h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Where signups came from. First touch, captured on the landing page and kept for
                    the life of the account.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-6 border-b border-gray-100 dark:border-gray-800">
                  <StatCard
                    label="Page views"
                    value={o.acquisition.views?.views_total ?? 0}
                    hint={
                      o.acquisition.views?.last_7_days != null
                        ? `${o.acquisition.views.last_7_days} in the last 7 days`
                        : undefined
                    }
                  />
                  <StatCard label="Signups" value={o.acquisition.tenants_total} />
                  <StatCard
                    label="With a known source"
                    value={o.acquisition.attributed}
                    hint={
                      o.acquisition.tenants_total > 0
                        ? `${Math.round((o.acquisition.attributed / o.acquisition.tenants_total) * 100)}% of signups`
                        : undefined
                    }
                  />
                  <StatCard
                    label="Direct or unknown"
                    value={o.acquisition.direct_or_unknown}
                    hint="no tags, or analytics cookies declined"
                  />
                </div>

                {/* The aggregate visit-to-signup rate is deliberately NOT
                    shown. Views begin the day the counter shipped; signups go
                    back to the first account ever created. Dividing one by the
                    other produces a number well above reality that somebody
                    would then quote. Per-channel rates below appear only where
                    both sides actually have data. */}
                {measuringSince && (
                  <p className="px-6 py-3 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    Page views counted since <span className="font-medium">{formatDate(measuringSince)}</span>.
                    Signups predate that, so no overall visit-to-signup rate is shown here — it would
                    divide all-time signups by a shorter window of views. Views are page loads, not
                    unique people.
                  </p>
                )}

                {channels.length === 0 ? (
                  <p className="px-6 py-8 text-sm text-gray-500">
                    Nothing measured yet. The first page view or tagged registration will appear here.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                          <th className="px-6 py-3">Source</th>
                          <th className="px-6 py-3">Campaign</th>
                          <th className="px-6 py-3 text-right">Views</th>
                          <th className="px-6 py-3 text-right">Signups</th>
                          <th className="px-6 py-3 text-right">Conversion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                        {channels.map((r) => (
                          <tr key={`${r.utm_source}-${r.utm_campaign}`}>
                            <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">{r.utm_source}</td>
                            <td className="px-6 py-3 text-gray-500">{r.utm_campaign}</td>
                            <td className="px-6 py-3 text-right tabular-nums">{r.views}</td>
                            <td className="px-6 py-3 text-right tabular-nums">{r.signups}</td>
                            <td className="px-6 py-3 text-right tabular-nums text-gray-500">
                              {/* Shown only where views exist. A signup with no
                                  views is normal - it predates the counter, or
                                  the beacon was blocked - and printing a rate
                                  there would be a fabricated number. */}
                              {r.views > 0
                                ? `${Math.round((r.signups / r.views) * 100)}%`
                                : <span title="No views recorded for this channel yet">not measured</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Where untagged traffic came from ─────────────────────
                    The campaign table above can only see visits that carried a
                    UTM. Nobody tags an organic search result, so every visitor
                    who found TRENIKO through Google was landing in `(direct)`
                    next to people who typed the address in — which for a
                    programme whose whole purpose is organic search made the one
                    number that matters invisible. This splits them by referrer
                    host. Rows that DO carry a utm_source are excluded, so the
                    two tables do not double-count the same visit. */}
                {referrers.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <div className="px-6 pt-5 pb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Untagged traffic, by referrer
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Visits with no UTM tags. A search engine here is organic search.
                        <span className="font-medium"> (none)</span> is a direct visit or a referrer
                        the browser withheld — the two cannot be told apart, so they are not split.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                            <th className="px-6 py-3">Referrer</th>
                            <th className="px-6 py-3 text-right">Views</th>
                            <th className="px-6 py-3 text-right">Last 7 days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                          {referrers.map((r) => (
                            <tr key={r.referrer_host}>
                              <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100 break-all">
                                {r.referrer_host}
                              </td>
                              <td className="px-6 py-3 text-right tabular-nums">{r.views}</td>
                              <td className="px-6 py-3 text-right tabular-nums text-gray-500">
                                {r.last_7_days}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Which pages ──────────────────────────────────────────
                    The channel table above answers where visitors came from.
                    This answers what they read, which is the half that decides
                    what gets written next. Thirty days, not all time — labelled
                    on the header, because an unlabelled 30-day count next to
                    all-time counts reads as all-time. */}
                {pages.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <div className="px-6 pt-5 pb-2">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Most-viewed pages
                      </h3>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Last 30 days. Page loads, not unique visitors — there is no identifier to
                        deduplicate by.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                            <th className="px-6 py-3">Page</th>
                            <th className="px-6 py-3 text-right">Views (30d)</th>
                            <th className="px-6 py-3 text-right">Last 7 days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                          {pages.map((r) => (
                            <tr key={r.path}>
                              <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100 break-all">
                                {r.path}
                              </td>
                              <td className="px-6 py-3 text-right tabular-nums">{r.views}</td>
                              <td className="px-6 py-3 text-right tabular-nums text-gray-500">
                                {r.last_7_days}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {o.acquisition.notMeasured && (
                  <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Not measured
                    </p>
                    <ul className="mt-2 space-y-1">
                      {Object.entries(o.acquisition.notMeasured).map(([key, why]) => (
                        <li key={key} className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
                          </span>{' '}
                          — {why}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {o.deletionRequests.pending > 0 && (
              <div className="card p-5 border-l-4 border-l-amber-500">
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {o.deletionRequests.pending} pending deletion request{o.deletionRequests.pending === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Accounts scheduled for erasure. Processed automatically by the deletion job once the grace period ends.
                </p>
              </div>
            )}
          </div>
        )}
      </DataState>
    </>
  );
};

export default AdminDashboard;
