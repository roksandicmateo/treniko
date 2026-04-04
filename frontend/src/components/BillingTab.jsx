// frontend/src/components/BillingTab.jsx
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentsAPI, packagesAPI } from '../services/api';
import PaymentModal from './PaymentModal';
import ConfirmModal from './ConfirmModal';
import { showToast } from './Toast';
import { format, parseISO } from 'date-fns';

export default function BillingTab({ clientId }) {
  const { t } = useTranslation();

  const [payments,     setPayments]     = useState([]);
  const [summary,      setSummary]      = useState(null);
  const [packages,     setPackages]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editPayment,  setEditPayment]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const res = await paymentsAPI.getClientPayments(clientId);
      setPayments(res.data.payments);
      setSummary(res.data.summary);
    } catch {
      showToast(t('billing.failedLoad'), 'error');
    }
  }, [clientId, t]);

  const loadPackages = useCallback(async () => {
    try {
      const res = await packagesAPI.getClientPackages(clientId);
      setPackages(res.data.packages ?? []);
    } catch { /* non-critical */ }
  }, [clientId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadPayments(), loadPackages()]).finally(() => setLoading(false));
  }, [loadPayments, loadPackages]);

  const handleSaved = () => {
    setModalOpen(false);
    setEditPayment(null);
    loadPayments();
  };

  const handleEdit = (payment) => {
    setEditPayment(payment);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleting(true);
      await paymentsAPI.deletePayment(clientId, deleteTarget.id);
      showToast(t('billing.paymentDeleted'), 'success');
      setDeleteTarget(null);
      loadPayments();
    } catch {
      showToast(t('billing.failedDelete'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const fmt = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  const fmtDate = (dateStr) => {
    try { return format(parseISO(dateStr), 'd MMM yyyy'); }
    catch { return dateStr; }
  };

  const methodLabel = (method) => t(`billing.method.${method}`, { defaultValue: method });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard
            label={t('billing.summary.totalPaid')}
            value={fmt(summary.total_paid)}
            color="green"
            sub={`${summary.count_paid} ${t('billing.summary.payment', { count: Number(summary.count_paid) })}`}
          />
          <SummaryCard
            label={t('billing.summary.pending')}
            value={fmt(summary.total_pending)}
            color="amber"
            sub={`${summary.count_pending} ${t('billing.summary.payment', { count: Number(summary.count_pending) })}`}
          />
          <SummaryCard
            label={t('billing.summary.totalRevenue')}
            value={fmt(Number(summary.total_paid) + Number(summary.total_pending))}
            color="blue"
            sub={t('billing.summary.allTime')}
          />
          <div className="flex items-center justify-end sm:col-span-1 col-span-2">
            <button
              onClick={() => { setEditPayment(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              <span className="text-base leading-none">+</span> {t('billing.logPayment')}
            </button>
          </div>
        </div>
      )}

      {payments.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">💳</p>
          <p className="font-medium">{t('billing.noPayments')}</p>
          <button
            onClick={() => { setEditPayment(null); setModalOpen(true); }}
            className="mt-4 text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('billing.logFirstPayment')}
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t('billing.table.date')}</th>
                <th className="px-4 py-3 text-left">{t('billing.table.amount')}</th>
                <th className="px-4 py-3 text-left">{t('billing.table.method')}</th>
                <th className="px-4 py-3 text-left">{t('billing.table.status')}</th>
                <th className="px-4 py-3 text-left">{t('billing.table.package')}</th>
                <th className="px-4 py-3 text-left">{t('billing.table.note')}</th>
                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {payments.map((p) => (
                <tr key={p.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{fmt(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{methodLabel(p.payment_method)}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} t={t} /></td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[140px] truncate">
                    {p.package_name ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate">
                    {p.note ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => handleEdit(p)} className="text-xs text-blue-600 hover:underline dark:text-blue-400 mr-3">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => setDeleteTarget(p)} className="text-xs text-red-500 hover:underline dark:text-red-400">
                      {t('common.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <PaymentModal
          clientId={clientId}
          packages={packages}
          editPayment={editPayment}
          onClose={() => { setModalOpen(false); setEditPayment(null); }}
          onSaved={handleSaved}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title={t('billing.deletePayment')}
          message={t('billing.confirmDelete', { amount: fmt(deleteTarget.amount), date: fmtDate(deleteTarget.payment_date) })}
          confirmText={t('common.delete')}
          type="danger"
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, sub }) {
  const colors = {
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400',
    blue:  'bg-blue-50  dark:bg-blue-900/20  text-blue-700  dark:text-blue-400',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status, t }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
        {t('billing.status.paid')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      {t('billing.status.pending')}
    </span>
  );
}
