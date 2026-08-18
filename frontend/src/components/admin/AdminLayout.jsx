import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

/**
 * Chrome for the administration panel.
 *
 * Visually a sibling of the trainer dashboard — same primary (#0ea5e9 via
 * `primary-*`), same rounded cards, same badges, same type — but deliberately
 * not identical: the dark sidebar and the STAFF marker exist so nobody has to
 * wonder which product they are looking at. Confusing the admin panel with the
 * trainer app is how someone edits the wrong thing.
 *
 * Desktop-first, as the brief allows, but the sidebar collapses into a drawer
 * below `lg` so the panel stays usable on a tablet or a phone.
 */

const NAV = [
  { to: '/admin', end: true, label: 'Dashboard' },
  { to: '/admin/trainers', label: 'Trainers' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/subscriptions', label: 'Subscriptions' },
  { to: '/admin/sessions', label: 'Sessions' },
  { to: '/admin/activity', label: 'Activity' },
  { to: '/admin/system', label: 'System' },
];

const ROLE_BADGE = {
  owner: 'badge-blue',
  admin: 'badge-green',
  viewer: 'badge-gray',
};

const AdminLayout = () => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  const links = (
    <nav className="space-y-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary-500 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 h-14 bg-gray-900 text-white">
        <div className="flex items-center gap-2">
          <span className="font-black tracking-widest text-primary-400 text-sm">TRENIKO</span>
          <span className="badge bg-gray-800 text-gray-300 text-[10px]">STAFF</span>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="text-sm px-3 py-1.5 rounded-lg bg-gray-800">
          {open ? 'Close' : 'Menu'}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-gray-900 px-4 pb-4">
          {links}
          <button onClick={signOut} className="w-full mt-3 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-gray-200">
            Log out
          </button>
        </div>
      )}

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col w-60 min-h-screen bg-gray-900 px-4 py-6 shrink-0">
          <div className="px-2 mb-8">
            <div className="font-black tracking-widest text-primary-400">TRENIKO</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-gray-400">Admin panel</span>
              <span className="badge bg-gray-800 text-gray-300 text-[10px]">STAFF</span>
            </div>
          </div>

          {links}

          <div className="mt-auto pt-6 border-t border-gray-800">
            {admin && (
              <div className="px-2 mb-3">
                <p className="text-sm text-gray-200 truncate">{admin.firstName} {admin.lastName}</p>
                <p className="text-xs text-gray-500 truncate" title={admin.email}>{admin.email}</p>
                <span className={`${ROLE_BADGE[admin.role] || 'badge-gray'} mt-2 inline-block`}>
                  {admin.role}
                </span>
              </div>
            )}
            <button
              onClick={signOut}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-800 text-gray-200 hover:bg-gray-700 transition-colors"
            >
              Log out
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/** Consistent page heading. */
export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">{subtitle}</p>}
    </div>
    {children}
  </div>
);

/** A single number on a card. `hint` carries the caveat, if there is one. */
export const StatCard = ({ label, value, hint }) => (
  <div className="card p-5">
    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
    <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
    {hint && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>}
  </div>
);

export default AdminLayout;
