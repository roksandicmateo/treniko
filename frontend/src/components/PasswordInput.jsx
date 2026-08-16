import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function PasswordInput({ id, name, value, onChange, placeholder, required, autoFocus, className }) {
  // The show/hide control's accessible name was hardcoded Croatian, so a
  // screen reader on the English or German interface announced it in a third
  // language. It is the same input used on login, registration and password
  // reset.
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} name={name} value={value} onChange={onChange}
        type={show ? 'text' : 'password'}
        required={required} autoFocus={autoFocus}
        placeholder={placeholder || '••••••••'}
        className={className || 'input pr-10'}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        tabIndex={-1}
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
      >
        {show ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}
