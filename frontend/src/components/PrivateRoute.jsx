import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

// ── Email verification: reminded, not enforced ───────────────────────────────
//
// This route used to send anyone whose `emailVerified` was false to
// /check-email, which is a dead end: a message saying "click the link in the
// email" and a button back to the login screen. Two things made that a
// launch blocker rather than a normal verification step.
//
// 1. The link only exists if outbound email is configured. The mail service
//    sends through the Brevo HTTP API and does nothing at all without
//    BREVO_API_KEY (backend/services/emailService.js logs "[Email DISABLED]"
//    and returns). With no key set — the state this deployment is in — a
//    trainer who signs up is told to check an inbox that will never receive
//    anything, and there is no resend, no support link and no way through.
//
// 2. The gate did not actually hold. Registration and login return
//    `emailVerified`, but /auth/validate did not, so the field was undefined
//    after any page reload, `undefined === false` is false, and the user was
//    let straight in. Verified by hand: blocked immediately after signing up,
//    admitted after pressing refresh. (/auth/validate now returns the field,
//    so the value is at least consistent.)
//
// So the choice was between a gate that locks every new trainer out and a gate
// that anyone can walk around by reloading. Neither is worth shipping. The
// product now admits unverified accounts and asks for verification with a
// banner in the dashboard header (see VerifyEmailBanner), which is what the
// state was in practice already.
//
// To enforce verification again — after outbound email is configured AND a
// resend path exists — set this to true. That is the whole change.
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
