import { lazy, Suspense } from 'react';
import CookieBanner from './components/CookieBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import VerifyEmail from './pages/VerifyEmail';
import CheckEmail from './pages/CheckEmail';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import Toast from './components/Toast';

// ── Public marketing surface ─────────────────────────────────────────────────
// `/` is the landing page rather than a redirect into the app. RouteMeta keeps
// the document head honest as the route changes: indexable on the public pages,
// `noindex, nofollow` everywhere else. See src/seo/RouteMeta.jsx.
import Landing from './pages/Landing';
import RouteMeta from './seo/RouteMeta';

// ── Platform administration ──────────────────────────────────────────────────
// A separate authentication realm from the trainer app: staff accounts live in
// `platform_admins` and authenticate against /api/admin/auth/login. The provider
// is mounted only around the /admin subtree so a trainer page never carries an
// admin session, and vice versa.
import { AdminAuthProvider } from './context/AdminAuthContext';
import AdminRoute from './components/admin/AdminRoute';


// ── Code splitting ───────────────────────────────────────────────────────────
// `/` is now a public landing page, so the first request an anonymous visitor
// makes decides how the product feels. Everything below is reachable only after
// a login (or an admin login), and some of it is heavy — FullCalendar and
// recharts between them are most of the bundle. Loading it lazily keeps it out
// of the landing page's critical path; it is fetched the moment a route that
// needs it is entered.
//
// Login, Register and the legal pages stay eager: they are one click from the
// landing page and small enough that a second round trip would cost more than
// the bytes saved.
const DashboardLayout     = lazy(() => import('./pages/DashboardLayout'));
const DashboardPage       = lazy(() => import('./pages/DashboardPage'));
const Calendar            = lazy(() => import('./pages/Calendar'));
const Clients             = lazy(() => import('./pages/Clients'));
const ClientDetail        = lazy(() => import('./pages/ClientDetail'));
const SubscriptionPage    = lazy(() => import('./pages/SubscriptionPage'));
const ProfilePage         = lazy(() => import('./pages/ProfilePage'));
const TrainingsPage       = lazy(() => import('./pages/TrainingsPage'));
const TrainingDetailPage  = lazy(() => import('./pages/TrainingDetailPage'));
const PackagesPage        = lazy(() => import('./pages/PackagesPage'));
const ExercisesPage       = lazy(() => import('./pages/ExercisesPage'));
const GroupsPage          = lazy(() => import('./pages/GroupsPage'));
const GroupDetail         = lazy(() => import('./pages/GroupDetail'));
const GroupSessionDetail  = lazy(() => import('./pages/GroupSessionDetail'));
const ProgressPage        = lazy(() => import('./pages/ProgressPage'));
const PrivacyPage         = lazy(() => import('./pages/PrivacyPage'));
const TermsPage           = lazy(() => import('./pages/TermsPage'));

const AdminLayout         = lazy(() => import('./components/admin/AdminLayout'));
const AdminLogin          = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard      = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminTrainers       = lazy(() => import('./pages/admin/AdminTrainers'));
const AdminTrainerDetail  = lazy(() => import('./pages/admin/AdminTrainerDetail'));
const AdminActivity       = lazy(() => import('./pages/admin/AdminActivity'));
const AdminSystem         = lazy(() => import('./pages/admin/AdminSystem'));
const AdminClients        = lazy(() => import('./pages/admin/AdminTenantViews').then(m => ({ default: m.AdminClients })));
const AdminSubscriptions  = lazy(() => import('./pages/admin/AdminTenantViews').then(m => ({ default: m.AdminSubscriptions })));
const AdminSessions       = lazy(() => import('./pages/admin/AdminTenantViews').then(m => ({ default: m.AdminSessions })));

/** Shown only while a route chunk is in flight. */
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500" />
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toast />
        <BrowserRouter>
          <RouteMeta />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/"                 element={<ErrorBoundary><Landing /></ErrorBoundary>} />
            <Route path="/login"            element={<Login />} />
            <Route path="/register"         element={<Register />} />
            <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
            <Route path="/reset-password"   element={<ResetPasswordPage />} />
            <Route path="/verify-email"      element={<VerifyEmail />} />
            <Route path="/check-email"       element={<CheckEmail />} />
            <Route path="/privacy"          element={<PrivacyPage />} />
            <Route path="/terms"            element={<TermsPage />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <DashboardLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="calendar"     element={<ErrorBoundary><Calendar /></ErrorBoundary>} />
              <Route path="clients"      element={<ErrorBoundary><Clients /></ErrorBoundary>} />
              <Route path="clients/:id"  element={<ErrorBoundary><ClientDetail /></ErrorBoundary>} />
              <Route path="subscription" element={<ErrorBoundary><SubscriptionPage /></ErrorBoundary>} />
              <Route path="packages"     element={<ErrorBoundary><PackagesPage /></ErrorBoundary>} />
              <Route path="profile"      element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
              <Route path="trainings"    element={<ErrorBoundary><TrainingsPage /></ErrorBoundary>} />
              <Route path="trainings/:id" element={<ErrorBoundary><TrainingDetailPage /></ErrorBoundary>} />
              <Route path="exercises"    element={<ErrorBoundary><ExercisesPage /></ErrorBoundary>} />
              <Route path="groups"       element={<ErrorBoundary><GroupsPage /></ErrorBoundary>} />
              <Route path="groups/:id"   element={<ErrorBoundary><GroupDetail /></ErrorBoundary>} />
              <Route path="groups/:groupId/sessions/:sessionId" element={<ErrorBoundary><GroupSessionDetail /></ErrorBoundary>} />
              <Route path="progress"     element={<ErrorBoundary><ProgressPage /></ErrorBoundary>} />
            </Route>

            {/* Default redirects */}
            {/* ── Admin panel ───────────────────────────────────────────────
                Wrapped in its own provider so the admin session is scoped to
                this subtree. AdminRoute is navigation only — every byte shown
                comes from /api/admin/*, which re-verifies the staff token and
                re-reads the role from the database on every request. */}
            <Route
              path="/admin/login"
              element={
                <AdminAuthProvider>
                  <ErrorBoundary><AdminLogin /></ErrorBoundary>
                </AdminAuthProvider>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminAuthProvider>
                  <AdminRoute><ErrorBoundary><AdminLayout /></ErrorBoundary></AdminRoute>
                </AdminAuthProvider>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="trainers" element={<AdminTrainers />} />
              <Route path="trainers/:id" element={<AdminTrainerDetail />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="sessions" element={<AdminSessions />} />
              <Route path="activity" element={<AdminActivity />} />
              <Route path="system" element={<AdminSystem />} />
            </Route>

            {/* `/` used to redirect here. It now renders the landing page above,
                so the dashboard keeps its own address and every bookmark, deep
                link and post-login redirect that already points at /dashboard
                continues to work unchanged. */}
            <Route path="*"  element={<NotFoundPage />} />
          </Routes>
          </Suspense>
          <CookieBanner />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
