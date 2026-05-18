import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const [status, setStatus] = useState('loading'); // loading | success | error | expired
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); return; }

    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setStatus('success');
        else if (data.error?.includes('expired')) setStatus('expired');
        else setStatus('error');
        setMessage(data.error || '');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-gray-100 dark:border-gray-800">
        {status === 'loading' && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Verifying your email...</h2>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Email verified!</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Your account is now active. You can log in.</p>
            <Link to="/login" className="btn-primary px-6 py-2.5 inline-block">Go to Login →</Link>
          </>
        )}
        {status === 'expired' && (
          <>
            <div className="text-5xl mb-4">⏰</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Link expired</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Your verification link has expired. Please register again.</p>
            <Link to="/register" className="btn-primary px-6 py-2.5 inline-block">Register again →</Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Invalid link</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">This verification link is invalid.</p>
            <Link to="/login" className="btn-primary px-6 py-2.5 inline-block">Go to Login →</Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
