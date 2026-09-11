"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Package, Search, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Pager, Panel, StatusBadge, ToneBadge } from "@/components/dashboard/kit";
import { apiClient } from "@/lib/api";
import { STATUS_OPTIONS, formatDate, formatMoney, routeLabel } from "@/lib/shipments";
import { useRemote } from "@/lib/useRemote";

type Place = { name?: string | null; line1?: string | null; city?: string | null; state?: string | null; country?: string | null } | null;
interface AdminShipment {
	id: number;
	shipment_reference: string;
	order_reference?: string | null;
	vendor_name?: string | null;
	carrier_name?: string | null;
	carrier_type?: "internal" | "external";
	external_carrier_reference?: string | null;
	driver?: { driver_code?: string } | null;
	agent?: { agent_code?: string } | null;
	pickup_address?: Place;
	delivery_address?: Place;
	status: string;
	createdAt: string;
	currency?: string;
	shipping_fee?: number | string;
}
interface Page {
	shipments: AdminShipment[];
	pagination: { page: number; limit: number; total: number; pages: number };
}

const LIMIT = 20;
const CARRIERS = [
	{ value: "", label: "All" },
	{ value: "internal", label: "Obana fleet" },
	{ value: "external", label: "Partners" },
];

/** Who is moving it: our driver, a partner carrier, or nobody yet. */
function Fulfilment({ s }: { s: AdminShipment }) {
	if (s.carrier_type === "external") {
		return (
			<span className="flex flex-wrap items-center gap-1.5">
				<span className="text-slate-700">{s.carrier_name || "Partner"}</span>
				{!s.external_carrier_reference && <ToneBadge tone="warning">Needs booking</ToneBadge>}
			</span>
		);
	}
	return s.driver?.driver_code ? <span className="text-slate-700">Driver {s.driver.driver_code}</span> : <ToneBadge tone="neutral">No driver yet</ToneBadge>;
}

