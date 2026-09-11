"use client";

import React from "react";
import Link from "next/link";
import { Banknote, ChevronRight, Clock, Package, Route, ShieldCheck, Truck, UserPlus, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, StatCard } from "@/components/dashboard/kit";
import { apiClient } from "@/lib/api";
import { formatMoney, statusMeta, timeAgo } from "@/lib/shipments";
import { useRemote } from "@/lib/useRemote";

interface Activity {
	type: "shipment" | "user" | "route";
	description: string;
	performed_by?: string;
	reference?: string;
	createdAt: string;
}
interface AdminStats {
	totalRoutes: number;
	activeDrivers: number;
	pendingShipments: number;
	revenue: number;
	recentActivity: Activity[];
}

const ACTIVITY_ICON = { shipment: Package, user: UserPlus, route: Route } as const;

const SHORTCUTS = [
	{ label: "Shipments", text: "Assign drivers, update status", href: "/dashboard/admin/shipments", icon: Package },
	{ label: "Routes & pricing", text: "Rates, markup and coverage", href: "/dashboard/admin/routes", icon: Route },
	{ label: "Drivers", text: "Add and manage drivers", href: "/dashboard/admin/drivers", icon: Truck },
	{ label: "Agents", text: "Verify and manage agents", href: "/dashboard/admin/agents", icon: ShieldCheck },
	{ label: "Users", text: "Customers and accounts", href: "/dashboard/admin/users", icon: Users },
];

export default function AdminDashboard() {
	const { data, loading, error, retry } = useRemote<AdminStats>("admin-stats", async () => (await apiClient.getAdminStats()).data);

	return (
		<DashboardLayout role="admin">
			<div className="space-y-6">
				<PageHeader title="Operations overview" description="What needs attention across Obana today." />

				{error ? (
					<Panel>
						<ErrorState text={error} onRetry={retry} />
					</Panel>
				) : (
					<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
						<StatCard label="Awaiting pickup" value={data?.pendingShipments ?? 0} icon={Clock} tone="warning" loading={loading} />
						<StatCard label="Active drivers" value={data?.activeDrivers ?? 0} icon={Truck} tone="success" loading={loading} />
						<StatCard label="Route templates" value={data?.totalRoutes ?? 0} icon={Route} tone="info" loading={loading} />
						<StatCard label="Revenue this month" value={formatMoney(data?.revenue ?? 0)} icon={Banknote} tone="progress" loading={loading} hint="Excludes cancelled and failed" />
					</div>
				)}

				<div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
					<Panel title="Manage" flush>
						<ul className="divide-y divide-slate-100">
							{SHORTCUTS.map(({ label, text, href, icon: Icon }) => (
								<li key={href}>
									<Link href={href} className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5">
										<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1B3B5F]/5 text-[#1B3B5F]">
											<Icon className="h-5 w-5" aria-hidden />
										</span>
										<span className="min-w-0 flex-1">
											<span className="block font-medium text-slate-900">{label}</span>
											<span className="block truncate text-sm text-slate-500">{text}</span>
										</span>
										<ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden />
									</Link>
								</li>
							))}
						</ul>
					</Panel>

					<Panel title="Recent activity" flush>
						{loading ? (
							<ListSkeleton rows={5} />
						) : !data?.recentActivity?.length ? (
							<EmptyState icon={Clock} title="No activity yet" text="Shipment updates, sign-ups and route changes will show here." />
						) : (
							<ul className="divide-y divide-slate-100">
								{data.recentActivity.map((a, i) => {
									const Icon = ACTIVITY_ICON[a.type] ?? Package;
									return (
										<li key={i} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
											<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
												<Icon className="h-4 w-4" aria-hidden />
											</span>
											<div className="min-w-0 flex-1">
												<p className="font-medium text-slate-900 first-letter:uppercase">{a.type === "shipment" ? statusMeta(a.description).label : a.description}</p>
												<p className="truncate text-sm text-slate-500">
													{a.performed_by || "System"}
													{a.reference ? ` · ${a.reference}` : ""}
												</p>
											</div>
											<time className="shrink-0 text-xs text-slate-500" dateTime={a.createdAt}>
												{timeAgo(a.createdAt)}
											</time>
										</li>
									);
								})}
							</ul>
						)}
					</Panel>
				</div>
			</div>
		</DashboardLayout>
	);
}
