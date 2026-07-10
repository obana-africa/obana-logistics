'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, Button, Input, Badge, Loader, Select } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { Search, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface ShipmentType {
  id: number;
  shipment_reference: string;
  order_reference: string;
  vendor_name: string;
  carrier_name: string;
  agent?: {
    agent_code: string;
    user?: {
      email: string;
    } | null;
  } | null;
  driver?: {
    driver_code: string;
    user?: {
      email: string;
    } | null;
  } | null;
  pickup_address?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zip_code?: string | null;
  } | null;
  delivery_address?: {
    name?: string | null;
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zip_code?: string | null;
  } | null;
  status: string;
  createdAt: string;
  currency: string;
  shipping_fee: number;
}

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    carrier_type: ''
  });

  useEffect(() => {
    loadShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, filters.status, filters.carrier_type]);

  const loadShipments = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getAllShipments({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
        status: filters.status === 'all' ? '' : filters.status,
        carrier_type: filters.carrier_type === 'all' ? '' : filters.carrier_type
      });

      if (response.success && response.data) {
        setShipments(response.data.shipments);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    loadShipments();
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.pages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const formatAddress = (address: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zip_code?: string | null;
  } | null | undefined) => {
    if (!address) return '';
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.country
    ].filter(Boolean);
    const mainAddress = parts.join(', ');
    return address.zip_code ? `${mainAddress} - ${address.zip_code}` : mainAddress;
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
            <p className="text-gray-600">Manage and track all shipments</p>
          </div>
        </div>

        <Card>
          <div className="p-4 border-b border-gray-200 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <form onSubmit={handleSearch} className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by reference, order ID, or vendor..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </form>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="w-40">
                  <Select
                    options={[
                      { value: 'all', label: 'All Status' },
                      { value: 'pending', label: 'Pending' },
                      { value: 'confirmed', label: 'Confirmed' },
                      { value: 'in_transit', label: 'In Transit' },
                      { value: 'delivered', label: 'Delivered' },
                      { value: 'cancelled', label: 'Cancelled' },
                      { value: 'failed', label: 'Failed' }
                    ]}
                    value={filters.status || 'all'}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, status: e.target.value }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                  />
                </div>
                <div className="w-40">
                  <Select
                    options={[
                      { value: 'all', label: 'All Carriers' },
                      { value: 'internal', label: 'Internal' },
                      { value: 'external', label: 'External' }
                    ]}
                    value={filters.carrier_type || 'all'}
                    onChange={(e) => {
                      setFilters(prev => ({ ...prev, carrier_type: e.target.value }));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                      <th className="px-6 py-3">Reference / Order ID</th>
                      <th className="px-6 py-3">Vendor</th>
                      <th className="px-6 py-3">Assigned Staff</th>
                      <th className="px-6 py-3">Pickup Contact & Address</th>
                      <th className="px-6 py-3">Destination Contact & Address</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-nowrap">Date</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipments.length > 0 ? (
                      shipments.map((shipment) => (
                        <tr key={shipment.id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-6 py-4 font-medium text-gray-500">
                            <div className="font-semibold text-blue-900">{shipment.shipment_reference}</div>
                            <div className="text-xs text-gray-500 mt-1">Order Ref: <span className="font-semibold text-gray-700">{shipment.order_reference}</span></div>
                            <div className="text-xs text-gray-400 mt-0.5">{shipment.carrier_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-800">{shipment.vendor_name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2">
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-0.5">Agent</span>
                                {shipment.agent ? (
                                  <div>
                                    <div className="font-medium text-gray-900 text-xs">{shipment.agent.agent_code}</div>
                                    <div className="text-xs text-gray-500 max-w-[140px] truncate" title={shipment.agent.user?.email}>{shipment.agent.user?.email}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">Unassigned</span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-0.5">Driver</span>
                                {shipment.driver ? (
                                  <div>
                                    <div className="font-medium text-gray-900 text-xs">{shipment.driver.driver_code}</div>
                                    <div className="text-xs text-gray-500 max-w-[140px] truncate" title={shipment.driver.user?.email}>{shipment.driver.user?.email}</div>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">Unassigned</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-[220px]">
                            <div className="font-medium text-gray-900 text-xs mb-1">{shipment.pickup_address?.name || 'N/A'}</div>
                            <div className="text-xs text-gray-500 whitespace-normal break-words" title={formatAddress(shipment.pickup_address)}>
                              {formatAddress(shipment.pickup_address) || <span className="text-gray-400 italic">No address details</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-[220px]">
                            <div className="font-medium text-gray-900 text-xs mb-1">{shipment.delivery_address?.name || 'N/A'}</div>
                            <div className="text-xs text-gray-500 whitespace-normal break-words" title={formatAddress(shipment.delivery_address)}>
                              {formatAddress(shipment.delivery_address) || <span className="text-gray-400 italic">No address details</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                shipment.status === 'delivered' ? 'success' :
                                shipment.status === 'in_transit' ? 'info' :
                                shipment.status === 'cancelled' || shipment.status === 'failed' ? 'error' :
                                'warning'
                              }
                              className="capitalize"
                            >
                              {shipment.status.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {new Date(shipment.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {new Intl.NumberFormat('en-NG', { style: 'currency', currency: shipment.currency }).format(shipment.shipping_fee)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Link href={`/dashboard/admin/shipments/${shipment.shipment_reference}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                          No shipments found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}