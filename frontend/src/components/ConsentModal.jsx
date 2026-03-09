// frontend/src/components/ConsentModal.jsx  (NEW FILE)
import { useState } from 'react';

const ConsentModal = ({ clientName, onAccept, onDecline }) => {
  const [confirming, setConfirming] = useState(false);

  const handleAccept = async () => {
    setConfirming(true);
    await onAccept();
    setConfirming(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">

        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          Health Data Consent Required
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          {clientName
            ? `Before storing health data for ${clientName}`
            : 'Before storing health data for this client'}
        </p>

        {/* What will be stored */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Data that may be collected includes:
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Body weight and measurements</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Training performance (sets, reps, weight, RPE)</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Injury history and medical notes</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Progress photos (if uploaded)</li>
            <li className="flex items-start gap-2"><span className="text-blue-500 mt-0.5">•</span> Training session history and attendance</li>
          </ul>
        </div>

        {/* Legal basis */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-xs text-yellow-800">
            <strong>GDPR Notice:</strong> Under Article 9 of the GDPR, health data requires
            explicit consent. By proceeding, you confirm that your client has given their
            informed, explicit consent for you to store and process their health data within
            Treniko. You are responsible for maintaining evidence of this consent.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={confirming}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {confirming ? 'Recording...' : 'Client Has Consented'}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-3">
          Consent is recorded with a timestamp in your audit log.
        </p>
      </div>
    </div>
  );
};

export default ConsentModal;
