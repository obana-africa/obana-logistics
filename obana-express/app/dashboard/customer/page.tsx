"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Calculator, CheckCircle2, ChevronRight, Package, PackagePlus, Search, Timer } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ButtonLink, EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, StatCard, StatusBadge } from "@/components/dashboard/kit";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { formatDate, formatMoney, routeLabel } from "@/lib/shipments";
import { useRemote } from "@/lib/useRemote";

type Place = { city?: string; state?: string; country?: string };
interface Shipment {
	id: number;
	shipment_reference: string;
	status: string;
	createdAt: string;
	shipping_fee?: string | number;
	currency?: string;
	pickup_address?: Place;
	delivery_address?: Place;
}
interface CustomerStats {
	total: number;
	pending: number;
	in_transit: number;
	delivered: number;
	failed: number;
	cancelled: number;
	returned: number;
}

export default function CustomerDashboardPage() {
	const user = useAuthStore((s) => s.user);
	const userId = user?.id ? String(user.id) : null;
	const firstName = user?.first_name ?? user?.attributes?.first_name;

	const stats = useRemote<CustomerStats>(userId && `customer-stats:${userId}`, async () => (await apiClient.getCustomerStats()).data);
	const recent = useRemote<Shipment[]>(userId && `customer-recent:${userId}`, async () => (await apiClient.listShipments(Number(userId), { limit: 5 })).data?.shipments ?? []);

	const s = stats.data;
	const closed = s ? s.delivered + s.failed + s.cancelled + s.returned : 0;

	return (
		<DashboardLayout role="customer">
			<div className="space-y-6">
				<PageHeader
					title={firstName ? `Hi ${firstName}` : "Welcome back"}
					description="Here's how your shipments are doing."
					actions={
						<ButtonLink href="/dashboard/customer/shipments/new" icon={PackagePlus}>
							New shipment
						</ButtonLink>
					}
				/>

				{stats.error ? (
					<Panel>
						<ErrorState text={stats.error} onRetry={stats.retry} />
					</Panel>
				) : (
					<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
						<StatCard label="All shipments" value={s?.total ?? 0} icon={Package} loading={stats.loading} />
						<StatCard label="In progress" value={s ? s.total - closed : 0} icon={Timer} tone="progress" loading={stats.loading} />
						<StatCard label="Delivered" value={s?.delivered ?? 0} icon={CheckCircle2} tone="success" loading={stats.loading} />
						<StatCard label="Awaiting pickup" value={s?.pending ?? 0} icon={Package} tone="warning" loading={stats.loading} />
					</div>
				)}

				<div className="grid gap-3 sm:grid-cols-3">
					{[
						{ href: "/dashboard/customer/shipments/new", icon: PackagePlus, title: "Send a package", text: "Book pickup and delivery" },
						{ href: "/route-match", icon: Calculator, title: "Get a quote", text: "Compare prices before you book" },
						{ href: "/dashboard/customer/shipments", icon: Search, title: "Track shipments", text: "See where everything is" },
					].map(({ href, icon: Icon, title, text }) => (
						<Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#1B3B5F]/30 hover:shadow-sm">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1B3B5F]/5 text-[#1B3B5F]">
								<Icon className="h-5 w-5" aria-hidden />
							</span>
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-slate-900">{title}</span>
								<span className="block text-sm text-slate-500">{text}</span>
							</span>
							<ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" aria-hidden />
						</Link>
					))}
				</div>

				<Panel
					title="Recent shipments"
					flush
					actions={
						<Link href="/dashboard/customer/shipments" className="inline-flex items-center gap-1 text-sm font-semibold text-[#1B3B5F] hover:underline">
							View all <ArrowRight className="h-4 w-4" aria-hidden />
						</Link>
					}
				>
					{recent.loading ? (
						<ListSkeleton rows={3} />
					) : recent.error ? (
						<ErrorState text={recent.error} onRetry={recent.retry} />
					) : !recent.data?.length ? (
						<EmptyState
							icon={Package}
							title="No shipments yet"
							text="Book your first shipment — we'll collect it and keep you updated until it's delivered."
							action={<ButtonLink href="/dashboard/customer/shipments/new">Create a shipment</ButtonLink>}
						/>
					) : (
						<ul className="divide-y divide-slate-100">
							{recent.data.map((sh) => (
								<li key={sh.id}>
									<Link href={`/dashboard/customer/shipments/${sh.shipment_reference}`} className="flex items-center gap-4 px-4 py-4 transition hover:bg-slate-50 sm:px-5">
										<span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 sm:flex">
											<Package className="h-5 w-5" aria-hidden />
										</span>
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold text-slate-900">{routeLabel(sh.pickup_address, sh.delivery_address)}</p>
											<p className="truncate text-sm text-slate-500">
												<span className="font-mono">{sh.shipment_reference}</span> · {formatDate(sh.createdAt)}
											</p>
										</div>
										<div className="flex shrink-0 flex-col items-end gap-1.5">
											<StatusBadge status={sh.status} />
											{sh.shipping_fee != null && <span className="text-sm font-medium tabular-nums text-slate-700">{formatMoney(sh.shipping_fee, sh.currency)}</span>}
										</div>
									</Link>
								</li>
							))}
						</ul>
					)}
				</Panel>
			</div>
		</DashboardLayout>
	);
}
