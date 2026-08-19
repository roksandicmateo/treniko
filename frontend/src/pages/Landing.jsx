/**
 * The public landing page at `/`.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Until now `/` was `<Navigate to="/dashboard" />`, so every visitor who
 * followed a link to treniko.com — from Instagram, from the Facebook Page CTA,
 * from search — landed on a login form with no explanation of what the product
 * is. The whole acquisition funnel terminated in a password field.
 *
 * ── Rules this file follows ──────────────────────────────────────────────────
 * 1. **Only real capabilities.** Every feature named below was checked against
 *    the API surface in backend/routes and the pages in src/pages. Nothing here
 *    is aspirational. If a capability moves or is removed, this copy is wrong
 *    and should change with it.
 * 2. **No fabricated proof.** The product has almost no public traction, so
 *    there are no customer counts, testimonials, logos or statistics anywhere on
 *    this page — not even softened ones. An early product that says so is more
 *    credible than one that pretends.
 * 3. **No screenshots.** The product visual is built from the same Tailwind
 *    tokens as the real dashboard and filled with obviously synthetic data
 *    (first name plus an initial, no contact details). It demonstrates the
 *    layout honestly without shipping an image or exposing anyone's data.
 * 4. **English only**, per the standing single-language decision for all public
 *    TRENIKO copy. The app itself remains i18n-ready and ships EN/HR/DE.
 * 5. **No new dependencies, no images, no animation libraries.** Everything is
 *    inline SVG and Tailwind, so the page costs nothing beyond the bundle the
 *    app already ships.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ── Small building blocks ─────────────────────────────────────────────────── */

/**
 * Section wrapper. Every section paints its own background and text colour
 * rather than inheriting from <body>, because the app toggles a `dark` class on
 * <html> for signed-in trainers and a half-dark marketing page looks broken.
 * The landing page is deliberately one fixed light theme for every visitor.
 */
const Section = ({ id, className = '', children, labelledBy }) => (
  <section id={id} aria-labelledby={labelledBy} className={`px-5 sm:px-8 ${className}`}>
    <div className="mx-auto w-full max-w-6xl">{children}</div>
  </section>
);

const Eyebrow = ({ children }) => (
  <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">{children}</p>
);

