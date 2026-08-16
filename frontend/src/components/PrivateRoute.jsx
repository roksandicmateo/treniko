import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

// ── Email verification: reminded, not enforced ───────────────────────────────
//
// This route used to send anyone whose `emailVerified` was false to
// /check-email, which is a dead end: a message saying "click the link in the
// email" and a button back to the login screen. Two things were wrong with it.
//
// 1. The gate did not actually hold. Registration and login return
//    `emailVerified`, but /auth/validate did not, so the field was undefined
//    after any page reload, `undefined === false` is false, and the user was
//    let straight in. Verified by hand: blocked immediately after signing up,
//    admitted after pressing refresh. A gate a reload defeats only
//    inconveniences the honest. (/auth/validate now returns the field, so the
//    value is at least consistent.)
//
// 2. There is no way through it for anyone the mail does not reach. Production
//    does send the message — Brevo is configured there, and
//    backend/services/emailService.js sends whenever BREVO_API_KEY is present
//    (local development runs without it and logs "[Email DISABLED]", which is
//    deliberate). But a trainer whose message lands in spam, or who mistyped
//    their address at signup, cannot correct the address and cannot request
//    another send: there is no resend endpoint and no button.
//
// So the product admits unverified accounts and asks for verification with a
// banner instead (see VerifyEmailBanner) — which is what the behaviour amounted
// to in practice already, given point 1.
//
// This is now a product decision rather than a forced one. To enforce
// verification again, set this to true; build the resend path first, or the
// accounts the mail never reached have nowhere to go.
const ENFORCE_EMAIL_VERIFICATION = false;

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (ENFORCE_EMAIL_VERIFICATION && user.emailVerified === false) {
    return <Navigate to="/check-email" replace />;
  }

  return children;
};

export default PrivateRoute;
