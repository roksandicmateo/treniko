import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(formData.email, formData.password);
    if (result.success) { navigate('/dashboard'); }
    else { setError(result.error || t('auth.loginError')); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-700 dark:from-gray-900 dark:to-gray-950 px-4">
      {/* Language selector top right */}
      <div className="absolute top-4 right-4">
        <LanguageSelector compact />
      </div>

      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-panel border border-gray-100 dark:border-gray-800 p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-500 mb-2 tracking-tight">TRENIKO</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('auth.signIn')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('auth.email')}
            </label>
            <input type="email" id="email" name="email" value={formData.email}
              onChange={handleChange} required className="input" placeholder="you@example.com" />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('auth.password')}
            </label>
            <input type="password" id="password" name="password" value={formData.password}
              onChange={handleChange} required className="input" placeholder="••••••••" />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Demo: <span className="font-medium text-gray-500 dark:text-gray-400">demo@treniko.com</span> / password123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
