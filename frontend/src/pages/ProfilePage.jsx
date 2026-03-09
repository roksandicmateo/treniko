// frontend/src/pages/ProfilePage.jsx  (NEW FILE)
import { useState, useEffect } from 'react';
import { showToast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    bio: '', city: '', country: '', website: '',
    businessName: '', businessPhone: '', businessWebsite: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const token = () => localStorage.getItem('token');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (data.success) {
        const p = data.profile;
        setProfile(p);
        setFormData({
          firstName: p.first_name || '',
          lastName: p.last_name || '',
          email: p.email || '',
          phone: p.phone || '',
          bio: p.bio || '',
          city: p.city || '',
          country: p.country || '',
          website: p.website || '',
          businessName: p.business?.name || '',
          businessPhone: p.business?.phone || '',
          businessWebsite: p.business?.website || '',
        });
      }
    } catch {
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        showToast('Profile updated successfully', 'success');
        loadProfile();
      } else {
        showToast(data.error || 'Failed to update profile', 'error');
      }
    } catch {
      showToast('Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch(`${API_URL}/profile/password`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Password changed successfully', 'success');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordError(data.error || 'Failed to change password.');
      }
    } catch {
      setPasswordError('Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials = profile
    ? `${profile.first_name?.[0] || ''}${profile.last_name?.[0] || ''}`.toUpperCase()
    : '';

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading profile...</div>;
  }

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'business', label: 'Business' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Profile</h1>

      {/* Avatar + name header */}
      <div className="card p-6 mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-xl font-semibold text-gray-900">{profile?.first_name} {profile?.last_name}</p>
          <p className="text-sm text-gray-500">{profile?.email}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Member since {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Personal Info */}
      {activeTab === 'personal' && (
        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              className="input"
              placeholder="+385 91 234 5678"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                className="input"
                placeholder="Zagreb"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={e => setFormData({ ...formData, country: e.target.value })}
                className="input"
                placeholder="Croatia"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={e => setFormData({ ...formData, website: e.target.value })}
              className="input"
              placeholder="https://yourwebsite.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
            <textarea
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              className="input resize-none"
              rows={3}
              placeholder="Tell your clients a bit about yourself..."
            />
          </div>
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Business */}
      {activeTab === 'business' && (
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              value={formData.businessName}
              onChange={e => setFormData({ ...formData, businessName: e.target.value })}
              className="input"
              placeholder="Your Fitness Studio"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Phone</label>
            <input
              type="tel"
              value={formData.businessPhone}
              onChange={e => setFormData({ ...formData, businessPhone: e.target.value })}
              className="input"
              placeholder="+385 1 234 5678"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Website</label>
            <input
              type="url"
              value={formData.businessWebsite}
              onChange={e => setFormData({ ...formData, businessWebsite: e.target.value })}
              className="input"
              placeholder="https://yourstudio.com"
            />
          </div>
          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <div className="card p-6 space-y-4">
          <h3 className="text-base font-semibold text-gray-800">Change Password</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={passwordData.newPassword}
              onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              value={passwordData.confirmPassword}
              onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              className="input"
              placeholder="••••••••"
            />
          </div>
          {passwordError && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{passwordError}</div>
          )}
          <div className="pt-2">
            <button
              onClick={handlePasswordChange}
              disabled={passwordSaving}
              className="btn-primary disabled:opacity-50"
            >
              {passwordSaving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
