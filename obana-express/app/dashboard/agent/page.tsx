"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Clock, Package, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, StatCard, StatusBadge } from "@/components/dashboard/kit";
import { apiClient } from "@/lib/api";
import { formatDate } from "@/lib/shipments";
import { useRemote } from "@/lib/useRemote";

interface AgentStats {
	activeOrders: number;
	pendingShipments: number;
	customersCount: number;
	recentShipments: { id: number; shipment_reference: string; vendor_name?: string; status: string; createdAt: string }[];
}

export default function AgentDashboard() {
	const { data, loading, error, retry } = useRemote<AgentStats>("agent-stats", async () => (await apiClient.getAgentStats()).data);

	return (
		<DashboardLayout role="agent">
			<div className="space-y-6">
				<PageHeader title="Agent overview" description="Shipments and customers in your area." />

				{error ? (
					<Panel>
						<ErrorState text={error} onRetry={retry} />
					</Panel>
				) : (
					<>
						<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
							<StatCard label="Active shipments" value={data?.activeOrders ?? 0} icon={Package} tone="progress" loading={loading} />
							<StatCard label="Awaiting pickup" value={data?.pendingShipments ?? 0} icon={Clock} tone="warning" loading={loading} />
							<StatCard label="Customers" value={data?.customersCount ?? 0} icon={Users} tone="success" loading={loading} />
						</div>

						<Panel
							title="Recent shipments"
							flush
							actions={
								<Link href="/dashboard/agent/shipments" className="inline-flex items-center gap-1 text-sm font-semibold text-[#1B3B5F] hover:underline">
									View all <ArrowRight className="h-4 w-4" aria-hidden />
								</Link>
							}
						>
							{loading ? (
								<ListSkeleton rows={3} />
							) : !data?.recentShipments?.length ? (
								<EmptyState icon={Package} title="No shipments yet" text="Shipments assigned to you will appear here." />
							) : (
								<ul className="divide-y divide-slate-100">
									{data.recentShipments.map((sh) => (
										<li key={sh.id}>
											<Link href={`/dashboard/agent/shipments/${sh.shipment_reference}`} className="flex items-center gap-4 px-4 py-4 transition hover:bg-slate-50 sm:px-5">
												<div className="min-w-0 flex-1">
													<p className="truncate font-mono text-sm font-semibold text-slate-900">{sh.shipment_reference}</p>
													<p className="truncate text-sm text-slate-500">
														{sh.vendor_name || "Customer"} · {formatDate(sh.createdAt)}
													</p>
												</div>
												<StatusBadge status={sh.status} />
											</Link>
										</li>
									))}
								</ul>
							)}
						</Panel>
					</>
				)}
			</div>
		</DashboardLayout>
	);
}