const Icon = ({ path, className = 'h-5 w-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {path}
  </svg>
);

const ICONS = {
  users: <><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="4" /><path d="M22 19v-1a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
  clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>,
  group: <><circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /><path d="M18 14a4 4 0 0 1 4 4v2" /></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></>,
  devices: <><rect x="2" y="4" width="14" height="10" rx="1.5" /><path d="M2 18h11" /><rect x="17" y="9" width="5" height="11" rx="1.5" /></>,
};

/* ── Navbar ────────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#for-trainers', label: 'For trainers' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 100 100" className="h-8 w-8" aria-hidden="true" focusable="false">
        <rect width="100" height="100" rx="22" fill="#0ea5e9" />
        <rect x="19" y="28" width="62" height="16" rx="3.2" fill="#fff" />
        <rect x="42" y="28" width="16" height="48" rx="3.2" fill="#fff" />
      </svg>
      <span className="text-lg font-black tracking-[0.14em] text-gray-900">TRENIKO</span>
    </span>
  );
}

function Navbar({ signedIn }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-3.5 sm:px-8">
        <Link to="/" className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" aria-label="TRENIKO home">
          <Wordmark />
        </Link>

        <ul className="ml-6 hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="rounded text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {signedIn ? (
            <Link to="/dashboard" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
              Open app
            </Link>
          ) : (
            <>
              <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                Log in
              </Link>
              <Link to="/register" className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="ml-auto rounded-lg p-2 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:hidden"
        >
          <Icon
            className="h-6 w-6"
            path={open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          />
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="border-t border-gray-200 bg-white sm:hidden">
          <ul className="mx-auto w-full max-w-6xl px-5 py-3">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-2 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="mt-2 flex gap-2 border-t border-gray-100 pt-3">
              {signedIn ? (
                <Link to="/dashboard" onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-center text-sm font-semibold text-white">
                  Open app
                </Link>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-700">
                    Log in
                  </Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-center text-sm font-semibold text-white">
                    Get started
                  </Link>
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

/* ── Product visual ────────────────────────────────────────────────────────── */

/**
 * A representation of the trainer dashboard, built from the same tokens as the
 * real one (four stat tiles, today's sessions, package alerts — see
 * src/pages/DashboardPage.jsx). It is not a screenshot and is not presented as
 * one; the names are a first name and an initial, and there are no contact
 * details, so nothing here could belong to a real person.
 */
function ProductVisual() {
  const sessions = [
    { time: '08:00', name: 'Alex M.', kind: '1-on-1', tone: 'bg-green-500', tag: 'Done' },
    { time: '12:30', name: 'Jordan T.', kind: '1-on-1', tone: 'bg-sky-500', tag: null },
    { time: '17:15', name: 'Morning Group', kind: 'Group · 6', tone: 'bg-sky-500', tag: null },
    { time: '18:30', name: 'Riley P.', kind: '1-on-1', tone: 'bg-sky-500', tag: null },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-xl shadow-gray-900/5 sm:p-4">
      <div className="mb-3 flex items-center gap-1.5 px-1">
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <span className="ml-3 text-[11px] font-medium text-gray-400">Dashboard</span>
      </div>

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

      <div className="mt-3 grid gap-3 lg:grid-cols-5">
        <div className="rounded-xl border border-gray-100 p-3 lg:col-span-3">
          <p className="mb-2 text-xs font-semibold text-gray-900">Today&rsquo;s sessions</p>
          <ul className="space-y-1.5">
            {sessions.map((s) => (
              <li key={s.time} className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-2.5 py-2">
                <span className={`h-7 w-1.5 flex-shrink-0 rounded-full ${s.tone}`} />
                <span className="w-11 flex-shrink-0 text-[11px] font-semibold tabular-nums text-gray-700">{s.time}</span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-gray-700">{s.name}</span>
                <span className="hidden flex-shrink-0 text-[10px] text-gray-400 sm:inline">{s.kind}</span>
                {s.tag && (
                  <span className="flex-shrink-0 rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">
                    {s.tag}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-100 p-3 lg:col-span-2">
          <p className="mb-2 text-xs font-semibold text-gray-900">Package alerts</p>
          <ul className="space-y-1.5">
            {[
              ['Sam K.', '2 sessions left', 'bg-amber-50 text-amber-700'],
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
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

/**
 * The page's main call to action, which points at the app for a signed-in
 * trainer and at registration for everyone else.
 *
 * Both destinations are written as literal paths rather than computed into a
 * `to={...}` variable. That is not style: src/__tests__/routing.security.test.jsx
 * fails the build if any navigation target is a bare identifier, because that is
 * the shape the react-router open-redirect advisories exploit. A literal cannot
 * become an off-origin URL however this component is later refactored.
 */
function PrimaryCta({ signedIn, className }) {
  return signedIn ? (
    <Link to="/dashboard" className={className}>Open app</Link>
  ) : (
    <Link to="/register" className={className}>Get started</Link>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const signedIn = Boolean(user);

  const ctaClass =
    'inline-flex items-center justify-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-sky-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <Navbar signedIn={signedIn} />

      <main id="main">
        {/* ── Hero ── */}
        <Section className="pb-14 pt-14 sm:pb-20 sm:pt-20" labelledBy="hero-heading">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
            <div>
              <Eyebrow>Training management software</Eyebrow>
              <h1 id="hero-heading" className="mt-4 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">
                Run your coaching business.
                <span className="block text-sky-500">Not your spreadsheets.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
                TRENIKO keeps your clients, sessions, packages and payments in one place, so the
                admin side of personal training stops spreading itself across a spreadsheet, a
                calendar and a chat thread.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryCta signedIn={signedIn} className={ctaClass} />
                {!signedIn && (
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Log in
                  </Link>
                )}
              </div>

              <p className="mt-4 text-sm text-gray-500">
                Free plan: up to 5 clients and 20 sessions a month. No card required.
              </p>
            </div>

            <div className="lg:pl-4">
              <ProductVisual />
            </div>
          </div>
        </Section>

        {/* ── Problem ── */}
        <Section id="problem" className="border-y border-gray-100 bg-gray-50 py-16 sm:py-20" labelledBy="problem-heading">
          <Eyebrow>The problem</Eyebrow>
          <h2 id="problem-heading" className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
            Coaching is the easy part. Keeping track of it is not.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            Most independent trainers do not lose time to training. They lose it to everything
            around it — and it gets worse with every client they add.
          </p>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Four places, one client', 'Contact details in your phone, sessions in a calendar, payments in a spreadsheet, notes in a chat thread.'],
              ['Counting sessions by hand', 'How many are left on that 10-session pack? You work it out again every time somebody asks.'],
              ['“Has this client paid?”', 'The answer exists somewhere. Finding it takes three taps, a scroll and a guess.'],
              ['Admin after the last session', 'The work that should take ten minutes ends up spread across the evening.'],
            ].map(([title, body]) => (
              <li key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── How it works ── */}
        <Section id="product" className="py-16 sm:py-24" labelledBy="product-heading">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="product-heading" className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
            One workspace, four steps.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            Nothing to migrate and no new system to learn. It is the same information you already
            keep, in one place that keeps itself current.
          </p>

          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Add your clients', 'One profile per client: their details, goals, notes and history. Archive the ones who stop instead of deleting them.'],
              ['Book the sessions', 'Put sessions in the calendar one-to-one or as a group, then mark them completed, cancelled or a no-show.'],
              ['Assign a package', 'Give a client a block of sessions. It counts itself down as sessions are completed and tells you when it is nearly finished.'],
              ['Log what was paid', 'Record amount, method and status against the client, next to the sessions it paid for.'],
            ].map(([title, body], i) => (
              <li key={title} className="relative rounded-2xl border border-gray-200 p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sm font-black text-sky-600">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-sm font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── Features ── */}
        <Section id="features" className="border-y border-gray-100 bg-gray-50 py-16 sm:py-24" labelledBy="features-heading">
          <Eyebrow>What is inside</Eyebrow>
          <h2 id="features-heading" className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
            Everything a one-person training business actually needs.
          </h2>

          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [ICONS.users, 'Client management', 'Profiles, goals, private notes and per-client history. Archive clients who pause without losing their record.'],
              [ICONS.calendar, 'Session scheduling', 'A calendar built around sessions, with completed, cancelled and no-show statuses so your history stays honest.'],
              [ICONS.group, 'Groups', 'Run group sessions alongside one-to-one work, with their own roster and attendance.'],
              [ICONS.box, 'Session packages', 'Sell a block of sessions and let it count down by itself. Package alerts warn you before a client runs out.'],
              [ICONS.card, 'Payments', 'Amount, method and status recorded against the client, with a billing summary you can actually read.'],
              [ICONS.chart, 'Progress tracking', 'Measurements recorded over time per client, so a check-in starts from the record instead of memory.'],
              [ICONS.clipboard, 'Training plans', 'Build workouts from an exercise library, reuse them as templates, and attach them to a client.'],
              [ICONS.shield, 'GDPR built in', 'Per-client consent, a data-processing agreement, full data export and account deletion.'],
              [ICONS.devices, 'Works on any device', 'A responsive web app — phone between sessions, laptop in the evening. English, Croatian and German.'],
            ].map(([icon, title, body]) => (
              <li key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Icon path={icon} />
                </span>
                <h3 className="mt-3.5 text-sm font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── Built for personal trainers ── */}
        <Section id="for-trainers" className="py-16 sm:py-24" labelledBy="trainers-heading">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <Eyebrow>Built for personal trainers</Eyebrow>
              <h2 id="trainers-heading" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Not a gym system with the gym removed.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                TRENIKO is built for the trainer who is also the business: you take the bookings,
                you chase the payments, you remember whose package is running out. Every screen is
                shaped around that one job, which is why there is no membership billing, no front
                desk and no class-booking portal to configure before you can add your first client.
              </p>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                The measure we hold it to is simple: less time on admin, more time coaching.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {[
                ['Simple on purpose', 'The fields you use every week are on the first screen. Nothing has to be configured before it works.'],
                ['Less administration', 'Packages count themselves down, alerts arrive before a client runs out, and payments sit next to the sessions they cover.'],
                ['Everything in one place', 'One client, one record: sessions, packages, payments, progress and notes.'],
                ['Your data stays yours', 'Export everything you have put in, at any time, and delete the account outright if you want to leave.'],
              ].map(([title, body]) => (
                <li key={title} className="rounded-2xl border-l-4 border-sky-500 bg-sky-50/60 py-4 pl-5 pr-5">
                  <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ── Pricing ──
            There is no payment processor in the product yet, so no euro amount
            on this page could be paid even if a visitor wanted to. Publishing a
            price you cannot charge is the same category of mistake as inventing
            one, so the section describes exactly what a new account gets today
            and says plainly that paid plans are not on sale. */}
        <Section id="pricing" className="border-y border-gray-100 bg-gray-50 py-16 sm:py-24" labelledBy="pricing-heading">
          <Eyebrow>Pricing</Eyebrow>
          <h2 id="pricing-heading" className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
            Free while TRENIKO is early.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
            Creating an account puts you on the free plan. There is no billing in the product yet,
            so there is nothing to pay and no card to enter. When paid plans arrive, early accounts
            will hear about it before anything changes.
          </p>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border-2 border-sky-500 bg-white p-6 lg:col-span-2">
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-lg font-black text-gray-900">Free plan</h3>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">
                  Available now
                </span>
              </div>
              <p className="mt-1 text-3xl font-black text-gray-900">
                €0<span className="text-base font-semibold text-gray-500"> / month</span>
              </p>

              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {[
                  'Up to 5 clients',
                  'Up to 20 sessions per month',
                  'Session packages and alerts',
                  'Payment records per client',
                  'Groups and group sessions',
                  'Progress tracking',
                  'Training plans and exercises',
                  'Data export and deletion',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" path={<path d="m5 12 5 5L20 7" />} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <PrimaryCta signedIn={signedIn} className={`mt-7 ${ctaClass}`} />
            </div>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6">
              <h3 className="text-lg font-black text-gray-900">Larger plans</h3>
              <p className="mt-1 text-sm font-semibold text-gray-500">Not on sale yet</p>
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                Higher client limits and the reporting features that go with them are built into the
                product, but there is no way to buy them yet. If you are already past five clients
                and want to use TRENIKO, start on the free plan and get in touch — we would rather
                hear from you than guess.
              </p>
              <a
                href="mailto:info@treniko.com"
                className="mt-5 inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                info@treniko.com
              </a>
            </div>
          </div>
        </Section>

        {/* ── FAQ ── */}
        <Section id="faq" className="py-16 sm:py-24" labelledBy="faq-heading">
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-heading" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
            Questions worth answering before you sign up.
          </h2>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {[
              ['Who is TRENIKO for?', 'Independent personal trainers and small training businesses — the people who coach and run the business themselves. If a notebook still works for you, you probably do not need this yet.'],
              ['What can I manage with it?', 'Clients, one-to-one and group sessions, session packages, payments, progress records, and training plans built from an exercise library.'],
              ['Can I start for free?', 'Yes. Registering creates a free account with room for 5 clients and 20 sessions a month. There is no billing in the product, so no card is asked for at any point.'],
              ['How do I get started?', 'Create an account, add a client, and put a session in the calendar. That is enough to see whether it fits how you work.'],
              ['Can I use it on my phone?', 'Yes. TRENIKO is a responsive web app, so it runs in the browser on a phone, tablet or laptop with nothing to install. The interface is available in English, Croatian and German.'],
              ['What happens to my data?', 'It stays yours. Each account is isolated from every other, you can export everything you have entered, and you can delete your account and its data outright.'],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-gray-200 bg-white p-5 open:bg-gray-50/60">
                <summary className="cursor-pointer list-none text-sm font-bold text-gray-900 marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                  <span className="flex items-start justify-between gap-4">
                    {q}
                    <Icon
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180"
                      path={<path d="m6 9 6 6 6-6" />}
                    />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* ── Final CTA ── */}
        <Section className="pb-20 pt-4" labelledBy="cta-heading">
          <div className="rounded-3xl bg-gray-900 px-6 py-14 text-center sm:px-12">
            <h2 id="cta-heading" className="mx-auto max-w-2xl text-2xl font-black tracking-tight text-white sm:text-3xl">
              Ready to spend less time managing your training business?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-gray-300">
              Start with your next client. Adding one and booking a session takes a couple of
              minutes, and that is enough to tell whether TRENIKO fits.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <PrimaryCta
                signedIn={signedIn}
                className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              />
              {!signedIn && (
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-gray-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                >
                  Log in
                </Link>
              )}
            </div>
          </div>
        </Section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Wordmark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-600">
              Training management software for personal trainers. Clients, sessions, packages and
              payments in one place — less admin, more coaching.
            </p>
          </div>

          <nav aria-label="Product" className="text-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Product</h2>
            <ul className="mt-4 space-y-2.5">
              <li><a href="#product" className="text-gray-600 hover:text-gray-900">How it works</a></li>
              <li><a href="#features" className="text-gray-600 hover:text-gray-900">Features</a></li>
              <li><a href="#for-trainers" className="text-gray-600 hover:text-gray-900">For trainers</a></li>
              <li><a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a></li>
              <li><a href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</a></li>
            </ul>
          </nav>

          <nav aria-label="Account and legal" className="text-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Account</h2>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/login" className="text-gray-600 hover:text-gray-900">Log in</Link></li>
              <li><Link to="/register" className="text-gray-600 hover:text-gray-900">Sign up</Link></li>
              <li><Link to="/privacy" className="text-gray-600 hover:text-gray-900">Privacy policy</Link></li>
              <li><Link to="/terms" className="text-gray-600 hover:text-gray-900">Terms of service</Link></li>
              <li><a href="mailto:info@treniko.com" className="text-gray-600 hover:text-gray-900">info@treniko.com</a></li>
            </ul>
          </nav>
        </div>

        <div className="mx-auto mt-10 w-full max-w-6xl border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} TRENIKO. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
