import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DpaAcceptanceModal from '../components/DpaAcceptanceModal';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SubscriptionBanner from '../components/SubscriptionBanner';
import VerifyEmailBanner from '../components/VerifyEmailBanner';
import ProfileMenu from '../components/ProfileMenu';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon';

const DashboardLayout = () => {
  const { user } = useAuth();
  const { mode, isDark, toggle } = useTheme();
  const { t } = useTranslation();
  const [dpaAccepted, setDpaAccepted] = useState(true);
  const [dpaLoading,  setDpaLoading]  = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkDpa = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/dpa-status`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDpaAccepted(res.data.dpa_accepted);
      } catch {
        setDpaAccepted(false);
      } finally {
        setDpaLoading(false);
      }
    };
    if (user) checkDpa();
    else setDpaLoading(false);
  }, [user]);

  // ── What sits in the navigation ────────────────────────────────────────────
  // Eight top-level destinations made a focused tool look like eight products.
  // Four of them are the business: today, the calendar, the clients and the
  // packages they buy. The rest — the exercise library, the workout log, the
  // progress charts — are about writing training, which is a different job and
  // one every screen reaches through a client anyway (their own tabs on the
  // client page). They keep their routes and their place in the "More" menu;
  // nothing was removed, and nothing is unreachable.
  const PRIMARY_NAV = [
    { to: '/dashboard',          label: t('nav.dashboard'), icon: 'home' },
    { to: '/dashboard/calendar', label: t('nav.calendar'),  icon: 'calendar' },
    { to: '/dashboard/clients',  label: t('nav.clients'),   icon: 'clients' },
    { to: '/dashboard/packages', label: t('nav.packages'),  icon: 'packages' },
  ];

  const SECONDARY_NAV = [
    { to: '/dashboard/groups',    label: t('nav.groups'),    icon: 'groups' },
    { to: '/dashboard/trainings', label: t('nav.trainings'), icon: 'dumbbell' },
    { to: '/dashboard/exercises', label: t('nav.exercises'), icon: 'play' },
    { to: '/dashboard/progress',  label: t('nav.progress'),  icon: 'chart' },
  ];

  const allNavItems = [...PRIMARY_NAV, ...SECONDARY_NAV];

  // ── Mobile navigation ───────────────────────────────────────────────────────
  // The bottom bar used to be a fixed list of six destinations, and Groups and
  // Exercises appeared only in the desktop nav — which is display:none on a
  // phone. Both pages existed, both were routed, and neither could be reached
  // on a 386px screen by any means other than typing the URL.
  //
  // Six tabs was already the most that fits (367px of a 386px viewport); eight
  // does not, and a horizontally scrolling tab bar hides destinations just as
  // effectively as omitting them. So the bar carries four primary destinations
  // plus a "More" sheet holding the rest, which is the standard resolution and
  // keeps every route one tap away.
  //
  // `moreNavItems` is derived by subtraction, so a destination added to
  // allNavItems can never again be silently unreachable on mobile: if it is not
  // a primary tab it appears in the sheet.
  const bottomNavItems = PRIMARY_NAV;
  const moreNavItems   = SECONDARY_NAV;

  const [moreOpen, setMoreOpen] = useState(false);
  const routerLocation = useLocation();
  // Close the sheet on navigation — otherwise it stays over the page it just
  // opened.
  useEffect(() => { setMoreOpen(false); }, [routerLocation.pathname]);

  const moreIsActive = moreNavItems.some(i => routerLocation.pathname.startsWith(i.to));

  if (dpaLoading) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {!dpaAccepted && <DpaAcceptanceModal onAccepted={() => setDpaAccepted(true)} />}

      {/* ── Header ── */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-xl sm:text-2xl font-bold text-primary-500 tracking-tight">TRENIKO</h1>
            <div className="flex items-center gap-1.5">
              {/* Language and theme both live in the header, on every screen
                  size. The language picker used to be `hidden sm:block`, so on
                  a phone — where most of this product is used — it was not in
                  the header at all. */}
              <LanguageSelector compact />

              {/* Light → dark → follow the device, in one control. The label
                  says which mode is active rather than which icon is showing,
                  because "sun" alone does not tell you whether you chose light
                  or your phone did. */}
              <button
                onClick={toggle}
                aria-label={`${t('profile.theme')}: ${
                  mode === 'system' ? t('profile.themeSystem')
                    : mode === 'dark' ? t('profile.themeDark')
                    : t('profile.themeLight')
                }`}
                title={
                  mode === 'system' ? t('profile.themeSystem')
                    : mode === 'dark' ? t('profile.themeDark')
                    : t('profile.themeLight')
                }
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <Icon name={mode === 'system' ? 'screen' : isDark ? 'moon' : 'sun'} className="h-[18px] w-[18px]" />
              </button>
              <ProfileMenu />
            </div>
          </div>
        </div>
      </header>

      {/* ── Desktop top nav (hidden on mobile) ── */}
      <nav className="hidden sm:block bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-0 overflow-x-auto">
            {PRIMARY_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-200 dark:hover:border-gray-700'
                  }`
                }
              >
                <Icon name={item.icon} className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </NavLink>
            ))}

            {/* The training-writing side of the product, one click away rather
                than competing with the four destinations the business runs on. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen(o => !o)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  moreIsActive
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-200 dark:hover:border-gray-700'
                }`}
              >
                <Icon name="more" className="h-[18px] w-[18px]" />
                <span>{t('nav.more')}</span>
              </button>

              {moreOpen && (
                <div
                  role="menu"
                  className="absolute left-0 top-full z-50 w-56 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
                >
                  {SECONDARY_NAV.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-gray-800'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`
                      }
                    >
                      <Icon name={item.icon} className="h-[18px] w-[18px]" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main content ── */}
      {/*
        Nothing below the DPA modal is rendered until the agreement is
        accepted. It used to render underneath, so every page mounted and
        fetched while the API was still answering 403 dpa_required for this
        tenant — and none of them retried afterwards. The visible result on a
        brand new account was a dashboard whose four headline figures all read
        "—" and an onboarding checklist that never appeared, immediately after
        signup, until the trainer happened to navigate away and back.

        The modal already states that Treniko cannot be used without accepting,
        so there is nothing behind it worth loading.
      */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 sm:pb-8">
        {dpaAccepted && (
          <>
            <VerifyEmailBanner />
            <SubscriptionBanner />
            <Outlet />
          </>
        )}
      </main>

      {/* ── Mobile "More" sheet ── */}
      {/* Shares `moreOpen` with the desktop dropdown above; `sm:hidden` keeps
          exactly one of the two visible at any width. */}
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-50" role="dialog" aria-modal="true"
             aria-label={t('nav.more')}>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl border-t border-gray-100 dark:border-gray-800 p-2 pb-6 safe-area-pb">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            {moreNavItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-primary-500 dark:text-primary-400 bg-primary-50 dark:bg-gray-800'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`
                }
              >
                <Icon name={item.icon} className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 z-40 safe-area-pb transition-colors duration-200">
        <div className="flex">
          {bottomNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 pt-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-primary-500 dark:text-primary-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={item.icon} className={`h-5 w-5 mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  <span className={isActive ? 'font-semibold' : ''}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
            className={`flex-1 flex flex-col items-center justify-center py-2 pt-3 text-xs font-medium transition-colors ${
              moreIsActive || moreOpen
                ? 'text-primary-500 dark:text-primary-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <Icon name="more" className="h-5 w-5 mb-0.5" />
            <span className={moreIsActive || moreOpen ? 'font-semibold' : ''}>{t('nav.more')}</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default DashboardLayout;
