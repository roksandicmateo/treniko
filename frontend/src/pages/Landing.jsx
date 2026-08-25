/**
 * The public landing page at `/`.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `/` used to be `<Navigate to="/dashboard" />`, so every visitor arriving from
 * Instagram, the Facebook Page CTA or search landed on a login form with no
 * explanation of what TRENIKO is. The acquisition funnel ended in a password
 * field.
 *
 * ── Rules this file follows ──────────────────────────────────────────────────
 * 1. **Only real capabilities.** Every feature named below was checked against
 *    backend/routes, backend/migrations and src/pages before it was written.
 *    Nothing here is aspirational. If a capability moves or is removed, this
 *    copy becomes wrong and must change with it.
 * 2. **No fabricated proof.** No customer counts, testimonials, logos, review
 *    scores or percentage improvements — not even softened ones. The product is
 *    early and says so; that is more credible than filler, and the test suite
 *    fails the build if any of it creeps back in.
 * 3. **No screenshots.** The product visual is a reconstruction from the app's
 *    own design tokens with synthetic data. See landing/ProductShowcase.jsx for
 *    why that beats both a production screenshot and a seeded one.
 * 4. **English only**, per the standing single-language decision for public
 *    TRENIKO copy. The app itself ships EN/HR/DE and stays i18n-ready.
 * 5. **No new dependencies, no raster images, no animation library.** Inline SVG
 *    and Tailwind only, so the public entry point costs nothing beyond the
 *    bundle the app already ships.
 */

import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProductShowcase from './landing/ProductShowcase';
import { captureAttribution } from '../utils/attribution';

/* ── Primitives ────────────────────────────────────────────────────────────── */

