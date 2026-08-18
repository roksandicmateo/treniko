import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

/**
 * Staff sign-in for the administration panel.
 *
 * A separate screen from the trainer login on purpose. These credentials live
 * in `platform_admins` and authenticate against `POST /api/admin/auth/login`;
 * a trainer's email and password will not work here, and an administrator's
 * will not work on the trainer login. Making that visible prevents the support
 * ticket where someone insists their password is broken.
 *
 * The API answers a wrong password and an unknown address with the same
 * message and the same amount of work, so this screen shows whatever the server
 * says and never tries to be more specific.
 */

/**
 * The path segment to return to after signing in, taken from `location.state.from`.
 *
 * AdminRoute sets that value from `location.pathname`, so it is not
 * attacker-supplied today — but it is still a variable, and handing a whole
 * variable to `navigate()` is the shape of an open redirect. One refactor that
 * lets a query parameter reach this state is all it takes.
 *
 * So the value is never used as a target. Only the part AFTER `/admin/` is
 * taken, it must match a conservative path charset, and the caller rebuilds the
 * URL from a hardcoded `/admin/` prefix. The result cannot leave the admin
 * subtree, cannot become protocol-relative (`//evil.example.com`), and cannot
 * carry a backslash or a scheme.
 *
 * routing.security.test.jsx enforces this shape across the whole codebase.
 */
const returnSuffix = (from) => {
  if (typeof from !== 'string') return '';
  const match = /^\/admin\/?([A-Za-z0-9/_-]*)$/.exec(from);
  if (!match) return '';
  return match[1].replace(/^\/+/, '');
};

const AdminLogin = () => {
  const { login, isAuthenticated, loading } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already signed in — never show a login form to someone who does not need it.
  if (isAuthenticated) {
    return <Navigate to={`/admin/${returnSuffix(location.state?.from)}`} replace />;
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const result = await login(email.trim(), password);

    if (result.success) {
      navigate(`/admin/${returnSuffix(location.state?.from)}`, { replace: true });
    } else {
      setError(result.error);
      setPassword('');       // never leave a password sitting in the DOM after a failure
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-black tracking-widest text-primary-400 text-xl">TRENIKO</div>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-sm text-gray-400">Admin panel</span>
            <span className="badge bg-gray-800 text-gray-300 text-[10px]">STAFF</span>
          </div>
        </div>

        <form onSubmit={submit} className="bg-gray-900 rounded-2xl p-6 shadow-xl space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm text-gray-300 mb-1.5">Email</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500"
              placeholder="you@treniko.com"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm text-gray-300 mb-1.5">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400 bg-red-950/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn btn-primary w-full disabled:opacity-60">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          Staff accounts only. Trainer accounts cannot sign in here.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
