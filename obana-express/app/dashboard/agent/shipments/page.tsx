'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Loader, Badge, Button } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import Link from 'next/link';
import { Eye } from 'lucide-react';

export default function AgentShipmentsPage() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadShipments();
    }
  }, [user]);

  const loadShipments = async () => {
    try {
      // Pass role='agent' to filter correctly on backend
      const response = await apiClient.listShipments(Number(user?.id), { role: 'agent' });
      if (response.success) {
        setShipments(response.data.shipments);
      }
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="agent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Assigned Shipments</h1>
        </div>

        <Card>
          {loading ? (
            <div className="flex justify-center py-12"><Loader /></div>
          ) : shipments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                  <tr>
                    <th className="px-6 py-3">Reference</th>
                    <th className="px-6 py-3">Route</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Driver</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shipment) => (
                    <tr key={shipment.id} className="bg-white border-b hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{shipment.shipment_reference}</td>
                      <td className="px-6 py-4">
                        {shipment.pickup_address?.city} → {shipment.delivery_address?.city}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={shipment.status === 'delivered' ? 'success' : 'info'}>{shipment.status}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        {shipment.driver ? shipment.driver.driver_code : <span className="text-gray-400 italic">Unassigned</span>}
                      </td>
                      <td className="px-6 py-4">{new Date(shipment.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/dashboard/agent/shipments/${shipment.shipment_reference}`}>
                          <Button variant="ghost" size="sm"><Eye className="w-4 h-4" /></Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No shipments assigned yet.</div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
