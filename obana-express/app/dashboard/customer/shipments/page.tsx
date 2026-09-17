'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Badge, Loader } from '@/components/ui';
import { Package, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import { Pager } from '@/components/dashboard/kit';
import { statusMeta, whenText as when } from "@/lib/shipments";

// The server sends shipments a page at a time (without paging, only the latest 20 ever showed).
const PAGE_SIZE = 20;

interface Shipment {
  id: number;
  shipment_reference: string;
  status: string;
  display_status?: string;
  total_weight: string;
  total_items?: number;
  createdAt: string;
  source?: { system: string; order_number?: string | null; ordered_at?: string | null } | null;
  delivery_address: { line1: string; city: string; state: string };
  pickup_address: { city: string; state: string };
}



export default function CustomerShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const userId = user?.id ? Number(user.id) : null;
    if (userId) {
      loadData(userId, page);
    } else {
      setLoading(false);
    }
  }, [user?.id, page]);

  const loadData = async (userId: number, pageNo: number) => {
    setLoading(true);
    try {
      const [shipmentsResponse, statsResponse] = await Promise.all([
        apiClient.listShipments(userId, { page: pageNo, limit: PAGE_SIZE }),
        apiClient.getCustomerStats(),
      ]);

      if (shipmentsResponse.data) {
        setShipments(shipmentsResponse.data?.shipments || []);
        const pg = shipmentsResponse.data?.pagination;
        setPages(Math.max(1, pg?.pages || 1));
        setTotal(pg?.total ?? 0);
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

  // The same three stages the badges and the sales order show, so the cards and
  // the list below cannot disagree about where anything is.
  const statCards = stats ? [
    { label: 'Total', value: stats.total, icon: Package, color: 'bg-slate-100 text-slate-600' },
    { label: 'Package Created', value: stats.package_created ?? stats.pending, icon: Clock, color: 'bg-amber-100 text-amber-700' },
    { label: 'In Transit', value: stats.shipped ?? stats.in_transit, icon: Truck, color: 'bg-blue-100 text-blue-700' },
    { label: 'Fulfilled', value: stats.fulfilled ?? stats.delivered, icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700' },
    { label: 'Issues', value: stats.issues ?? (stats.cancelled + stats.failed + stats.returned), icon: XCircle, color: 'bg-rose-100 text-rose-700' },
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My Shipments</h1>
            {total > 0 && <p className="mt-1 text-sm text-gray-500">{total} shipment{total === 1 ? '' : 's'}</p>}
          </div>
          <Link href="/dashboard/customer/shipments/new" className="shrink-0">
            <Button variant="primary">+ Create Shipment</Button>
          </Link>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 sm:gap-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-gray-600 sm:text-sm">{stat.label}</p>
                      <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{stat.value ?? 0}</p>
                    </div>
                    <div className={`shrink-0 rounded-lg p-2 ${stat.color}`}><Icon className="h-5 w-5" /></div>
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
              <Card key={shipment.id} className="transition-shadow hover:shadow-md">
                {/* Stacks on a phone and sits side by side from tablet up — the
                    status and the action must never be pushed off the edge. */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">
                        {shipment.pickup_address?.city || 'Origin'} → {shipment.delivery_address?.city || 'Destination'}
                      </h3>
                      <Badge variant={getStatusVariant(shipment.status)}>
                        {shipment.display_status || statusMeta(shipment.status).label}
                      </Badge>
                    </div>

                    <p className="mt-1 truncate text-sm text-gray-600">
                      {[shipment.delivery_address?.line1, shipment.delivery_address?.state].filter(Boolean).join(', ')}
                    </p>

                    <p className="mt-2 font-mono text-xs text-gray-500">
                      {shipment.shipment_reference}
                      {shipment.source?.order_number ? ` · ${shipment.source.system} ${shipment.source.order_number}` : ''}
                    </p>

                    <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-gray-500">Weight</dt>
                        <dd className="font-medium text-gray-900">{Number(shipment.total_weight || 0).toFixed(2)} kg</dd>
                      </div>
                      {shipment.total_items != null && (
                        <div>
                          <dt className="text-xs text-gray-500">Items</dt>
                          <dd className="font-medium text-gray-900">{shipment.total_items}</dd>
                        </div>
                      )}
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-xs text-gray-500">Created</dt>
                        <dd className="font-medium text-gray-900">{when(shipment.createdAt)}</dd>
                      </div>
                    </dl>
                  </div>

                  <Link
                    href={`/dashboard/customer/shipments/${shipment.shipment_reference}`}
                    className="shrink-0 sm:self-center"
                  >
                    <Button variant="ghost" size="sm" className="w-full sm:w-auto">
                      Track Shipment
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
            <Pager
              page={page}
              pages={pages}
              total={total}
              noun="shipments"
              onPage={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              disabled={loading}
            />
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
