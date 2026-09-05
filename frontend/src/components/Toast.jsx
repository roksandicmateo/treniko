import { useState, useEffect } from 'react';
import Icon from './Icon';

let showToastFn = null;

export const showToast = (message, type = 'success') => {
  if (showToastFn) {
    showToastFn(message, type);
  }
};

const Toast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    showToastFn = (message, type) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, message, type }]);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
    };

    return () => {
      showToastFn = null;
    };
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  const TONES = {
    success: {
      box: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900',
      text: 'text-emerald-900 dark:text-emerald-200',
      icon: 'check',
    },
    error: {
      box: 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900',
      text: 'text-red-900 dark:text-red-200',
      icon: 'alert',
    },
    warning: {
      box: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900',
      text: 'text-amber-900 dark:text-amber-200',
      icon: 'alert',
    },
    info: {
      box: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-900',
      text: 'text-sky-900 dark:text-sky-200',
      icon: 'bell',
    },
  };

  return (
    // `aria-live` so a screen reader announces the outcome of a save; a toast
    // that only exists visually tells half the users nothing at all.
    <div
      className="fixed top-4 right-4 left-4 sm:left-auto z-50 space-y-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map(toast => {
        const tone = TONES[toast.type] || TONES.info;
        return (
          <div
            key={toast.id}
            className={`sm:min-w-[300px] max-w-md rounded-xl border shadow-lg p-4 flex items-start gap-3 ${tone.box}`}
          >
            <Icon name={tone.icon} className={`h-5 w-5 flex-shrink-0 mt-0.5 ${tone.text}`} />
            <p className={`flex-1 text-sm font-medium ${tone.text}`}>{toast.message}</p>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Close"
              className={`flex-shrink-0 rounded-lg p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current ${tone.text}`}
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Toast;
