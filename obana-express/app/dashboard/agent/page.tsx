'use client';


import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Loader, Badge } from '@/components/ui';
import { Package, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';

export default function AgentDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    activeOrders: 0,
    pendingShipments: 0,
    customersCount: 0,
    recentShipments: []
  });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await apiClient.getAgentStats();
        if (response.success) {
          setData(response.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);
  
  const stats = [
    { label: 'Active Shipments', value: data.activeOrders, icon: Package, color: 'bg-blue-100 text-blue-600' },
    { label: 'Pending Shipments', value: data.pendingShipments, icon: TrendingUp, color: 'bg-yellow-100 text-yellow-600' },
    { label: 'Customers', value: data.customersCount, icon: Users, color: 'bg-green-100 text-green-600' },
  ];


  const recentShipments = data.recentShipments || [];

  return (
    <DashboardLayout role="agent">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agent Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage orders and shipments for your customers</p>
          </div>

        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader /></div>
        ) : (
          <>
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm font-medium">{stat.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
   

        {/* Recent Shipments */}
        <Card title="Recent Shipments" description="Your latest assigned shipments">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Shipment ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Customer</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.recentShipments.length > 0 ? data.recentShipments.map((shipment: any) => (
                  <tr key={shipment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{shipment.shipment_reference}</td>
                    <td className="py-3 px-4 text-gray-600">{shipment.vendor_name || 'N/A'}</td>
                    <td className="py-3 px-4">

                       <Badge
                        variant={
                          shipment.status === 'delivered' ? 'success' :
                          shipment.status === 'pending' ? 'warning' : 'info'
                        }
                      >
                        {shipment.status}
                      </Badge>
                    </td>
          
                   <td className="py-3 px-4 text-gray-600">{new Date(shipment.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/dashboard/agent/shipments/${shipment.shipment_reference}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="text-center py-4 text-gray-500">No recent shipments</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        </>
        )}
      </div>
    </DashboardLayout>
  );
}
