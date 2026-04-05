// frontend/src/pages/PrivacyPage.jsx
import { useNavigate } from 'react-router-dom';

export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline text-sm mb-6 block">← Back</button>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mb-8">Last updated: April 2026</p>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-gray-300">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">1. Who we are</h2>
              <p>Treniko is a training management platform for personal trainers, operated by the Treniko team. We act as a data processor on behalf of trainers (controllers) who use our platform to manage their clients.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">2. What data we collect</h2>
              <p>We collect and process the following categories of data:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Trainer account data:</strong> name, email address, business name, password (hashed)</li>
                <li><strong>Client data:</strong> name, email, phone, date of birth, training history, body metrics, injury notes, diet notes — entered by the trainer with the client's consent</li>
                <li><strong>Usage data:</strong> session logs, login timestamps, audit trail entries</li>
                <li><strong>Technical data:</strong> IP addresses, browser type (for security and fraud prevention)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">3. Legal basis for processing</h2>
              <p>We process personal data under the following legal bases:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>Contract performance:</strong> to provide the Treniko service to trainers</li>
                <li><strong>Legitimate interests:</strong> security, fraud prevention, service improvement</li>
                <li><strong>Explicit consent:</strong> for client health data, which requires documented consent under GDPR Article 9</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">4. How we use your data</h2>
              <p>Trainer data is used to provide and maintain your account, process subscription management, and send essential service communications. Client data is stored and processed solely on the trainer's instructions as part of the training management service.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">5. Data retention</h2>
              <p>Account and client data is retained for as long as your account is active. Upon account deletion, all data is permanently erased within 30 days. You may request early deletion at any time via your account settings. Audit log entries are retained for 12 months for security purposes.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">6. Data sharing</h2>
              <p>We do not sell, rent, or share your personal data with third parties for marketing purposes. Data may be shared with:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li>Hosting and infrastructure providers (bound by equivalent data protection obligations)</li>
                <li>Law enforcement, if required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">7. Your rights under GDPR</h2>
              <p>You have the right to: access your personal data, correct inaccurate data, request erasure, object to processing, and data portability. To exercise any of these rights, use the export or deletion features in your account settings, or contact us at <a href="mailto:privacy@treniko.com" className="text-blue-600 hover:underline">privacy@treniko.com</a>.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">8. Security</h2>
              <p>We use industry-standard security measures including TLS encryption for data in transit, bcrypt password hashing, row-level database security (RLS), and access logging. All sensitive operations are recorded in an audit log.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">9. Cookies</h2>
              <p>We use only essential cookies required for authentication (JWT tokens stored in localStorage) and your preferences (language, theme). We do not use tracking or advertising cookies.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">10. Contact</h2>
              <p>For privacy-related questions, contact us at <a href="mailto:privacy@treniko.com" className="text-blue-600 hover:underline">privacy@treniko.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
