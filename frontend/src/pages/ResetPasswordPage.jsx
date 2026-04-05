// frontend/src/pages/ResetPasswordPage.jsx
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword]     = useState('');
  const [confirm,  setConfirm]      = useState('');
  const [loading,  setLoading]      = useState(false);
  const [error,    setError]        = useState('');
  const [success,  setSuccess]      = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError(t('auth.passwordTooShort')); return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch')); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('errors.serverError')); return; }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{t('auth.invalidResetLink')}</p>
          <Link to="/forgot-password" className="text-primary-500 hover:underline text-sm">
            {t('auth.requestNewLink')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-700 dark:from-gray-900 dark:to-gray-950 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSelector compact />
      </div>

      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-panel border border-gray-100 dark:border-gray-800 p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-500 mb-2 tracking-tight">TRENIKO</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('auth.setNewPassword')}</p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('auth.passwordChanged')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('auth.redirectingToLogin')}
            </p>
            <Link to="/login" className="text-primary-500 hover:underline text-sm font-medium">
              {t('auth.login')} →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.newPassword')}
              </label>
              <input type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                required className="input" placeholder="••••••••" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t('auth.confirmPassword')}
              </label>
              <input type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required className="input" placeholder="••••••••" />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full btn-primary py-3 text-base disabled:opacity-50">
              {loading ? t('common.saving') : t('auth.setNewPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
