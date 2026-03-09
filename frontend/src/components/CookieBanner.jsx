// frontend/src/components/CookieBanner.jsx  (NEW FILE)
import { useState, useEffect } from 'react';

const COOKIE_KEY = 'treniko_cookie_consent';

const defaultPrefs = {
  necessary: true,      // always on
  analytics: false,
  preferences: false,
};

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY);
    if (!stored) {
      // Small delay so it doesn't flash immediately on page load
      setTimeout(() => setVisible(true), 800);
    }
  }, []);

  const saveConsent = (selectedPrefs) => {
    localStorage.setItem(COOKIE_KEY, JSON.stringify({
      ...selectedPrefs,
      necessary: true,
      timestamp: new Date().toISOString(),
    }));
    setSaved(true);
    setTimeout(() => setVisible(false), 600);
  };

  const handleAcceptAll = () => {
    saveConsent({ necessary: true, analytics: true, preferences: true });
  };

  const handleRejectAll = () => {
    saveConsent({ necessary: true, analytics: false, preferences: false });
  };

  const handleSavePrefs = () => {
    saveConsent(prefs);
    setManageOpen(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop for manage panel */}
      {manageOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-40"
          onClick={() => setManageOpen(false)}
        />
      )}

      {/* Manage preferences panel */}
      {manageOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl p-6 max-w-2xl mx-auto mb-0 rounded-t-2xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900">Manage Cookie Preferences</h3>
            <button
              onClick={() => setManageOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-xl font-light"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 mb-6">
            {/* Necessary */}
            <div className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">Necessary</p>
                <p className="text-xs text-gray-500 mt-0.5">Required for the app to function. Cannot be disabled.</p>
              </div>
              <div className="flex-shrink-0">
                <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-60">
                  <div className="w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            </div>

            {/* Analytics */}
            <div className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">Analytics</p>
                <p className="text-xs text-gray-500 mt-0.5">Helps us understand how the app is used to improve it.</p>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, analytics: !p.analytics }))}
                className={`flex-shrink-0 w-10 h-6 rounded-full flex items-center px-1 transition-all duration-200 ${
                  prefs.analytics ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow" />
              </button>
            </div>

            {/* Preferences */}
            <div className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-gray-800">Preferences</p>
                <p className="text-xs text-gray-500 mt-0.5">Remembers your settings like language and display options.</p>
              </div>
              <button
                onClick={() => setPrefs(p => ({ ...p, preferences: !p.preferences }))}
                className={`flex-shrink-0 w-10 h-6 rounded-full flex items-center px-1 transition-all duration-200 ${
                  prefs.preferences ? 'bg-blue-600 justify-end' : 'bg-gray-300 justify-start'
                }`}
              >
                <div className="w-4 h-4 bg-white rounded-full shadow" />
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRejectAll}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Reject All
            </button>
            <button
              onClick={handleSavePrefs}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* Main cookie banner */}
      {!manageOpen && (
        <div className={`fixed bottom-4 left-4 right-4 z-50 transition-all duration-500 ${
          saved ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
        }`}>
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 max-w-2xl mx-auto">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-xl mt-0.5">🍪</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">We use cookies</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Treniko uses cookies to keep you logged in and improve your experience.
                  By continuing, you agree to our use of necessary cookies.
                  You can manage optional cookies below.
                </p>
              </div>
            </div>

            {/* Three equal-prominence buttons — GDPR requirement */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setPrefs(defaultPrefs);
                  setManageOpen(true);
                }}
                className="py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Manage
              </button>
              <button
                onClick={handleRejectAll}
                className="py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="py-2.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CookieBanner;
