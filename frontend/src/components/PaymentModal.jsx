// frontend/src/components/PaymentModal.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentsAPI } from '../services/api';
import { showToast } from './Toast';

const DEFAULT_FORM = {
  amount:          '',
  paymentDate:     new Date().toISOString().split('T')[0],
  paymentMethod:   'cash',
  status:          'paid',
  clientPackageId: '',
  note:            '',
};

export default function PaymentModal({
  clientId,
  packages = [],
  editPayment = null,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation();
  const isEdit = Boolean(editPayment);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editPayment) {
      setForm({
        amount:          String(editPayment.amount),
        paymentDate:     editPayment.payment_date?.split('T')[0] ?? DEFAULT_FORM.paymentDate,
        paymentMethod:   editPayment.payment_method  ?? 'cash',
        status:          editPayment.status          ?? 'paid',
        clientPackageId: editPayment.client_package_id ?? '',
        note:            editPayment.note            ?? '',
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editPayment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 0) {
      showToast(t('billing.fields.amount') + ' invalid', 'error');
      return;
    }
    const payload = {
      amount:          Number(form.amount),
      paymentDate:     form.paymentDate,
      paymentMethod:   form.paymentMethod,
      status:          form.status,
      clientPackageId: form.clientPackageId || null,
      note:            form.note || null,
    };
    try {
      setSaving(true);
      let saved;
      if (isEdit) {
        const res = await paymentsAPI.updatePayment(clientId, editPayment.id, payload);
        saved = res.data.payment;
        showToast(t('billing.paymentUpdated'), 'success');
      } else {
        const res = await paymentsAPI.createPayment(clientId, payload);
        saved = res.data.payment;
        showToast(t('billing.paymentLogged'), 'success');
      }
      onSaved(saved);
    } catch (err) {
      showToast(err.response?.data?.error || t('billing.failedSave'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? t('billing.editPayment') : t('billing.logPayment')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('billing.fields.amount')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number" name="amount" min="0" step="0.01"
              value={form.amount} onChange={handleChange} placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date + Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('billing.fields.date')}
              </label>
              <input
                type="date" name="paymentDate" value={form.paymentDate} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('billing.fields.method')}
              </label>
              <select
                name="paymentMethod" value={form.paymentMethod} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['cash','bank_transfer','card','other'].map((m) => (
                  <option key={m} value={m}>{t(`billing.method.${m}`)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('billing.fields.status')}
            </label>
            <div className="flex gap-3">
              {['paid', 'pending'].map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="status" value={s} checked={form.status === s}
                    onChange={handleChange} className="accent-blue-600" />
                  <span className={`text-sm font-medium ${s === 'paid' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {t(`billing.status.${s}`)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Link to package */}
          {packages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('billing.fields.linkPackage')} <span className="text-gray-400 font-normal">({t('common.optional')})</span>
              </label>
              <select
                name="clientPackageId" value={form.clientPackageId} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{t('billing.fields.noPackage')}</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.package_name} ({pkg.status})</option>
                ))}
              </select>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('billing.fields.note')} <span className="text-gray-400 font-normal">({t('common.optional')})</span>
            </label>
            <textarea
              name="note" value={form.note} onChange={handleChange} rows={2}
              placeholder={t('billing.fields.notePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
            {t('common.cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition">
            {saving ? t('common.saving') : isEdit ? t('common.save') : t('billing.logPayment')}
          </button>
        </div>

      </div>
    </div>
  );
}
