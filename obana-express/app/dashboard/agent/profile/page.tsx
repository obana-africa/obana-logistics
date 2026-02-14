'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Loader, Alert } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

export default function AgentProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    state: '',
    city: '',
    lga: '',
    assigned_zone: '',
    service_radius: '',
    government_id_number: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await apiClient.getProfile();
      if (response.success && response.data) {
        const u = response.data;
        const agent = u.agent_profile || {};
        setFormData({
          first_name: u.attributes?.first_name || '',
          last_name: u.attributes?.last_name || '',
          phone: u.phone || '',
          country: agent.country || '',
          state: agent.state || '',
          city: agent.city || '',
          lga: agent.lga || '',
          assigned_zone: agent.assigned_zone || '',
          service_radius: agent.service_radius || '',
          government_id_number: agent.government_id_number || ''
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await apiClient.updateProfile(formData);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <DashboardLayout role="agent">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Agent Profile</h1>
        
        {message.text && (
          <Alert type={message.type as 'success' | 'error'}>{message.text}</Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} />
                <Input label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} />
                <Input label="Phone" name="phone" value={formData.phone} onChange={handleChange}  />
                <Input label="ID Number" name="government_id_number" value={formData.government_id_number} onChange={handleChange}  />
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Location & Coverage</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Country" name="country" value={formData.country} onChange={handleChange} />
                  <Input label="State" name="state" value={formData.state} onChange={handleChange} />
                  <Input label="City" name="city" value={formData.city} onChange={handleChange} />
                  <Input label="LGA" name="lga" value={formData.lga} onChange={handleChange} />
                  <Input label="Zone" name="assigned_zone" value={formData.assigned_zone} onChange={handleChange} />
                  <Input label="Service Radius (km)" name="service_radius" type="number" value={formData.service_radius} onChange={handleChange} />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" variant="primary" loading={saving}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}