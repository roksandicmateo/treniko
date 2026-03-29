import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', businessName: '',
  });
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
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.confirmPassword') + ' does not match');
      setLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }
    const result = await register({
      email: formData.email, password: formData.password,
      firstName: formData.firstName, lastName: formData.lastName,
      businessName: formData.businessName,
    });
    if (result.success) { navigate('/dashboard'); }
    else { setError(result.error); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-700 dark:from-gray-900 dark:to-gray-950 px-4 py-12">
      <div className="absolute top-4 right-4">
        <LanguageSelector compact />
      </div>

      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-panel border border-gray-100 dark:border-gray-800 p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-500 mb-2 tracking-tight">TRENIKO</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('auth.createAccount')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('profile.businessName') || t('auth.businessName')} *</label>
            <input type="text" name="businessName" value={formData.businessName}
              onChange={handleChange} required className="input" placeholder="Your Fitness Studio" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.firstName')} *</label>
              <input type="text" name="firstName" value={formData.firstName}
                onChange={handleChange} required className="input" placeholder="John" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.lastName')} *</label>
              <input type="text" name="lastName" value={formData.lastName}
                onChange={handleChange} required className="input" placeholder="Doe" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.email')} *</label>
            <input type="email" name="email" value={formData.email}
              onChange={handleChange} required className="input" placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.password')} *</label>
            <input type="password" name="password" value={formData.password}
              onChange={handleChange} required className="input" placeholder="••••••••" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('auth.confirmPassword')} *</label>
            <input type="password" name="confirmPassword" value={formData.confirmPassword}
              onChange={handleChange} required className="input" placeholder="••••••••" />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? t('common.loading') : t('auth.createAccount')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
