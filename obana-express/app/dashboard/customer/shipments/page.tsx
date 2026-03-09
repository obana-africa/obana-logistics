'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge, Loader } from '@/components/ui';
import { Package, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

interface Shipment {
  id: number;
  shipment_reference: string;
  status: string;
  total_weight: string;
  createdAt: string;
  delivery_address: {
    line1: string;
    city: string;
    state: string;
  };
  pickup_address: {
    city: string;
    state: string;
  };
}

export default function CustomerShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const userId = user?.id ? Number(user.id) : null;
    if (userId) {
      loadData(userId);
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const loadData = async (userId: number) => {
    setLoading(true);
    try {
      const [shipmentsResponse, statsResponse] = await Promise.all([
        apiClient.listShipments(userId),
        apiClient.getCustomerStats(),
      ]);

      if (shipmentsResponse.data) {
        setShipments(shipmentsResponse.data?.shipments || []);
      }
      if (statsResponse.success) {
        setStats(statsResponse.data);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats ? [
    { label: 'Total Shipments', value: stats.total, icon: Package, color: 'bg-gray-100 text-gray-600' },
    { label: 'Pending', value: stats.pending, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
    { label: 'In Transit', value: stats.in_transit, icon: Truck, color: 'bg-blue-100 text-blue-600' },
    { label: 'Delivered', value: stats.delivered, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
    { label: 'Issues', value: stats.cancelled + stats.failed + stats.returned, icon: XCircle, color: 'bg-red-100 text-red-600' },
  ] : [];

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'success';
      case 'in_transit': return 'info';
      case 'pending': return 'warning';
      case 'cancelled':
      case 'failed':
      case 'returned': return 'error';
      default: return 'default';
    }
  };

  return (
    <DashboardLayout role="customer">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">My Shipments</h1>
          <Link href="/dashboard/customer/shipments/new">
            <Button variant="primary">+ Create Shipment</Button>
          </Link>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${stat.color}`}><Icon className="w-5 h-5" /></div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader />
          </div>
        ) : shipments.length > 0 ? (
          <div className="space-y-4">
            {shipments.map((shipment) => (
              <Card key={shipment.id} className="hover:shadow-md transition-shadow p-0">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">
                      {shipment.pickup_address?.city || 'Origin'} → {shipment.delivery_address?.city || 'Destination'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{shipment.delivery_address?.line1}</p>
                    <div className="flex gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-600">Weight</p>
                        <p className="font-medium text-gray-900">{shipment.total_weight} kg</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Created</p>
                        <p className="font-medium text-gray-900">{new Date(shipment.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={getStatusVariant(shipment.status)}
                    >
                      {shipment.status}
                    </Badge>
                    <Link href={`/dashboard/customer/shipments/${shipment.shipment_reference}`} className="block mt-3">
                      <Button variant="ghost" size="sm">
                        Track Shipment
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          
        ) : (
          <Card className="p-6">
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No shipments yet</p>
              <Link href="/dashboard/customer/shipments/new">
                <Button variant="primary">Create Your First Shipment</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
