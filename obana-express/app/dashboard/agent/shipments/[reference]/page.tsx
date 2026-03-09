'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge, Loader, SelectP, Alert, Label, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { useAuth } from '@/lib/authContext';
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

  const { user } = useAuth();

  // status update state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: '', location: '', notes: '' });
  const [updating, setUpdating] = useState(false);

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

  const handleUpdateClick = () => {
    setUpdateForm({ status: shipment.status, location: '', notes: '' });
    setShowUpdateModal(true);
    setMessage({ type: '', text: '' });
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment) return;
    setUpdating(true);
    try {
      await apiClient.updateShipmentStatus(shipment.id.toString(), updateForm.status, updateForm.notes, updateForm.location);
      setShowUpdateModal(false);
      loadData();
      setMessage({ type: 'success', text: 'Status updated successfully' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to update status' });
    } finally {
      setUpdating(false);
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

                <div className="space-y-2">
                  <Label>Assign Driver</Label>
                  <SelectP value={selectedDriver} onValueChange={setSelectedDriver}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id.toString()}>
                          {`${d.driver_code} - ${d.vehicle_type} (${d.user?.email})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </SelectP>
                </div>
                
                <Button fullWidth variant="primary" onClick={handleAssignDriver} loading={assigning} disabled={!selectedDriver}>Assign Driver</Button>
              </div>
            </Card>

            {shipment.agent_id === (user?.agent_profile?.id ?? null) && (
              <Card title="Update Status">
                <div className="flex flex-col gap-2">
                  <span>Current status: <strong className="capitalize">{shipment.status}</strong></span>
                  <Button variant="primary" onClick={handleUpdateClick}>
                    Change Status
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="bg-white rounded-lg w-11/12 max-w-md p-6">
            <h2 className="text-xl font-semibold mb-4">Update Shipment Status</h2>
            <form onSubmit={handleUpdateSubmit} className="space-y-4">
              <div>
                <Label className="mb-2 block">Status</Label>
                <SelectP value={updateForm.status} onValueChange={(value) => setUpdateForm({ ...updateForm, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="picked_up">Picked Up</SelectItem>
                    <SelectItem value="in_transit">In Transit</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                  </SelectContent>
                </SelectP>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Location (optional)</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  value={updateForm.location}
                  onChange={(e) => setUpdateForm({ ...updateForm, location: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
                <textarea
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  value={updateForm.notes}
                  onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowUpdateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={updating}>
                  Update
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
