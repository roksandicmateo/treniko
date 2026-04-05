// frontend/src/pages/TermsPage.jsx
import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-blue-600 hover:underline text-sm mb-6 block">← Back</button>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-400 mb-8">Last updated: April 2026</p>

          <div className="space-y-6 text-sm text-gray-700 dark:text-gray-300">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">1. Agreement to Terms</h2>
              <p>By accessing or using Treniko, you agree to be bound by these Terms of Service. If you do not agree, you may not use the service.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">2. Description of Service</h2>
              <p>Treniko is a training management platform for personal trainers. It allows trainers to manage clients, schedule sessions, log workouts, track progress, and manage training packages. Treniko is a tool for managing training relationships — it does not provide training advice, medical recommendations, or fitness certifications.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">3. Account Registration</h2>
              <p>You must provide accurate information when registering. You are responsible for maintaining the security of your account credentials. You must notify us immediately if you suspect unauthorized access to your account. Each account is for one trainer — you may not share accounts.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">4. Subscription & Payment</h2>
              <p>Treniko offers a free plan with limited features and paid plans with expanded limits. Subscription plans are billed as agreed at sign-up. You may cancel at any time — cancellation takes effect at the end of the current billing period. No refunds are provided for partial billing periods.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">5. Your Responsibilities as a Trainer</h2>
              <p>You are the data controller for your clients' personal data. You are responsible for: obtaining valid GDPR consent from clients before entering their health data, informing clients about data processing, responding to client data requests, and complying with applicable data protection laws in your jurisdiction. By accepting our Data Processing Agreement, you confirm these obligations.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">6. Acceptable Use</h2>
              <p>You may not use Treniko to: process data without appropriate client consent, store data for purposes other than training management, share account access with other trainers, reverse-engineer or attempt to access our infrastructure, or violate any applicable law.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">7. Data & Privacy</h2>
              <p>Our use of your data is governed by our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a> and Data Processing Agreement. You retain ownership of all client data you enter. Upon account termination, your data is deleted within 30 days.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">8. Service Availability</h2>
              <p>We aim for high availability but do not guarantee uninterrupted access. We may perform maintenance, updates, or emergency fixes that temporarily affect availability. We will provide reasonable notice for planned downtime.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">9. Limitation of Liability</h2>
              <p>Treniko is provided "as is". We are not liable for: loss of data (maintain your own backups via the export feature), indirect or consequential damages, or losses resulting from unauthorized account access due to your failure to maintain password security.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">10. Termination</h2>
              <p>You may delete your account at any time from your profile settings. We reserve the right to suspend or terminate accounts that violate these terms, with or without notice depending on the severity of the violation.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">11. Changes to Terms</h2>
              <p>We may update these terms from time to time. We will notify you by email at least 14 days before significant changes take effect. Continued use of Treniko after changes constitutes acceptance.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">12. Contact</h2>
              <p>For questions about these terms, contact us at <a href="mailto:hello@treniko.com" className="text-blue-600 hover:underline">hello@treniko.com</a>.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
