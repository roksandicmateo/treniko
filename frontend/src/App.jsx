import CookieBanner from './components/CookieBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import DashboardLayout from './pages/DashboardLayout';
import Calendar from './pages/Calendar';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import SubscriptionPage from './pages/SubscriptionPage';
import ProfilePage from './pages/ProfilePage';
import Toast from './components/Toast';
import TrainingsPage from './pages/TrainingsPage';
import TrainingDetailPage from './pages/TrainingDetailPage';
import PackagesPage from './pages/PackagesPage';
import DashboardPage from './pages/DashboardPage';
import ExercisesPage from './pages/ExercisesPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetail from './pages/GroupDetail';
import GroupSessionDetail from './pages/GroupSessionDetail';
import ProgressPage from './pages/ProgressPage';

// ── Platform administration ──────────────────────────────────────────────────
// A separate authentication realm from the trainer app: staff accounts live in
// `platform_admins` and authenticate against /api/admin/auth/login. The provider
// is mounted only around the /admin subtree so a trainer page never carries an
// admin session, and vice versa.
import { AdminAuthProvider } from './context/AdminAuthContext';
import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTrainers from './pages/admin/AdminTrainers';
import AdminTrainerDetail from './pages/admin/AdminTrainerDetail';
import { AdminClients, AdminSubscriptions, AdminSessions } from './pages/admin/AdminTenantViews';
import AdminActivity from './pages/admin/AdminActivity';
import AdminSystem from './pages/admin/AdminSystem';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toast />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
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

            <Route path="/"  element={<Navigate to="/dashboard" replace />} />
            <Route path="*"  element={<NotFoundPage />} />
          </Routes>
          <CookieBanner />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
