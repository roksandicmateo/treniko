// frontend/src/components/DpaAcceptanceModal.jsx
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const DpaAcceptanceModal = ({ onAccepted }) => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
      if (atBottom) setHasScrolled(true);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAccept = async () => {
    setAccepting(true);
    setError('');
    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      await axios.post(
        `${API_URL}/auth/accept-dpa`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onAccepted();
    } catch (err) {
      setError('Failed to record your acceptance. Please try again.');
      setAccepting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Data Processing Agreement</h2>
          <p className="text-sm text-gray-500 mt-1">
            Please read and scroll through the entire agreement before accepting.
          </p>
        </div>

        {/* Scrollable DPA text */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-4 text-sm text-gray-700 space-y-4"
          style={{ minHeight: 0 }}
        >
          <p className="font-semibold text-gray-900">TRENIKO — Data Processing Agreement v1.0</p>
          <p>Effective date: March 2026</p>

          <p>
            This Data Processing Agreement ("DPA") is entered into between you, the personal trainer
            ("Controller"), and Treniko ("Processor"), governing the processing of personal data
            in accordance with Regulation (EU) 2016/679 (GDPR) and applicable national law.
          </p>

          <p className="font-semibold">1. Subject Matter</p>
          <p>
            Treniko provides a training management platform that processes personal data on behalf
            of the Controller. This includes client names, contact details, health and fitness data,
            training history, and progress metrics.
          </p>

          <p className="font-semibold">2. Categories of Data Subjects</p>
          <p>
            The data subjects are the clients of the Controller — individuals who receive personal
            training services. Data processed may include: full name, email address, phone number,
            date of birth, body weight, injury history, RPE scores, training logs, and exercise
            performance data.
          </p>

          <p className="font-semibold">3. Your Obligations as Controller</p>
          <p>You confirm that you will:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Obtain valid, explicit consent from each client before entering their health data.</li>
            <li>Inform clients about how their data is stored and processed.</li>
            <li>Respond to client data access and deletion requests promptly.</li>
            <li>Not use Treniko to process data for purposes beyond training management.</li>
            <li>Maintain the confidentiality of your account credentials.</li>
          </ul>

          <p className="font-semibold">4. Treniko's Obligations as Processor</p>
          <p>Treniko will:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Process data only on your documented instructions.</li>
            <li>Implement appropriate technical and organisational security measures.</li>
            <li>Not transfer data outside the EU/EEA without adequate safeguards.</li>
            <li>Assist you in fulfilling data subject rights requests.</li>
            <li>Delete or return all personal data upon termination of the agreement.</li>
            <li>Maintain records of all processing activities.</li>
          </ul>

          <p className="font-semibold">5. Data Retention</p>
          <p>
            Client data is retained for as long as your account is active. Upon account deletion,
            all data is permanently erased within 30 days. You may request early deletion at any
            time via the Settings page.
          </p>

          <p className="font-semibold">6. Security</p>
          <p>
            Treniko uses industry-standard security measures including encrypted connections (TLS),
            hashed passwords, row-level database security, and access logging. All sensitive
            operations are recorded in an audit log.
          </p>

          <p className="font-semibold">7. Sub-processors</p>
          <p>
            Treniko may use sub-processors (e.g. hosting providers) to deliver the service.
            All sub-processors are bound by equivalent data protection obligations.
          </p>

          <p className="font-semibold">8. Data Breach Notification</p>
          <p>
            In the event of a personal data breach, Treniko will notify you without undue delay
            and within 72 hours of becoming aware, providing all information required under
            Article 33 GDPR.
          </p>

          <p className="font-semibold">9. Termination</p>
          <p>
            This DPA remains in force for the duration of your use of Treniko. Upon termination,
            Treniko will delete all personal data within 30 days unless retention is required
            by law.
          </p>

          <p className="font-semibold">10. Governing Law</p>
          <p>
            This agreement is governed by the laws of the European Union and applicable member
            state law. Any disputes shall be resolved in accordance with GDPR supervisory
            authority procedures.
          </p>

          <p className="text-gray-400 text-xs pt-2">— End of Data Processing Agreement v1.0 —</p>
        </div>

        {/* Scroll hint */}
        {!hasScrolled && (
          <div className="px-6 py-2 bg-yellow-50 border-t border-yellow-200">
            <p className="text-xs text-yellow-700 text-center">
              ↓ Scroll to the bottom to enable the Accept button
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-t border-red-200">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col gap-2">
          <button
            onClick={handleAccept}
            disabled={!hasScrolled || accepting}
            className={`w-full py-3 rounded-xl font-semibold text-white transition-colors ${
              hasScrolled && !accepting
                ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {accepting ? 'Recording acceptance...' : 'I have read and accept this agreement'}
          </button>
          <p className="text-xs text-gray-400 text-center">
            You cannot use Treniko without accepting this agreement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DpaAcceptanceModal;
