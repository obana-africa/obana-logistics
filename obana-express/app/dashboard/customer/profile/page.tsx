/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Alert } from '@/components/ui';
import { useAuth } from '@/lib/authContext';
import { apiClient } from '@/lib/api';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

export default function CustomerProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ old_password: '', password: '', confirm_password: '' });
  const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.attributes?.first_name || '',
    last_name: user?.attributes?.last_name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.updateProfile(formData);
      await refreshProfile();
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirm_password) {
      setMessage('Error: New passwords do not match');
      return;
    }
    
    setPasswordLoading(true);
    try {
      let response = await apiClient.changePassword(passwordForm.old_password, passwordForm.password);

      setMessage('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordForm({ old_password: '', password: '', confirm_password: '' });
      setShowPasswords({ old: false, new: false, confirm: false });
    } catch (err: any) {
      setMessage('Error: ' + (err.response?.data?.message || 'Failed to change password'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const copyApiKey = () => {
    if (user?.attributes?.api_key) {
      navigator.clipboard.writeText(user.attributes.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <DashboardLayout role="customer">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">My Profile</h1>

        {message && (
          <Alert type={message.includes('Error') ? 'error' : 'success'} className="mb-6">
            {message}
          </Alert>
        )}

        <Card title="Personal Information" description="Update your profile details">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                placeholder="First name"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              />
              <Input
                label="Last Name"
                placeholder="Last name"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              />
            </div>

            <Input
              label="Email"
              type="email"
              placeholder="Email address"
              value={formData.email}
              disabled
            />

            <Input
              label="Phone Number"
              type="tel"
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />

            <Button type="submit" loading={loading} variant="primary">
              Save Changes
            </Button>
          </form>
        </Card>

        {user?.attributes?.api_key && (
          <Card title="Developer Settings" description="Your API Key for integration" className="mt-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-100 p-2 rounded border border-gray-200 font-mono text-sm overflow-x-auto">
                     {user.attributes.api_key}
                  </div>
                  <Button variant="secondary" onClick={copyApiKey} className="shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" values='copy'/>}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">Use this key to authenticate your API requests. Keep it secret!</p>
              </div>
            </div>
          </Card>
        )}

        <Card title="Account Settings" description="Manage your account security" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-600">Change your password</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowPasswordModal(true)}>
                Change
              </Button>
            </div>

          </div>
        </Card>

        {/* Password Change Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md" title="Change Password">
                   {message && (
          <Alert type={message.includes('Error') ? 'error' : 'success'} className="mb-6">
            {message}
          </Alert>
        )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="relative">
                  <Input
                    label="Current Password"
                    type={showPasswords.old ? 'text' : 'password'}
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(p => ({ ...p, old: !p.old }))}
                    className="absolute right-3 top-10 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.old ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    label="New Password"
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordForm.password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                    className="absolute right-3 top-10 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    label="Confirm New Password"
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                    className="absolute right-3 top-10 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    fullWidth 
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" fullWidth loading={passwordLoading}>
                    Update Password
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
