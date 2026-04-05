import CookieBanner from './components/CookieBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
