// frontend/src/pages/ForgotPasswordPage.jsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError('');
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      });
      setSent(true); // Always show success to prevent email enumeration
    } catch {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 to-primary-700 dark:from-gray-900 dark:to-gray-950 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSelector compact />
      </div>

      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-panel border border-gray-100 dark:border-gray-800 p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-500 mb-2 tracking-tight">TRENIKO</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('auth.resetPassword')}</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('auth.checkYourEmail')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t('auth.resetEmailSent')}
            </p>
            <Link to="/login" className="text-primary-500 hover:text-primary-600 text-sm font-medium">
              ← {t('auth.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {t('auth.resetPasswordDesc')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t('auth.email')}
                </label>
                <input
                  type="email" id="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  required className="input" placeholder="you@example.com"
                />
              </div>

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full btn-primary py-3 text-base disabled:opacity-50">
                {loading ? t('common.loading') : t('auth.sendResetLink')}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                ← {t('auth.backToLogin')}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
