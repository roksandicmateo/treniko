import { useEffect, useRef } from 'react';
import Icon from './Icon';

/**
 * The confirmation every destructive action goes through.
 *
 * It had no dark styling at all, so in dark mode confirming anything meant a
 * white card at full brightness. It also could not be dismissed with Escape,
 * which is the first thing anyone tries when a dialog appears by mistake.
 */
const TONES = {
  danger: {
    panel: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900',
    text: 'text-red-900 dark:text-red-200',
    icon: 'text-red-600 dark:text-red-400',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500 text-white',
  },
  success: {
    panel: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
    text: 'text-emerald-900 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-400',
    button: 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500 text-white',
  },
  warning: {
    panel: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
    text: 'text-amber-900 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500 text-white',
  },
};

const ConfirmModal = ({
  isOpen, onClose, onCancel, onConfirm,
  title, message,
  confirmText = 'Confirm', cancelText = 'Cancel',
  type = 'warning', loading = false,
}) => {
  const handleClose = onClose || onCancel || (() => {});
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    // Focus lands on the dialog rather than staying behind it, so a keyboard
    // user is not left pressing Tab through the page underneath.
    confirmRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const tone = TONES[type] || TONES.warning;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{title}</h2>

        <div className={`${tone.panel} border rounded-xl p-4 mb-6 flex items-start gap-3`}>
          <Icon name="alert" className={`h-5 w-5 flex-shrink-0 mt-0.5 ${tone.icon}`} />
          <p className={`text-sm ${tone.text}`}>{message}</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${tone.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
