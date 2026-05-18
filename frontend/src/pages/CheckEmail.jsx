import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CheckEmail = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100 dark:border-gray-800">
        <div className="text-5xl mb-4">📬</div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Check your email</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-2">
          We sent a verification link to
        </p>
        <p className="font-semibold text-gray-800 dark:text-gray-200 mb-6">{user?.email}</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
          Click the link in the email to activate your account. Check your spam folder if you don't see it.
        </p>
        <button onClick={handleLogout} className="btn-secondary px-6 py-2.5 w-full">
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default CheckEmail;
