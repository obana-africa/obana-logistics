'use client';

import React, { useState } from 'react';
import Navigation from '@/components/home/Navigation';
import Footer from '@/components/home/Footer';
import { Card, Button, Input, Select, Alert } from '@/components/ui';
import { LocationInput } from '@/components/LocationInput';
import { apiClient } from '@/lib/api';
import { Calendar, Truck, Package, DollarSign } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

export default function RouteMatchPage() {
  const { isAuthenticated, user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    origin: { city: '', state: '', country: '', countryCode: '' },
    destination: { city: '', state: '', country: '', countryCode: '' },
    weight: '',
    transport_mode: 'road',
    service_level: 'Standard'
  });

  const transportModes = [
    { value: 'road', label: '🚚 Road Transport' },
    { value: 'air', label: '✈️ Air Transport' },
    { value: 'sea', label: '🚢 Sea Transport' },
  ];

  const serviceLevels = [
    { value: 'Standard', label: '📦 Standard' },
    { value: 'Express', label: '⚡ Express' },
    { value: 'Economy', label: '🐢 Economy' },
  ];

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!formData.origin.city || !formData.destination.city) {
      setError('Please select valid origin and destination cities');
      return;
    }
    
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
        setError('Please enter a valid weight');
        return;
    }

    setLoading(true);
    try {
      const res = await apiClient.matchRoute(
        parseFloat(formData.weight),
        formData.origin.city,
        formData.destination.city,
        formData.transport_mode,
        formData.service_level
      );

      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.message || 'No route found for these parameters');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error calculating quote');
    } finally {
      setLoading(false);
    }
  };

  const getDashboardLink = () => {
		if (!user) return "/";
		const dashboards: Record<string, string> = {
			customer: "/dashboard/customer",
			driver: "/dashboard/driver",
			admin: "/dashboard/admin",
			agent: "/dashboard/agent",
		};
		return dashboards[user.role] || "/dashboard/customer";
	};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation isAuthenticated={isAuthenticated} getDashboardLink={getDashboardLink} logout={logout} />
      
      <main className="flex-grow pt-32 pb-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-gray-900">Get a Shipping Quote</h1>
                <p className="text-gray-600 mt-2">Check rates and delivery times instantly</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <Card className="p-6">
                        <form onSubmit={handleMatch} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <LocationInput
                                    label="Origin City"
                                    value={formData.origin}
                                    onChange={(val) => setFormData({...formData, origin: val})}
                                    required
                                />
                                <LocationInput
                                    label="Destination City"
                                    value={formData.destination}
                                    onChange={(val) => setFormData({...formData, destination: val})}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Input
                                    label="Weight (kg)"
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={formData.weight}
                                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                                    required
                                    placeholder="e.g. 5.5"
                                />
                                <Select
                                    label="Transport Mode"
                                    options={transportModes}
                                    value={formData.transport_mode}
                                    onChange={(e) => setFormData({...formData, transport_mode: e.target.value})}
                                />
                                <Select
                                    label="Service Level"
                                    options={serviceLevels}
                                    value={formData.service_level}
                                    onChange={(e) => setFormData({...formData, service_level: e.target.value})}
                                />
                            </div>

                            <Button 
                                type="submit" 
                                variant="primary" 
                                fullWidth 
                                loading={loading}
                                className="h-12 text-lg"
                            >
                                Calculate Rate
                            </Button>
                        </form>
                    </Card>
                </div>

                <div className="md:col-span-1">
                    {error && (
                        <Alert type="error" className="mb-6">{error}</Alert>
                    )}

                    {result ? (
                        <Card className="bg-blue-50 border-blue-200">
                            <div className="p-4 space-y-6">
                                <div className="text-center border-b border-blue-200 pb-4">
                                    <p className="text-sm text-gray-600 uppercase tracking-wide">Estimated Cost</p>
                                    <h2 className="text-4xl font-bold text-blue-700 mt-2">
                                        ₦{result.match?.price?.toLocaleString()}
                                    </h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <Calendar className="w-5 h-5 text-blue-500" />
                                            <span>Est. Delivery</span>
                                        </div>
                                        <span className="font-semibold">{result.match?.eta} days</span>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <Truck className="w-5 h-5 text-blue-500" />
                                            <span>Distance</span>
                                        </div>
                                        <span className="font-semibold">{result.match?.distance_km} km</span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-gray-700">
                                            <Package className="w-5 h-5 text-blue-500" />
                                            <span>Weight</span>
                                        </div>
                                        <span className="font-semibold">{formData.weight} kg</span>
                                    </div>
                                </div>

                                <Button 
                                    fullWidth 
                                    variant="primary"
                                    onClick={() => window.location.href = '/auth/signup'}
                                >
                                    Ship Now
                                </Button>
                            </div>
                        </Card>
                    ) : (
                        <Card className="h-full flex items-center justify-center p-8 text-center text-gray-500">
                            <div>
                                <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Fill the form to see shipping rates and delivery estimates</p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}