/**
 * Sections paint their own background and text colour instead of inheriting
 * from <body>: the app toggles a `dark` class on <html> for signed-in trainers,
 * and a half-dark marketing page looks broken. This page is one fixed light
 * theme for every visitor.
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
  users: <><path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" /><circle cx="9" cy="7" r="4" /><path d="M22 19v-1a4 4 0 0 0-3-3.87" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  box: <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  chart: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
  clipboard: <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  instagram: <><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></>,
  facebook: <path d="M15 3h-3a4 4 0 0 0-4 4v3H5v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
};

/**
 * Fades a block in the first time it scrolls into view.
 *
 * ── Why this starts visible ──────────────────────────────────────────────────
 * It used to start at `opacity-0` and reveal on intersection. That was fine
 * while the page was client-rendered and invisible to crawlers anyway. It is
 * not fine now that the homepage is prerendered: the server HTML would have
 * carried `opacity-0` on every block below the hero, which is a page whose text
 * is present but invisible — indistinguishable from hidden-text cloaking, and
 * exactly what a crawler is entitled to be suspicious of.
 *
 * So the initial state is **visible**, on the server and in the first client
 * render alike. That also keeps hydration honest: both sides produce the same
 * markup, so React has nothing to reconcile.
 *
 * ── Why the animation still happens ──────────────────────────────────────────
 * After mount, a block that is currently **below the viewport** hides itself
 * and waits for the observer. The visitor cannot see that happen — it is off
 * screen by definition — so the scroll-reveal effect is unchanged in practice.
 *
 * A block that is already on screen when the effect runs is left alone
 * permanently. Hiding something the visitor is looking at in order to fade it
 * back in is a flicker, not an animation, and it is the specific failure mode
 * that makes naive scroll-reveal look broken on a prerendered page.
 *
 * `prefers-reduced-motion`, a missing IntersectionObserver, and a page rendered
 * without JavaScript at all now converge on the same outcome: the content is
 * simply there.
 */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  // Visible first. Never render opacity-0 on the server — see above.
  const [hidden, setHidden] = useState(false);

  // Decide, once, whether this block is a candidate for animating in.
  useEffect(() => {
    const node = ref.current;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!node || reduced || typeof IntersectionObserver !== 'function') return;

    // Only animate what cannot currently be seen. Hiding something already on
    // screen in order to fade it back in is a flicker, not an animation.
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    setHidden(true);
  }, []);

  // Watch, but only while actually hidden, and stop the moment it is revealed.
  //
  // The subtlety is the rootMargin, and it is the whole point of this effect.
  //
  // A default IntersectionObserver reports *threshold crossings*. Jump straight
  // from the top of the page to the bottom — Ctrl+End, a hash link, a hard flick
  // on a phone — and a block can travel from below the fold to above the
  // viewport within a single frame. It was not intersecting before and is not
  // intersecting after, so no threshold is crossed, no callback fires, and the
  // block would keep opacity-0 for the rest of the session.
  //
  // Growing the root's top edge by a very large margin changes what
  // "intersecting" means: not "on screen" but "has reached or passed the reveal
  // line". A block below the fold is still outside it; the moment it is level
  // with the viewport bottom *or anywhere above it* — including far above,
  // after a jump — it is inside, which is a genuine crossing, so the callback
  // fires and the content is revealed.
  //
  // This is defence against a real IntersectionObserver behaviour rather than
  // against an observed failure: it could not be reproduced in the automation
  // browser, because that tab runs backgrounded and Chrome throttles rAF,
  // scroll events and IntersectionObserver entirely when document.hidden is
  // true. The behaviour is pinned by tests instead — see
  // src/__tests__/reveal.test.jsx — which is the only way to assert it
  // deterministically.
  //
  // A scroll listener was considered and rejected: it is strictly weaker, since
  // scroll events do not fire for programmatic jumps in every environment.
  useEffect(() => {
    if (!hidden) return undefined;
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setHidden(false);
          observer.disconnect();
        }
      },
      { rootMargin: '100000px 0px -10% 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hidden]);

  return (
    <div
      ref={ref}
      style={!hidden && delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        hidden ? 'translate-y-4 opacity-0' : 'translate-y-0 opacity-100'
      } ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Calls to action ───────────────────────────────────────────────────────── */

const CTA_CLASS =
  'inline-flex items-center justify-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2';

/**
 * The main call to action: the app for a signed-in trainer, registration for
 * everyone else.
 *
 * Both destinations are literal paths, not a computed `to={...}`. That is not
 * style — src/__tests__/routing.security.test.jsx fails the build when a
 * navigation target is a bare identifier, because that is the shape the
 * react-router open-redirect advisories exploit. A literal cannot be turned into
 * an off-origin URL by any later refactor.
 *
 * The click also runs the attribution capture, which is the moment it matters:
 * the visitor is leaving the URL that carries the UTM tags. It writes nothing
 * without analytics consent — see utils/attribution.js.
 */
function PrimaryCta({ signedIn, className = CTA_CLASS, label = 'Start for free' }) {
  const onClick = () => { captureAttribution(); };

  return signedIn ? (
    <Link to="/dashboard" className={className}>Open app</Link>
  ) : (
    <Link to="/register" className={className} onClick={onClick}>{label}</Link>
  );
}

/* ── Navbar ────────────────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#for-trainers', label: 'For trainers' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

function Wordmark({ className = 'text-lg' }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 100 100" className="h-8 w-8 flex-shrink-0" aria-hidden="true" focusable="false">
        <rect width="100" height="100" rx="22" fill="#0ea5e9" />
        <rect x="19" y="28" width="62" height="16" rx="3.2" fill="#fff" />
        <rect x="42" y="28" width="16" height="48" rx="3.2" fill="#fff" />
      </svg>
      <span className={`${className} font-black tracking-[0.14em] text-gray-900`}>TRENIKO</span>
    </span>
  );
}

function Navbar({ signedIn }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-white/90 backdrop-blur transition-shadow ${
        scrolled ? 'border-b border-gray-200 shadow-sm' : 'border-b border-transparent'
      }`}
    >
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
              <PrimaryCta
                signedIn={false}
                className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              />
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
                  <PrimaryCta
                    signedIn={false}
                    className="flex-1 rounded-xl bg-sky-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
                  />
                </>
              )}
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

/* ── Feature sections ──────────────────────────────────────────────────────── */

/**
 * The six product areas. Each was verified before it was written:
 *   clients   — routes/clients.js, migration 012 (notes), is_archived
 *   sessions  — routes/sessions.js, migration 013 (four states), routes/groups.js
 *   packages  — routes/packages.js, dashboardController.js alert rule
 *   payments  — migration 020 (method, status paid|pending), getBillingSummary
 *   progress  — routes/progress.js
 *   training  — routes/trainings.js, exercises.js, templates.js
 */
const FEATURES = [
  {
    id: 'clients',
    icon: ICONS.users,
    eyebrow: 'Clients',
    title: 'Know every client at a glance.',
    body: 'One record per client instead of a contact, a chat thread and a row in a spreadsheet. Open it and the whole history is there.',
    points: [
      'Profiles with goals and the details you actually use',
      'Private notes kept against the client, not in your phone',
      'Full session and payment history in one place',
      'Archive clients who pause — the record stays, the slot frees up',
    ],
  },
  {
    id: 'sessions',
    icon: ICONS.calendar,
    eyebrow: 'Sessions',
    title: 'Keep your schedule under control.',
    body: 'A calendar built around training, not a generic diary. What happened is recorded as plainly as what is booked.',
    points: [
      'Book one-to-one sessions and see the week at a glance',
      'Mark sessions completed, cancelled or a no-show',
      'Run group sessions with their own roster and attendance',
      'Today and the next seven days on the dashboard',
    ],
  },
  {
    id: 'packages',
    icon: ICONS.box,
    eyebrow: 'Packages',
    title: 'Know exactly where every package stands.',
    body: 'Sell a block of sessions once and stop counting. The package keeps its own score and tells you before it runs out.',
    points: [
      'Sessions count down automatically as they are completed',
      'Alerts when a client has two sessions or fewer left',
      'Alerts before a time-limited package expires',
      'Remaining sessions visible on the client and the dashboard',
    ],
  },
  {
    id: 'payments',
    icon: ICONS.card,
    eyebrow: 'Payments',
    title: 'Keep payments organised.',
    body: '“Has this client paid?” answered by looking, not by remembering. Payments sit on the client, next to the sessions they cover.',
    points: [
      'Record amount, method and status per payment',
      'Mark a payment paid or pending',
      'A billing summary across recent months',
      'Outstanding payments visible without a spreadsheet',
    ],
  },
  {
    id: 'progress',
    icon: ICONS.chart,
    eyebrow: 'Progress',
    title: 'See the progress behind the work.',
    body: 'A check-in that starts from the record instead of memory is a better check-in, and it takes less time.',
    points: [
      'Track measurements against a client over time',
      'Review the history when you plan the next block',
      'Progress kept with the client, not in a camera roll',
    ],
  },
  {
    id: 'training',
    icon: ICONS.clipboard,
    eyebrow: 'Training',
    title: 'Build better training plans.',
    body: 'Write a session once and reuse it. The library is yours and it gets more useful the longer you use it.',
    points: [
      'Build training plans from an exercise library',
      'Save plans as templates and reuse them',
      'Attach a plan to the client it belongs to',
    ],
  },
];

function FeatureBlock({ feature, index }) {
  const flipped = index % 2 === 1;

  return (
    <Reveal>
      <div className="grid items-center gap-8 py-10 sm:py-12 lg:grid-cols-2 lg:gap-14">
        <div className={flipped ? 'lg:order-2' : ''}>
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Icon path={feature.icon} className="h-5.5 w-5.5" />
          </span>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-sky-600">{feature.eyebrow}</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-gray-900 sm:text-2xl">{feature.title}</h3>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-gray-600">{feature.body}</p>
          <ul className="mt-5 space-y-2.5">
            {feature.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Icon path={ICONS.check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={flipped ? 'lg:order-1' : ''} aria-hidden="true">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-sky-50/70 to-white p-6 sm:p-8">
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <FeatureVisual id={feature.id} />
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** Small, decorative reconstructions of the matching screen. Presentational
 *  only — the section is aria-hidden and the copy carries the meaning. */
function FeatureVisual({ id }) {
  const row = (label, meta, tone = 'bg-sky-500') => (
    <div key={label} className="flex items-center gap-2.5 rounded-lg bg-gray-50 px-2.5 py-2">
      <span className={`h-6 w-1.5 flex-shrink-0 rounded-full ${tone}`} />
      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-700">{label}</span>
      <span className="flex-shrink-0 text-[10px] text-gray-400">{meta}</span>
    </div>
  );

  if (id === 'clients') {
    return (
      <div className="space-y-1.5">
        {[['Alex M.', '6 / 10 used'], ['Jordan T.', '18 / 20 used'], ['Sam K.', '8 / 10 used'], ['Morgan L.', 'Archived']].map(
          ([n, m], i) => row(n, m, i === 3 ? 'bg-gray-300' : 'bg-sky-500')
        )}
      </div>
    );
  }
  if (id === 'sessions') {
    return (
      <div className="space-y-1.5">
        {row('08:00 · Alex M.', 'Completed', 'bg-green-500')}
        {row('12:30 · Jordan T.', 'Scheduled', 'bg-sky-500')}
        {row('17:15 · Morning Group', 'Group · 6', 'bg-sky-500')}
        {row('18:30 · Riley P.', 'No-show', 'bg-red-400')}
      </div>
    );
  }
  if (id === 'packages') {
    return (
      <div className="space-y-3">
        {[['Alex M.', 60, 'bg-sky-500', '4 left'], ['Casey B.', 90, 'bg-amber-500', '1 left']].map(([n, pct, tone, left]) => (
          <div key={n}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-medium text-gray-700">{n}</span>
              <span className="text-[10px] text-gray-400">{left}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (id === 'payments') {
    return (
      <div className="space-y-1.5">
        {[['Jordan T. · €560.00', 'Paid', 'bg-green-500'], ['Alex M. · €300.00', 'Paid', 'bg-green-500'], ['Sam K. · €300.00', 'Pending', 'bg-amber-500']].map(
          ([n, s, tone]) => row(n, s, tone)
        )}
      </div>
    );
  }
  if (id === 'progress') {
    return (
      <svg viewBox="0 0 200 80" className="h-24 w-full" aria-hidden="true">
        <polyline points="8,64 44,56 80,58 116,44 152,38 188,26" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {[[8, 64], [44, 56], [80, 58], [116, 44], [152, 38], [188, 26]].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="3" fill="#0ea5e9" />
        ))}
        <line x1="4" y1="74" x2="196" y2="74" stroke="#e5e7eb" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <div className="space-y-1.5">
      {row('Lower body — week 3', '6 exercises')}
      {row('Upper body — push', '5 exercises')}
      {row('Full body — template', 'Template', 'bg-gray-300')}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function Landing() {
  const { user } = useAuth();
  const signedIn = Boolean(user);

  // First-touch attribution. Writes nothing without analytics consent, and
  // never overwrites an existing value. See utils/attribution.js.
  useEffect(() => { captureAttribution(); }, []);

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
        <Section className="pb-14 pt-12 sm:pb-20 sm:pt-16" labelledBy="hero-heading">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
            <div>
              <Eyebrow>Training management software</Eyebrow>
              <h1 id="hero-heading" className="mt-4 text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">
                Run your personal training business
                <span className="block text-sky-500">without the admin chaos.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
                Manage clients, sessions, packages, payments and progress from one workspace — so you
                spend less time running the business and more time coaching.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <PrimaryCta signedIn={signedIn} />
                {!signedIn && (
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    Log in
                  </Link>
                )}
              </div>

              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
                {['Free plan', '5 clients', '20 sessions a month', 'No credit card'].map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <Icon path={ICONS.check} className="h-4 w-4 text-sky-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <Reveal className="min-w-0">
              <ProductShowcase />
            </Reveal>
          </div>
        </Section>

        {/* ── Problem → solution ── */}
        <Section id="problem" className="border-y border-gray-100 bg-gray-50 py-16 sm:py-20" labelledBy="problem-heading">
          <Reveal>
            <Eyebrow>The problem</Eyebrow>
            <h2 id="problem-heading" className="mt-3 max-w-3xl text-2xl font-black tracking-tight sm:text-3xl">
              Your business is not disorganised. It is just spread across six places.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
              None of this is hard on its own. It becomes hard because every piece lives somewhere
              different, and only you know how they connect.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Clients in your phone', 'Names, numbers and half the context in a chat thread you have to scroll.'],
                ['Sessions in a calendar', 'That knows nothing about packages, payments or who actually turned up.'],
                ['Packages counted by hand', 'You work out how many sessions are left every time somebody asks.'],
                ['Payments you have to remember', 'The answer exists. Finding it takes three taps and a guess.'],
                ['Progress in a camera roll', 'Screenshots and notes that never line up with the sessions they came from.'],
                ['Plans in documents', 'Written once, saved somewhere, found again with difficulty.'],
              ].map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-10 rounded-2xl border border-sky-200 bg-white p-6 sm:p-8">
              <h3 className="text-lg font-black tracking-tight text-gray-900">
                TRENIKO is the one place they all belong.
              </h3>
              <p className="mt-2 max-w-3xl text-base leading-relaxed text-gray-600">
                The same information you already keep, in one workspace that keeps itself current —
                so the answer to “how many sessions has she got left, and has she paid for them?” is
                one screen away instead of four.
              </p>
            </div>
          </Reveal>
        </Section>

        {/* ── Features ── */}
        <Section id="features" className="py-16 sm:py-20" labelledBy="features-heading">
          <Reveal>
            <Eyebrow>Features</Eyebrow>
            <h2 id="features-heading" className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
              Everything a one-person training business actually runs on.
            </h2>
          </Reveal>

          <div className="mt-4 divide-y divide-gray-100">
            {FEATURES.map((f, i) => (
              <FeatureBlock key={f.id} feature={f} index={i} />
            ))}
          </div>
        </Section>

        {/* ── How it works ── */}
        <Section id="how-it-works" className="border-y border-gray-100 bg-gray-50 py-16 sm:py-20" labelledBy="how-heading">
          <Reveal>
            <Eyebrow>How it works</Eyebrow>
            <h2 id="how-heading" className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
              Three steps, and nothing to migrate.
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <ol className="mt-10 grid gap-6 lg:grid-cols-3">
              {[
                ['Create your account', 'Email, a password and your name. You are in — no card, no sales call, no setup wizard to sit through.'],
                ['Add your clients and your training', 'Put in the clients you have now, book the week ahead, and give anyone on a block of sessions their package.'],
                ['Run it from one place', 'Sessions, packages, payments and progress stay together and keep themselves current as you work.'],
              ].map(([title, body], i) => (
                <li key={title} className="rounded-2xl border border-gray-200 bg-white p-6">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-sm font-black text-white">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 text-base font-bold text-gray-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
                </li>
              ))}
            </ol>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-10">
              <PrimaryCta signedIn={signedIn} />
            </div>
          </Reveal>
        </Section>

        {/* ── Why TRENIKO ── */}
        <Section id="for-trainers" className="py-16 sm:py-20" labelledBy="trainers-heading">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <Eyebrow>Why TRENIKO</Eyebrow>
              <h2 id="trainers-heading" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
                Not a gym system with the gym removed.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                TRENIKO is built for the trainer who is also the business: you take the bookings, you
                chase the payments, you remember whose package is running out. Every screen is shaped
                around that one job — which is why there is no membership billing, no front desk and
                no class-booking portal to configure before you can add your first client.
              </p>
              <p className="mt-4 text-base leading-relaxed text-gray-600">
                The measure we hold it to is simple: less time on admin, more time coaching.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  ['Less admin', 'Packages count themselves down, alerts arrive before a client runs out, and payments sit next to the sessions they cover.'],
                  ['Everything in one place', 'One client, one record: sessions, packages, payments, progress and notes.'],
                  ['Simple on purpose', 'The fields you use every week are on the first screen. Nothing has to be configured before it works.'],
                  ['Wherever you work', 'A responsive web app — phone between sessions, laptop in the evening. Nothing to install.'],
                  ['In your language', 'The interface is available in English, Croatian and German.'],
                  ['Your data stays yours', 'Export everything you have entered at any time, and delete the account outright if you want to leave.'],
                ].map(([title, body]) => (
                  <li key={title} className="rounded-2xl border-l-4 border-sky-500 bg-sky-50/60 py-4 pl-5 pr-5">
                    <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{body}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Section>

        {/* ── Pricing ──
            There is no payment processor anywhere in the codebase, so no amount
            shown here could be charged even if a visitor wanted to pay it. The
            plans table seeds Pro at EUR 29, and publishing that as a public
            price would advertise a purchase that cannot be made. The section
            says exactly what a new account gets today and is plain about the
            rest. */}
        <Section id="pricing" className="border-y border-gray-100 bg-gray-50 py-16 sm:py-20" labelledBy="pricing-heading">
          <Reveal>
            <Eyebrow>Pricing</Eyebrow>
            <h2 id="pricing-heading" className="mt-3 max-w-2xl text-2xl font-black tracking-tight sm:text-3xl">
              Free while TRENIKO is early.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-600">
              Creating an account puts you on the free plan. There is no billing in the product yet,
              so there is nothing to pay and no card to enter.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border-2 border-sky-500 bg-white p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-wrap items-baseline gap-3">
                  <h3 className="text-lg font-black text-gray-900">Free</h3>
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">Available now</span>
                </div>
                <p className="mt-1 text-4xl font-black text-gray-900">
                  €0<span className="text-base font-semibold text-gray-500"> / month</span>
                </p>
                <p className="mt-1 text-sm text-gray-500">No credit card required.</p>

                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {[
                    'Up to 5 clients',
                    'Up to 20 sessions per month',
                    'Session packages and alerts',
                    'Payment records and billing summary',
                    'Groups and group sessions',
                    'Progress tracking',
                    'Training plans and exercise library',
                    'Data export and account deletion',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Icon path={ICONS.check} className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-500" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-7">
                  <PrimaryCta signedIn={signedIn} />
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6">
                <h3 className="text-lg font-black text-gray-900">Larger plans</h3>
                <p className="mt-1 text-sm font-semibold text-gray-500">Not available to buy yet</p>
                <p className="mt-4 text-sm leading-relaxed text-gray-600">
                  Higher client limits are built into the product, but there is no checkout, so we are
                  not going to put a price on this page and pretend otherwise. If you are already past
                  five clients and want to use TRENIKO, start on the free plan and email us — we would
                  rather hear from you than guess.
                </p>
                <a
                  href="mailto:info@treniko.com"
                  className="mt-5 inline-flex items-center justify-center rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  info@treniko.com
                </a>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ── FAQ ── */}
        <Section id="faq" className="py-16 sm:py-20" labelledBy="faq-heading">
          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 id="faq-heading" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              Questions worth answering before you sign up.
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {[
                ['What is TRENIKO?', 'Training management software for personal trainers. It keeps your clients, sessions, packages, payments, progress and training plans in one workspace instead of spread across a phone, a calendar and a spreadsheet.'],
                ['Who is it for?', 'Independent personal trainers and small training businesses — the people who coach and run the business themselves. If a notebook still works for you, you probably do not need this yet.'],
                ['Can I manage my clients?', 'Yes. Each client gets a profile with their goals, private notes and full history. Clients who pause can be archived without losing their record.'],
                ['Can I schedule training sessions?', 'Yes, one-to-one and as groups. Sessions can be marked completed, cancelled or a no-show, so your history reflects what actually happened.'],
                ['Can I track packages and payments?', 'Yes. A session package counts down automatically as sessions are completed and warns you when a client has two or fewer left. Payments are recorded against the client with an amount, a method and a paid or pending status, plus a billing summary.'],
                ['Can I track client progress?', 'Yes. Measurements are recorded against a client over time, so a check-in starts from the record rather than from memory.'],
                ['Is TRENIKO free?', 'The free plan is free and covers up to 5 clients and 20 sessions a month. Larger plans exist in the product but cannot be bought yet, so nothing on this site charges you.'],
                ['Do I need a credit card?', 'No. There is no payment processor in the product at all, so you are never asked for card details.'],
                ['Can I use it on my phone?', 'Yes. TRENIKO is a responsive web app, so it runs in the browser on a phone, tablet or laptop with nothing to install.'],
                ['Does it support multiple languages?', 'The interface is available in English, Croatian and German. This website is in English only.'],
                // The two questions a trainer entering client data actually
                // worries about, and TRENIKO can answer both concretely because
                // both features exist and work today (routes/export.js and
                // routes/deletion.js). Most competitors cannot answer this as
                // directly, which makes it worth saying plainly rather than
                // burying it in the privacy policy.
                ['Can I get my data out, or delete it?', 'Yes, both, and you can do either without asking us. Export downloads everything you have entered — clients, sessions, packages, payments and progress. Account deletion removes your account and the client records that belong to it. Neither is a support request and neither costs anything.'],
                ['Who is behind TRENIKO?', 'TRENIKO is built and run independently, in Croatia. It is early — there are no customer numbers or reviews anywhere on this site, because there are none worth quoting yet. If you have a question, info@treniko.com reaches a person who will answer it.'],
              ].map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-gray-200 bg-white p-5 transition-colors open:bg-gray-50/70">
                  <summary className="cursor-pointer list-none text-sm font-bold text-gray-900 marker:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                    <span className="flex items-start justify-between gap-4">
                      {q}
                      <Icon
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                        path={ICONS.chevron}
                      />
                    </span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-gray-600">{a}</p>
                </details>
              ))}
            </div>
          </Reveal>
        </Section>

        {/* ── Final CTA ── */}
        <Section className="pb-20 pt-4" labelledBy="cta-heading">
          <Reveal>
            <div className="rounded-3xl bg-gray-900 px-6 py-14 text-center sm:px-12 sm:py-16">
              <h2 id="cta-heading" className="mx-auto max-w-2xl text-2xl font-black tracking-tight text-white sm:text-4xl">
                Spend less time managing your training business.
                <span className="block text-sky-400">Spend more time coaching.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-300">
                Start with the clients you have now. Adding one and booking a session takes a couple
                of minutes, and that is enough to tell whether TRENIKO fits how you work.
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
          </Reveal>
        </Section>

        {/* ── Guides and free resources ──────────────────────────────────────
            Deliberately below the final CTA, not above it: this is for the
            visitor who has just decided not to sign up today. They came from a
            search, they have a real problem, and a link to something useful is
            worth more than a second attempt at the same button.

            It is also the homepage's only editorial link into the content
            cluster. Everything else pointing there lives in the footer, and a
            footer link is worth close to nothing — to a reader because nobody
            reads it, and to a crawler because it appears identically on every
            page. Plain anchors, not router Links: these are static HTML pages
            served off disk, so a client-side navigation would ask the router
            for a route that does not exist. */}
        <Section className="pb-20" labelledBy="learn-heading">
          <Reveal>
            <h2 id="learn-heading" className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Free to read, nothing to sign up for
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [
                  '/free-personal-trainer-client-tracker',
                  'Free client & session tracker',
                  'An Excel and Google Sheets template where the remaining-session count works itself out.',
                ],
                [
                  '/guides/session-packages',
                  'How to track packages and sessions left',
                  'Why the count drifts, and the one rule that keeps it honest.',
                ],
                [
                  '/guides/cancellation-policy',
                  'Writing a cancellation policy that holds',
                  'The four things it has to decide, and where the 24-hour rule breaks.',
                ],
                [
                  '/guides/pricing-personal-training-packages',
                  'Pricing personal training packages',
                  'The unpaid hours to count first, and what a discount actually buys.',
                ],
                [
                  '/guides/software-vs-spreadsheets',
                  'Personal trainer software vs spreadsheets',
                  'An honest comparison, including where the spreadsheet still wins.',
                ],
                [
                  '/guides',
                  'All guides',
                  'The business side of personal training — clients, sessions, money, admin.',
                ],
              ].map(([href, title, blurb]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-2xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                >
                  <h3 className="text-sm font-bold text-gray-900">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{blurb}</p>
                </a>
              ))}
            </div>
          </Reveal>
        </Section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 bg-white px-5 py-12 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Wordmark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-gray-600">
              Training management software for personal trainers. Clients, sessions, packages and
              payments in one place — less admin, more coaching.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="https://www.instagram.com/treniko_fitness/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TRENIKO on Instagram"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <Icon path={ICONS.instagram} />
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61593112186107"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TRENIKO on Facebook"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <Icon path={ICONS.facebook} />
              </a>
            </div>
          </div>

          <nav aria-label="Product" className="text-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Product</h2>
            <ul className="mt-4 space-y-2.5">
              <li><a href="#features" className="text-gray-600 hover:text-gray-900">Features</a></li>
              <li><a href="#how-it-works" className="text-gray-600 hover:text-gray-900">How it works</a></li>
              <li><a href="#for-trainers" className="text-gray-600 hover:text-gray-900">For trainers</a></li>
              <li><a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a></li>
              <li><a href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</a></li>
            </ul>
          </nav>

          <nav aria-label="Guides" className="text-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Learn</h2>
            <ul className="mt-4 space-y-2.5">
              {/* Plain anchors, not react-router Links: these are static HTML
                  pages served off disk, not SPA routes. A client-side
                  navigation would ask the router for a route that does not
                  exist. A real navigation is also what lets a crawler see them
                  as separate documents. */}
              <li>
                <a href="/personal-trainer-software" className="text-gray-600 hover:text-gray-900">
                  Personal trainer software
                </a>
              </li>
              <li>
                <a
                  href="/personal-trainer-client-management-software"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Client management software
                </a>
              </li>
              <li>
                <a href="/guides/client-management" className="text-gray-600 hover:text-gray-900">
                  Managing clients
                </a>
              </li>
              <li>
                <a href="/guides/session-packages" className="text-gray-600 hover:text-gray-900">
                  Packages &amp; sessions
                </a>
              </li>
              <li>
                <a href="/guides/software-vs-spreadsheets" className="text-gray-600 hover:text-gray-900">
                  Software vs spreadsheets
                </a>
              </li>
              <li>
                <a
                  href="/free-personal-trainer-client-tracker"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Free session tracker
                </a>
              </li>
              <li>
                <a href="/guides" className="text-gray-600 hover:text-gray-900">All guides</a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Account and legal" className="text-sm">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Account</h2>
            <ul className="mt-4 space-y-2.5">
              <li><Link to="/login" className="text-gray-600 hover:text-gray-900">Log in</Link></li>
              <li><Link to="/register" className="text-gray-600 hover:text-gray-900">Start for free</Link></li>
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
