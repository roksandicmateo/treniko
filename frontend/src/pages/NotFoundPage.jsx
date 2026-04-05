// frontend/src/pages/NotFoundPage.jsx
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-gray-100 dark:text-gray-800 mb-2 select-none">
          404
        </div>
        <div className="text-5xl mb-6">🏋️</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          {t('errors.pageNotFound')}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('errors.pageNotFoundDesc')}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            {t('common.back')}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {t('nav.dashboard')}
          </button>
        </div>
      </div>
    </div>
  );
}
