// frontend/src/pages/ProfilePage.jsx
import { useState, useEffect } from 'react';
import { showToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import LanguageSelector from '../components/LanguageSelector';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ProfilePage = () => {
  const { t, i18n } = useTranslation();
  const { isDark, toggle } = useTheme();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    bio: '', city: '', country: '', website: '',
    businessName: '', businessPhone: '', businessWebsite: ''
  });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const token = () => localStorage.getItem('token');

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (data.success) {
        const p = data.profile;
        setProfile(p);
        setFormData({
          firstName: p.first_name || '', lastName: p.last_name || '',
          email: p.email || '', phone: p.phone || '',
          bio: p.bio || '', city: p.city || '',
          country: p.country || '', website: p.website || '',
          businessName: p.business?.name || '',
          businessPhone: p.business?.phone || '',
          businessWebsite: p.business?.website || '',
        });
      }
    } catch { showToast(t('common.error'), 'error'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) { showToast(t('profile.saveChanges'), 'success'); loadProfile(); }
      else { showToast(data.error || t('common.error'), 'error'); }
    } catch { showToast(t('common.error'), 'error'); }
    finally { setSaving(false); }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError(t('auth.confirmPassword') + ' does not match'); return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters'); return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`${API_URL}/profile/password`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword })
      });
      const data = await res.json();
      if (data.success) {
        showToast(t('common.save'), 'success');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else { setPasswordError(data.error || t('common.error')); }
    } catch { setPasswordError(t('common.error')); }
    finally { setPasswordSaving(false); }
  };

  const initials = profile ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase() : '';
  const lbl = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  if (loading) return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;

  const tabs = [
    { id: 'personal', label: t('profile.personalInfo') },
    { id: 'business', label: t('profile.business') },
    { id: 'security', label: t('profile.security') },
    { id: 'settings', label: `${t('profile.language')} & ${t('profile.theme')}` },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">{t('profile.title')}</h1>

      {/* Avatar header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary-500 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">{profile?.first_name} {profile?.last_name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{profile?.email}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString(
              i18n.language === 'hr' ? 'hr-HR' : i18n.language === 'de' ? 'de-DE' : 'en-GB',
              { month: 'long', year: 'numeric' }
            ) : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 mb-6 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Personal */}
      {activeTab === 'personal' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>{t('auth.firstName')} *</label><input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className="input" /></div>
            <div><label className={lbl}>{t('auth.lastName')} *</label><input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className="input" /></div>
          </div>
          <div><label className={lbl}>{t('auth.email')} *</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="input" /></div>
          <div><label className={lbl}>{t('profile.phone')}</label><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={lbl}>{t('profile.city')}</label><input type="text" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} className="input" /></div>
            <div><label className={lbl}>{t('profile.country')}</label><input type="text" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} className="input" /></div>
          </div>
          <div><label className={lbl}>{t('profile.website')}</label><input type="url" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} className="input" placeholder="https://" /></div>
          <div><label className={lbl}>{t('profile.bio')}</label><textarea value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} className="input resize-none" rows={3} /></div>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? t('common.saving') : t('profile.saveChanges')}</button>
        </div>
      )}

      {/* Business */}
      {activeTab === 'business' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <div><label className={lbl}>{t('auth.businessName')}</label><input type="text" value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} className="input" /></div>
          <div><label className={lbl}>{t('profile.phone')}</label><input type="tel" value={formData.businessPhone} onChange={e => setFormData({ ...formData, businessPhone: e.target.value })} className="input" /></div>
          <div><label className={lbl}>{t('profile.website')}</label><input type="url" value={formData.businessWebsite} onChange={e => setFormData({ ...formData, businessWebsite: e.target.value })} className="input" /></div>
          <button onClick={handleSave} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? t('common.saving') : t('profile.saveChanges')}</button>
        </div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <div><label className={lbl}>{t('profile.currentPassword')}</label><input type="password" value={passwordData.currentPassword} onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })} className="input" placeholder="••••••••" /></div>
          <div><label className={lbl}>{t('profile.newPassword')}</label><input type="password" value={passwordData.newPassword} onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })} className="input" placeholder="••••••••" /></div>
          <div><label className={lbl}>{t('profile.confirmPassword')}</label><input type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} className="input" placeholder="••••••••" /></div>
          {passwordError && <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{passwordError}</div>}
          <button onClick={handlePasswordChange} disabled={passwordSaving} className="btn-primary disabled:opacity-50">{passwordSaving ? t('common.saving') : t('profile.saveChanges')}</button>
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">🌍 {t('profile.language')}</h3>
            <LanguageSelector />
          </div>
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-4">🎨 {t('profile.theme')}</h3>
            <div className="flex gap-3">
              <button onClick={() => isDark && toggle()}
                className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${!isDark ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                <span className="text-2xl">☀️</span>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('profile.lightMode')}</p>
              </button>
              <button onClick={() => !isDark && toggle()}
                className={`flex-1 flex items-center gap-3 p-4 rounded-xl border-2 transition-colors ${isDark ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                <span className="text-2xl">🌙</span>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t('profile.darkMode')}</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
