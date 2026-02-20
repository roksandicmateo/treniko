import { useState, useEffect } from 'react';

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

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`min-w-[300px] max-w-md rounded-lg shadow-lg p-4 flex items-start space-x-3 ${
            toast.type === 'success' ? 'bg-green-50 border border-green-200' :
            toast.type === 'error' ? 'bg-red-50 border border-red-200' :
            toast.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-blue-50 border border-blue-200'
          }`}
        >
          <div className="flex-shrink-0 text-2xl">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✗'}
            {toast.type === 'warning' && '⚠'}
            {toast.type === 'info' && 'ℹ'}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              toast.type === 'success' ? 'text-green-900' :
              toast.type === 'error' ? 'text-red-900' :
              toast.type === 'warning' ? 'text-yellow-900' :
              'text-blue-900'
            }`}>
              {toast.message}
            </p>
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className={`flex-shrink-0 ${
              toast.type === 'success' ? 'text-green-600 hover:text-green-800' :
              toast.type === 'error' ? 'text-red-600 hover:text-red-800' :
              toast.type === 'warning' ? 'text-yellow-600 hover:text-yellow-800' :
              'text-blue-600 hover:text-blue-800'
            }`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
