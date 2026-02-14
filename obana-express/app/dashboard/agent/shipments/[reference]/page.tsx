'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge, Loader, Select, Alert } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { ArrowLeft, MapPin, User, Truck } from 'lucide-react';
import Link from 'next/link';

export default function AgentShipmentDetailsPage() {
  const params = useParams();
  const reference = params.reference as string;
  const [shipment, setShipment] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, [reference]);

  const loadData = async () => {
    try {
      const [shipmentRes, driversRes] = await Promise.all([
        apiClient.getShipment(reference),
        apiClient.listDrivers()
      ]);

      if (shipmentRes.success) {
        setShipment(shipmentRes.data);
        if (shipmentRes.data.driver_id) {
          setSelectedDriver(shipmentRes.data.driver_id.toString());
        }
      }
      
      if (driversRes.status  && driversRes.data) {
        setDrivers(driversRes.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedDriver) return;
    setAssigning(true);
    setMessage({ type: '', text: '' });
    
    try {
      await apiClient.assignDriver(shipment.id, selectedDriver);
      setMessage({ type: 'success', text: 'Driver assigned successfully' });
      loadData(); // Reload to refresh status
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to assign driver' });
    } finally {
      setAssigning(false);
    }
  };

  if (loading) return <DashboardLayout role="agent"><div className="flex justify-center py-12"><Loader /></div></DashboardLayout>;
  if (!shipment) return <DashboardLayout role="agent"><div className="text-center py-12">Shipment not found</div></DashboardLayout>;

  return (
    <DashboardLayout role="agent">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/agent/shipments">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-5 h-5" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{shipment.shipment_reference}</h1>
            <p className="text-gray-600 text-sm">Manage shipment details</p>
          </div>
        </div>

        {message.text && <Alert type={message.type as 'success' | 'error'}>{message.text}</Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card title="Route Information">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1"><div className="w-2 h-2 rounded-full bg-blue-500" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Pickup</p>
                    <p className="font-medium">{shipment.pickup_address?.line1}, {shipment.pickup_address?.city}</p>
                    <p className="text-sm text-gray-600">{shipment.pickup_address?.name} • {shipment.pickup_address?.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1"><div className="w-2 h-2 rounded-full bg-green-500" /></div>
                  <div>
                    <p className="text-xs text-gray-500">Delivery</p>
                    <p className="font-medium">{shipment.delivery_address?.line1}, {shipment.delivery_address?.city}</p>
                    <p className="text-sm text-gray-600">{shipment.delivery_address?.name} • {shipment.delivery_address?.phone}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card title="Items">
              {shipment.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between py-2 border-b last:border-0">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="font-medium">{item.weight}kg</span>
                </div>
              ))}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Driver Assignment">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-5 h-5 text-gray-500" />
                  <span className="font-medium">Current Driver</span>
                </div>
                {shipment.driver ? (
                  <div className="bg-gray-50 p-3 rounded-lg mb-4">
                    <p className="font-bold">{shipment.driver.driver_code}</p>
                    <p className="text-sm text-gray-600 capitalize">{shipment.driver.vehicle_type} • {shipment.driver.vehicle_registration}</p>
                  </div>
                ) : (
                  <p className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded mb-4">No driver assigned</p>
                )}

                <Select
                  label="Assign Driver"
                  value={selectedDriver}
                  onChange={(e) => setSelectedDriver(e.target.value)}
                  options={[{ value: '', label: 'Select a driver' }, ...drivers.map(d => ({ value: d.id, label: `${d.driver_code} - ${d.vehicle_type} (${d.user?.email})` }))]}
                />
                
                <Button fullWidth variant="primary" onClick={handleAssignDriver} loading={assigning} disabled={!selectedDriver}>Assign Driver</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