export default function AdminShipmentsPage() {
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState("");
	const [carrier, setCarrier] = useState("");
	const [query, setQuery] = useState("");
	const [search, setSearch] = useState("");

	const key = JSON.stringify({ page, status, carrier, search });
	const { data, loading, error, retry } = useRemote<Page>(key, async () => {
		const res = await apiClient.getAllShipments({ page, limit: LIMIT, status: status || undefined, carrier_type: carrier || undefined, search: search || undefined });
		return res.data;
	});

	const shipments = data?.shipments ?? [];
	const pg = data?.pagination;
	const filtered = Boolean(status || carrier || search);

	const applySearch = (e: React.FormEvent) => {
		e.preventDefault();
		setSearch(query.trim());
		setPage(1);
	};
	const clearAll = () => {
		setQuery("");
		setSearch("");
		setStatus("");
		setCarrier("");
		setPage(1);
	};

	return (
		<DashboardLayout role="admin">
			<div className="space-y-5">
				<PageHeader title="Shipments" description="Every shipment on Obana — our fleet and partner carriers." />

				<div className="space-y-3">
					<form onSubmit={applySearch} className="flex gap-2" role="search">
						<label className="relative flex-1">
							<span className="sr-only">Search shipments</span>
							<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
							<input
								type="search"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Reference, order ID or vendor"
								className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
							/>
						</label>
						<button type="submit" className="h-12 shrink-0 rounded-xl bg-[#1B3B5F] px-5 text-sm font-semibold text-white hover:bg-[#15304d]">
							Search
						</button>
					</form>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by status">
							{[{ value: "", label: "All statuses" }, ...STATUS_OPTIONS].map((o) => (
								<button
									key={o.value || "all"}
									type="button"
									aria-pressed={status === o.value}
									onClick={() => {
										setStatus(o.value);
										setPage(1);
									}}
									className={`h-9 shrink-0 rounded-full px-3.5 text-sm font-medium transition ${
										status === o.value ? "bg-[#1B3B5F] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
									}`}
								>
									{o.label}
								</button>
							))}
						</div>
						<div className="inline-flex shrink-0 self-start rounded-xl border border-slate-200 bg-white p-1" role="group" aria-label="Filter by carrier">
							{CARRIERS.map((c) => (
								<button
									key={c.value || "all"}
									type="button"
									aria-pressed={carrier === c.value}
									onClick={() => {
										setCarrier(c.value);
										setPage(1);
									}}
									className={`h-8 rounded-lg px-3 text-sm font-medium ${carrier === c.value ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}
								>
									{c.label}
								</button>
							))}
						</div>
					</div>
				</div>

				<Panel flush>
					{loading ? (
						<ListSkeleton rows={6} />
					) : error ? (
						<ErrorState text={error} onRetry={retry} />
					) : !shipments.length ? (
						<EmptyState
							icon={Package}
							title={filtered ? "No shipments match" : "No shipments yet"}
							text={filtered ? "Try another status, carrier or search." : "New bookings from customers and connected platforms will appear here."}
							action={
								filtered ? (
									<button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
										<X className="h-4 w-4" aria-hidden /> Clear filters
									</button>
								) : undefined
							}
						/>
					) : (
						<>
							{/* Phones and tablets: cards */}
							<ul className="divide-y divide-slate-100 lg:hidden">
								{shipments.map((s) => (
									<li key={s.id}>
										<Link href={`/dashboard/admin/shipments/${s.shipment_reference}`} className="block px-4 py-4 hover:bg-slate-50">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="truncate font-semibold text-slate-900">{routeLabel(s.pickup_address, s.delivery_address)}</p>
													<p className="truncate font-mono text-xs text-slate-500">{s.shipment_reference}</p>
												</div>
												<StatusBadge status={s.status} />
											</div>
											<div className="mt-2 flex items-end justify-between gap-3 text-sm">
												<div className="min-w-0 space-y-1">
													<p className="truncate text-slate-500">
														{s.vendor_name || "—"} · {formatDate(s.createdAt)}
													</p>
													<Fulfilment s={s} />
												</div>
												<span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatMoney(s.shipping_fee, s.currency)}</span>
											</div>
										</Link>
									</li>
								))}
							</ul>

							{/* Desktop: table */}
							<div className="hidden overflow-x-auto lg:block">
								<table className="w-full text-left text-sm">
									<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
										<tr>
											<th className="px-5 py-3">Shipment</th>
											<th className="px-5 py-3">Route</th>
											<th className="px-5 py-3">Vendor</th>
											<th className="px-5 py-3">Handled by</th>
											<th className="px-5 py-3">Status</th>
											<th className="px-5 py-3 text-right">Amount</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{shipments.map((s) => (
											<tr key={s.id} className="group hover:bg-slate-50">
												<td className="px-5 py-3.5">
													<Link href={`/dashboard/admin/shipments/${s.shipment_reference}`} className="font-mono font-semibold text-[#1B3B5F] group-hover:underline">
														{s.shipment_reference}
													</Link>
													<p className="text-xs text-slate-500">{formatDate(s.createdAt)}{s.order_reference ? ` · ${s.order_reference}` : ""}</p>
												</td>
												<td className="px-5 py-3.5 text-slate-800">{routeLabel(s.pickup_address, s.delivery_address)}</td>
												<td className="max-w-[12rem] truncate px-5 py-3.5 text-slate-700">{s.vendor_name || "—"}</td>
												<td className="px-5 py-3.5">
													<Fulfilment s={s} />
												</td>
												<td className="px-5 py-3.5">
													<StatusBadge status={s.status} />
												</td>
												<td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatMoney(s.shipping_fee, s.currency)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</>
					)}

					{pg && !error && <Pager page={pg.page} pages={Math.max(pg.pages, 1)} total={pg.total} noun="shipments" onPage={setPage} disabled={loading} />}
				</Panel>
			</div>
		</DashboardLayout>
	);
}
