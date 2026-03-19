'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Loader, Alert, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectP } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/authContext';

export default function DriverProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    vehicle_type: '',
    vehicle_registration: ''
  });

  useEffect(() => {
    // Load initial data from the user object in context, 
    // assuming the backend populates these fields in user attributes or driver object
    if (user) {
      // If driver details are nested (e.g., user.driver.vehicle_type), map them here.
      // Based on the controller, regular attributes are at top level or in attributes
      setFormData({
        first_name: user.first_name || user.attributes?.first_name || '',
        last_name: user.last_name || user.attributes?.last_name || '',
        phone: user.phone || '',
        // Check if driver info is attached directly or needs to be fetched
        vehicle_type: user.driver?.vehicle_type || '', 
        vehicle_registration: user.driver?.vehicle_registration || ''
      });
      
      // If we don't have driver specific fields in the user object yet, fetch full profile
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const response = await apiClient.getProfile();
      if (response.status === 'success' && response.data) {
        const u = response.data;
        // Access driver specific fields if they are returned in the profile response
        // The userController.getUser attaches specific model data based on logic (check getUser function)
        // Assuming getUser attaches 'driver' object if user is a driver.
        const driver = (u as any).driver || {}; 
        
        setFormData(prev => ({
          ...prev,
          first_name: u.attributes?.first_name || prev.first_name,
          last_name: u.attributes?.last_name || prev.last_name,
          phone: u.phone || prev.phone,
          vehicle_type: driver.vehicle_type || prev.vehicle_type,
          vehicle_registration: driver.vehicle_registration || prev.vehicle_registration
        }));
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
      await refreshProfile(); // Refresh context immediately
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <DashboardLayout role="driver">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Driver Profile</h1>
        
        {message.text && (
          <Alert type={message.type as 'success' | 'error'}>{message.text}</Alert>
        )}

        <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} />
                <Input label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} />
                <Input label="Phone" name="phone" value={formData.phone} onChange={handleChange} />
              </div>

              <div className="border-t border-gray-100 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Vehicle Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Vehicle Type</label>
                    <SelectP 
                      name="vehicle_type" 
                      value={formData.vehicle_type} 
                      onValueChange={(val) => setFormData({...formData, vehicle_type: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bike">Bike</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                      </SelectContent>
                    </SelectP>
                  </div>
                  <Input label="Plate Number" name="vehicle_registration" value={formData.vehicle_registration} onChange={handleChange} placeholder="e.g. ABC-123-DE" />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" variant="primary" loading={saving}>
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
      </div>
    </DashboardLayout>
  );
}