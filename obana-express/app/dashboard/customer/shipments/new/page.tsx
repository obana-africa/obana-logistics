/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Select, Alert } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Package, MapPin, Truck, Clock } from 'lucide-react';
import { LocationInput } from '@/components/LocationInput';

export default function CreateShipmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [newShipmentInfo, setNewShipmentInfo] = useState<any>(null);
  const [matchedRoute, setMatchedRoute] = useState<any>(null);
  const [step, setStep] = useState<'details' | 'match' | 'confirm'>('details');
  const [formData, setFormData] = useState({
    transport_mode: '',
    service_level: '',
    pickup_address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      country: '',
      countryCode: '',
      phone: '',
      contact_name: '',
      email: '',
      zip_code: ''
    },
    delivery_address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      country: '',
      countryCode: '',
      phone: '',
      first_name: '',
      last_name: '',
      email: '',
      zip_code: ''
    },
    carrier_slug: 'obana',
    items: [{ name: '', description: '', quantity: '1', weight: '0', price: '' }],
  });

  const transportModes = [
    { value: 'road', label: '🚚 Road Transport' },
    { value: 'air', label: '✈️ Air Transport' },
    { value: 'sea', label: '🚢 Sea Transport' },
  ];

  const serviceLevels = [
    { value: 'Standard', label: '📦 Standard (5-7 days)' },
    { value: 'Express', label: '⚡ Express (2-3 days)' },
    { value: 'Economy', label: '🐢 Economy (7-14 days)' },
  ];

  const resetForm = () => {
    setFormData({
      transport_mode: '',
      service_level: '',
      pickup_address: {
        line1: '', line2: '', city: '', state: '', country: '', countryCode: '', 
        phone: '', contact_name: '', email: '', zip_code: ''
      },
      delivery_address: {
        line1: '', line2: '', city: '', state: '', country: '', countryCode: '', 
        phone: '', first_name: '', last_name: '', email: '', zip_code: ''
      },
      carrier_slug: 'obana',
      items: [{ name: '', description: '', quantity: '1', weight: '0', price: '' }],
    });
    setError('');
    setMatchedRoute(null);
    setStep('details');
    setShowSuccessModal(false);
    setNewShipmentInfo(null);
  };

  const handleMatchRoute = async () => {
    // Validate location fields
    if (!formData.pickup_address.city || !formData.pickup_address.state || !formData.pickup_address.country) {
      setError('Please select a complete pickup location (City, State, and Country)');
      return;
    }

    if (!formData.delivery_address.city || !formData.delivery_address.state || !formData.delivery_address.country) {
      setError('Please select a complete delivery location (City, State, and Country)');
      return;
    }

    if (formData.items.length === 0 || formData.items.some(item => !item.name || !item.quantity || !item.price)) {
      setError('Please add at least one item with all required fields');
      return;
    }

    if (!formData.transport_mode || !formData.service_level) {
      setError('Please select Transport Mode and Service Level');
      return;
    }

    setLoading(true);
    try {
      const totalWeight = formData.items.reduce(
        (sum, item) => sum + ((parseFloat(item.weight) || 0) * (parseInt(item.quantity) || 1)), 
        0
      );

      const response = await apiClient.matchRoute(
        totalWeight,
        formData.pickup_address.city,
        formData.delivery_address.city,
        formData.transport_mode,
        formData.service_level
      );

      if (response.data) {
        setMatchedRoute(response.data);
        setStep('match');
        setError('');
      } else {
        setError('No matching routes found. Try different parameters.');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error matching routes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!matchedRoute) return;

    if (!formData.pickup_address.line1 || !formData.pickup_address.phone) {
      setError('Please fill in required pickup address fields (Street Address and Phone)');
      return;
    }

    if (!formData.delivery_address.line1 || !formData.delivery_address.phone) {
      setError('Please fill in required delivery address fields (Street Address and Phone)');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.createShipment({
        pickup_address: formData.pickup_address,
        delivery_address: formData.delivery_address,
        items: formData.items.map(item => ({
          name: item.name,
          description: item.description,
          quantity: parseInt(item.quantity),
          weight: parseFloat(item.weight || '0'),
          price: parseFloat(item.price),
          total_price: parseFloat(item.price) * parseInt(item.quantity),
        })),
        transport_mode: formData.transport_mode,
        service_level: formData.service_level,
        vendor_name: 'obana.africa',
        carrier_slug: 'obana',
        shipping_fee: matchedRoute.match.price,
        estimated_delivery: matchedRoute.match.estimated_delivery,
      });

      if (response.success && response.data) {
        setNewShipmentInfo(response.data);
        setShowSuccessModal(true);
      } else {
        setError(response.message || 'Error creating shipment');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creating shipment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="customer">
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Shipment</h1>
            <p className="text-gray-600 mt-1">Ship your package in 3 easy steps</p>
          </div>
          <Link href="/dashboard/customer/shipments">
            <Button variant="ghost">← Back</Button>
          </Link>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-3 ${step === 'details' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step === 'details' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                <Package className="h-5 w-5" />
              </div>
              <span className="font-medium">Details</span>
            </div>
            <div className="flex-1 h-1 mx-4 bg-gray-200">
              <div className={`h-full transition-all ${step !== 'details' ? 'bg-blue-600' : 'bg-gray-200'}`} 
                   style={{ width: step === 'match' ? '50%' : step === 'confirm' ? '100%' : '0%' }} />
            </div>
            <div className={`flex items-center gap-3 ${step === 'match' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step === 'match' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                <Truck className="h-5 w-5" />
              </div>
              <span className="font-medium">Pricing</span>
            </div>
            <div className="flex-1 h-1 mx-4 bg-gray-200">
              <div className={`h-full transition-all ${step === 'confirm' ? 'bg-blue-600' : 'bg-gray-200'}`} 
                   style={{ width: step === 'confirm' ? '100%' : '0%' }} />
            </div>
            <div className={`flex items-center gap-3 ${step === 'confirm' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step === 'confirm' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}>
                <Check className="h-5 w-5" />
              </div>
              <span className="font-medium">Confirm</span>
            </div>
          </div>
        </div>

        {error && (
          <Alert type="error" className="cursor-pointer" onClick={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Success Modal */}
        {showSuccessModal && newShipmentInfo && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Shipment Created!</h2>
              <p className="text-gray-600 mt-2 mb-6">Your shipment has been created successfully.</p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-2 text-sm mb-6">
                <p><span className="font-semibold">Tracking #:</span> {newShipmentInfo.shipment_reference}</p>
                <p><span className="font-semibold">Carrier:</span> {newShipmentInfo.carrier}</p>
                <p>
                  <span className="font-semibold">Status:</span> 
                  <span className="capitalize ml-1">{newShipmentInfo.status}</span>
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => router.push(`/dashboard/customer/shipments/${newShipmentInfo.shipment_reference}`)}
                  fullWidth
                  variant="primary"
                >
                  Track Shipment
                </Button>
                <Button onClick={resetForm} fullWidth variant="secondary">
                  Create Another Shipment
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 'details' && (
          <Card>
            <div className="space-y-8">
              {/* Pickup Location */}
              <div className="border-2 border-blue-100 rounded-xl p-6 bg-linear-to-br from-blue-50 to-white">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  Pickup Location
                </h3>
                <p className="text-sm text-gray-600 mb-5">Where should we collect the package?</p>

                <div className="space-y-5">
                  <LocationInput
                    label="Location"
                    value={{
                      city: formData.pickup_address.city,
                      state: formData.pickup_address.state,
                      country: formData.pickup_address.country,
                      countryCode: formData.pickup_address.countryCode,
                    }}
                    onChange={(location) => setFormData({
                      ...formData,
                      pickup_address: { 
                        ...formData.pickup_address, 
                        ...location 
                      }
                    })}
                    required
                    placeholder="Search for pickup city..."
                  />

                  <Input
                    label="Street Address *"
                    placeholder="e.g., 123 Main Street, Building A"
                    value={formData.pickup_address.line1}
                    onChange={(e) => setFormData({
                      ...formData,
                      pickup_address: { ...formData.pickup_address, line1: e.target.value }
                    })}
                    required
                  />

                  <Input
                    label="Apartment, Suite, etc. (Optional)"
                    placeholder="e.g., Apt 4B, Floor 2"
                    value={formData.pickup_address.line2}
                    onChange={(e) => setFormData({
                      ...formData,
                      pickup_address: { ...formData.pickup_address, line2: e.target.value }
                    })}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="ZIP/Postal Code"
                      placeholder="Optional"
                      value={formData.pickup_address.zip_code || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, zip_code: e.target.value }
                      })}
                    />
                    <Input
                      label="Phone Number *"
                      placeholder="+234 801 234 5678"
                      value={formData.pickup_address.phone}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, phone: e.target.value }
                      })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Contact Name"
                      placeholder="Pickup contact person"
                      value={formData.pickup_address.contact_name}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, contact_name: e.target.value }
                      })}
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="contact@example.com"
                      value={formData.pickup_address.email}
                      onChange={(e) => setFormData({
                        ...formData,
                        pickup_address: { ...formData.pickup_address, email: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Location */}
              <div className="border-2 border-green-100 rounded-xl p-6 bg-linear-to-br from-green-50 to-white">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  Delivery Location
                </h3>
                <p className="text-sm text-gray-600 mb-5">Where should we deliver the package?</p>

                <div className="space-y-5">
                  <LocationInput
                    label="Location"
                    value={{
                      city: formData.delivery_address.city,
                      state: formData.delivery_address.state,
                      country: formData.delivery_address.country,
                      countryCode: formData.delivery_address.countryCode,
                    }}
                    onChange={(location) => setFormData({
                      ...formData,
                      delivery_address: { 
                        ...formData.delivery_address, 
                        ...location 
                      }
                    })}
                    required
                    placeholder="Search for delivery city..."
                  />

                  <Input
                    label="Street Address *"
                    placeholder="e.g., 456 Elm Avenue"
                    value={formData.delivery_address.line1}
                    onChange={(e) => setFormData({
                      ...formData,
                      delivery_address: { ...formData.delivery_address, line1: e.target.value }
                    })}
                    required
                  />

                  <Input
                    label="Apartment, Suite, etc. (Optional)"
                    placeholder="e.g., Unit 12, Gate 3"
                    value={formData.delivery_address.line2}
                    onChange={(e) => setFormData({
                      ...formData,
                      delivery_address: { ...formData.delivery_address, line2: e.target.value }
                    })}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="ZIP/Postal Code"
                      placeholder="Optional"
                      value={formData.delivery_address.zip_code || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, zip_code: e.target.value }
                      })}
                    />
                    <Input
                      label="Phone Number *"
                      placeholder="+234 801 234 5678"
                      value={formData.delivery_address.phone}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, phone: e.target.value }
                      })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Recipient First Name"
                      placeholder="John"
                      value={formData.delivery_address.first_name}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, first_name: e.target.value }
                      })}
                    />
                    <Input
                      label="Recipient Last Name"
                      placeholder="Doe"
                      value={formData.delivery_address.last_name}
                      onChange={(e) => setFormData({
                        ...formData,
                        delivery_address: { ...formData.delivery_address, last_name: e.target.value }
                      })}
                    />
                  </div>

                  <Input
                    label="Recipient Email"
                    type="email"
                    placeholder="recipient@example.com"
                    value={formData.delivery_address.email}
                    onChange={(e) => setFormData({
                      ...formData,
                      delivery_address: { ...formData.delivery_address, email: e.target.value }
                    })}
                  />
                </div>
              </div>

              {/* Package Items */}
              <div className="border-2 border-purple-100 rounded-xl p-6 bg-linear-to-br from-purple-50 to-white">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  Package Items
                </h3>
                <p className="text-sm text-gray-600 mb-5">What are you shipping?</p>

                <div className="space-y-4">
                  {formData.items.map((item, index) => (
                    <div key={index} className="bg-white p-5 rounded-lg border-2 border-purple-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-purple-900">Item {index + 1}</span>
                        {formData.items.length > 1 && (
                          <Button
                            onClick={() => {
                              const newItems = formData.items.filter((_, i) => i !== index);
                              setFormData({ ...formData, items: newItems });
                            }}
                            variant="secondary"
                            className="py-1! px-3! text-sm bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Remove
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Item Name *"
                          placeholder="e.g., Laptop"
                          value={item.name}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].name = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          required
                        />
                        <Input
                          label="Quantity *"
                          type="number"
                          min="1"
                          placeholder="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].quantity = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          required
                        />
                      </div>

                      <Input
                        label="Description"
                        placeholder="Additional details (optional)"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[index].description = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Price (₦) *"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.price}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].price = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                          required
                        />
                        <Input
                          label="Weight (kg)"
                          type="number"
                          step="0.1"
                          placeholder="0.0"
                          value={item.weight}
                          onChange={(e) => {
                            const newItems = [...formData.items];
                            newItems[index].weight = e.target.value;
                            setFormData({ ...formData, items: newItems });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    setFormData({
                      ...formData,
                      items: [...formData.items, { name: '', description: '', quantity: '1', weight: '0', price: '' }]
                    });
                  }}
                  variant="secondary"
                  fullWidth
                  className="mt-4 border-2 border-purple-300 hover:bg-purple-50"
                >
                  + Add Another Item
                </Button>
              </div>

              {/* Shipping Method */}
              <div className="border-2 border-orange-100 rounded-xl p-6 bg-linear-to-br from-orange-50 to-white">
                <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  Shipping Method
                </h3>
                <p className="text-sm text-gray-600 mb-5">How would you like to ship?</p>

                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Transport Mode *"
                    options={transportModes}
                    value={formData.transport_mode}
                    onChange={(e) => setFormData({ ...formData, transport_mode: e.target.value })}
                    required
                  />
                  <Select
                    label="Service Level *"
                    options={serviceLevels}
                    value={formData.service_level}
                    onChange={(e) => setFormData({ ...formData, service_level: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button
                onClick={handleMatchRoute}
                loading={loading}
                fullWidth
                variant="primary"
                className="py-4! text-lg font-semibold"
              >
                Continue to Pricing →
              </Button>
            </div>
          </Card>
        )}

        {/* Step 2: Route Match */}
        {step === 'match' && matchedRoute && (
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Your Shipping Quote</h2>
              <p className="text-gray-600 mt-1">Based on your selected route and service</p>
            </div>

            <div className="bg-linear-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-blue-200">
                <div className="flex items-center gap-3">
                  <MapPin className="h-6 w-6 text-blue-600" />
                  <div>
                    <p className="text-sm text-gray-600">From</p>
                    <p className="font-semibold text-gray-900">{formData.pickup_address.city}, {formData.pickup_address.state}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm text-gray-600">To</p>
                    <p className="font-semibold text-gray-900">{formData.delivery_address.city}, {formData.delivery_address.state}</p>
                  </div>
                  <MapPin className="h-6 w-6 text-green-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Shipping Cost</p>
                  <p className="text-3xl font-bold text-green-600">
                    ₦{matchedRoute.match.price?.toLocaleString() || 'N/A'}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-5 shadow-sm">
                  <p className="text-sm text-gray-600 mb-1">Estimated Delivery</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {matchedRoute.match.eta || 'N/A'} days
                  </p>
                </div>
              </div>

              <div className="bg-white/80 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Transport Mode:</span>
                  <span className="font-semibold capitalize">{formData.transport_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Level:</span>
                  <span className="font-semibold">{formData.service_level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Weight:</span>
                  <span className="font-semibold">
                    {formData.items.reduce((sum, item) => 
                      sum + ((parseFloat(item.weight) || 0) * (parseInt(item.quantity) || 1)), 0
                    ).toFixed(2)} kg
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <Button onClick={() => setStep('confirm')} fullWidth variant="primary" className="py-3!">
                  Continue to Confirmation
                </Button>
                <Button onClick={() => setStep('details')} fullWidth variant="secondary">
                  ← Back to Details
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirm' && (
          <Card>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Review & Confirm</h2>
              <p className="text-gray-600 mt-1">Please review your shipment details</p>
            </div>

            <div className="space-y-5">
              {/* Shipment Summary */}
              <div className="bg-linear-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Shipment Summary
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Route</p>
                    <p className="font-semibold text-gray-900">
                      {formData.pickup_address.city} → {formData.delivery_address.city}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Transport</p>
                    <p className="font-semibold text-gray-900 capitalize">{formData.transport_mode}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Service Level</p>
                    <p className="font-semibold text-gray-900">{formData.service_level}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Shipping Cost</p>
                    <p className="font-bold text-green-600 text-lg">
                      ₦{matchedRoute?.match.price?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-blue-50/30">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Pickup Address
                  </h3>
                  <div className="text-sm space-y-1 text-gray-700">
                    {formData.pickup_address.contact_name && <p className="font-medium">{formData.pickup_address.contact_name}</p>}
                    <p>{formData.pickup_address.line1}</p>
                    {formData.pickup_address.line2 && <p>{formData.pickup_address.line2}</p>}
                    <p>{formData.pickup_address.city}, {formData.pickup_address.state}</p>
                    <p>{formData.pickup_address.country} {formData.pickup_address.zip_code}</p>
                    <p className="pt-1 font-medium">{formData.pickup_address.phone}</p>
                  </div>
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-green-50/30">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-green-600" />
                    Delivery Address
                  </h3>
                  <div className="text-sm space-y-1 text-gray-700">
                    {formData.delivery_address.first_name && (
                      <p className="font-medium">
                        {formData.delivery_address.first_name} {formData.delivery_address.last_name}
                      </p>
                    )}
                    <p>{formData.delivery_address.line1}</p>
                    {formData.delivery_address.line2 && <p>{formData.delivery_address.line2}</p>}
                    <p>{formData.delivery_address.city}, {formData.delivery_address.state}</p>
                    <p>{formData.delivery_address.country} {formData.delivery_address.zip_code}</p>
                    <p className="pt-1 font-medium">{formData.delivery_address.phone}</p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="border border-gray-200 rounded-lg p-5 bg-purple-50/30">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                  Items ({formData.items.length})
                </h3>
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start py-3 border-b last:border-0">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{item.name}</p>
                        {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
                        <p className="text-sm text-gray-500 mt-1">Weight: {item.weight || 0} kg</p>
                      </div>
                      <div className="text-right text-sm ml-4">
                        <p className="font-semibold text-gray-900">Qty: {item.quantity}</p>
                        <p className="text-gray-600 mt-1">
                          ₦{parseFloat(item.price || '0').toLocaleString('en-NG', { minimumFractionDigits: 2 })} each
                        </p>
                        <p className="font-bold text-gray-900 mt-1">
                          ₦{(parseFloat(item.price || '0') * parseInt(item.quantity)).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Button
                  onClick={handleCreateShipment}
                  loading={loading}
                  fullWidth
                  variant="primary"
                  className="py-4! text-lg font-semibold"
                >
                  ✓ Confirm & Create Shipment
                </Button>
                <Button onClick={() => setStep('details')} fullWidth variant="secondary">
                  ← Back to Details
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}