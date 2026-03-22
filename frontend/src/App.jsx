import CookieBanner from './components/CookieBanner';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './pages/DashboardLayout';
import Calendar from './pages/Calendar';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import SubscriptionPage from './pages/SubscriptionPage';
import ProfilePage from './pages/ProfilePage';
import Toast from './components/Toast';
import CalendarPage from './pages/CalendarPage';
import TrainingsPage from './pages/TrainingsPage';
import TrainingDetailPage from './pages/TrainingDetailPage';
import PackagesPage from './pages/PackagesPage';
import DashboardPage from './pages/DashboardPage';
import ExercisesPage from './pages/ExercisesPage';
import GroupsPage  from './pages/GroupsPage';
import GroupDetail from './pages/GroupDetail';
function App() {
  return (
    <AuthProvider>
        <Toast />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route index element={<Navigate to="/dashboard/calendar" replace />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="subscription" element={<SubscriptionPage />} />
            <Route path="packages" element={<PackagesPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="trainings" element={<TrainingsPage />} />
            <Route path="trainings/:id" element={<TrainingDetailPage />} />
            <Route path="calendar-new" element={<CalendarPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="groups"     element={<GroupsPage />} />
            <Route path="groups/:id" element={<GroupDetail />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes>
      <CookieBanner />
<CookieBanner />
</BrowserRouter>
    </AuthProvider>
  );
}

export default App;
