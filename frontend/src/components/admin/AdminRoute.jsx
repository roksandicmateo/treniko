import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

/**
 * Gate for every /admin page except the login screen.
 *
 * ── What this does and does not guarantee ───────────────────────────────────
 * This is a NAVIGATION control, not a security control. It stops a signed-out
 * person from landing on a broken screen and sends them somewhere sensible. It
 * is not what keeps administration data safe.
 *
 * What keeps the data safe is that every byte on these pages arrives from
 * `/api/admin/*`, and every one of those endpoints independently verifies the
 * bearer token against `platform_admins`, checks the account is active and
 * unlocked, and re-reads the role from the database. A trainer's token is
 * refused there with 403 before any query runs. Deleting this component would
 * make the panel ugly; it would not leak a single row.
 *
 * That is deliberate, and it is why the tests assert the API refusal as well as
 * the redirect.
 */
const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAdminAuth();
  const location = useLocation();

  // Never flash a redirect while the stored session is still being revalidated
  // against /auth/me — that would bounce a perfectly valid admin to the login
  // screen on every refresh.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // `replace` so the guarded URL does not sit in history behind the login
    // page; `state.from` so we can return there after signing in.
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
};

export default AdminRoute;
