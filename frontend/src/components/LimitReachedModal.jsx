import { useNavigate } from 'react-router-dom';

const LimitReachedModal = ({ isOpen, onClose, limitType, currentCount, maxCount, planName }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const getLimitMessage = () => {
    switch (limitType) {
      case 'clients':
        return {
          title: 'Client Limit Reached',
          message: `You've reached your client limit (${maxCount} clients on ${planName} plan). Upgrade to add more clients.`,
          suggestion: 'Upgrade to Pro for 50 clients or Enterprise for unlimited clients.'
        };
      case 'sessions':
        return {
          title: 'Session Limit Reached',
          message: `You've reached your monthly session limit (${maxCount} sessions on ${planName} plan). Upgrade for unlimited sessions.`,
          suggestion: 'Upgrade to Pro or Enterprise for unlimited sessions.'
        };
      default:
        return {
          title: 'Limit Reached',
          message: `You've reached your plan limit.`,
          suggestion: 'Upgrade to continue.'
        };
    }
  };

  const { title, message, suggestion } = getLimitMessage();

  const handleUpgrade = () => {
    onClose();
    navigate('/dashboard/subscription');
  };

  const handleDeleteUsers = () => {
    onClose();
    navigate('/dashboard/clients');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {title}
          </h2>
          <p className="text-gray-600">
            {message}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900">
            <strong>💡 Solution:</strong> {suggestion}
          </p>
        </div>

        {limitType === 'clients' && currentCount > maxCount && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-900">
              <strong>⚠️ Current Status:</strong> You have {currentCount} clients but your plan allows {maxCount}. 
              {currentCount - maxCount > 0 && ` You need to remove ${currentCount - maxCount} client(s) or upgrade.`}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleUpgrade}
            className="w-full btn-primary text-lg py-3"
          >
            🚀 Upgrade Plan
          </button>

          {limitType === 'clients' && currentCount > maxCount && (
            <button
              onClick={handleDeleteUsers}
              className="w-full btn-secondary"
            >
              Manage Clients
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default LimitReachedModal;
