"use client";

import React, { useState } from "react";
import { Search, Users, X } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, Panel } from "@/components/dashboard/kit";
import { apiClient, type StoreCustomer } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/shipments";
import { useRemote } from "@/lib/useRemote";

const place = (c: StoreCustomer) => [c.city, c.country].filter(Boolean).join(", ") || "—";
const contact = (c: StoreCustomer) => [c.email, c.phone].filter(Boolean).join(" · ");

function ViewButton({ c, onView }: { c: StoreCustomer; onView: (c: StoreCustomer) => void }) {
	return (
		<button
			type="button"
			onClick={() => onView(c)}
			aria-label={`View shipments for ${c.name || c.email || "this customer"}`}
			className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
		>
			View shipments
		</button>
	);
}

export function CustomersTab({ storeId, onViewShipments }: { storeId: string; onViewShipments: (c: StoreCustomer) => void }) {
	const { data, loading, error, retry } = useRemote<StoreCustomer[]>(`store-customers:${storeId}`, async () => (await apiClient.listStoreCustomers(storeId)).data ?? []);
	const [query, setQuery] = useState("");

	const q = query.trim().toLowerCase();
	const all = data ?? [];
	const customers = q ? all.filter((c) => [c.name, c.email, c.phone].some((v) => v?.toLowerCase().includes(q))) : all;

	return (
		<div className="space-y-4">
			<label className="relative block">
				<span className="sr-only">Search customers</span>
				<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Name, email or phone"
					className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
				/>
			</label>

			<Panel flush title="Customers" description={data ? `${all.length.toLocaleString()} ${all.length === 1 ? "person has" : "people have"} received shipments from this store` : undefined}>
				{loading && !data ? (
					<ListSkeleton rows={4} />
				) : error ? (
					<ErrorState text={error} onRetry={retry} />
				) : !customers.length ? (
					<EmptyState
						icon={Users}
						title={q ? "No customers match" : "No customers yet"}
						text={q ? "Try a different name, email or phone number." : "Everyone your store ships to appears here, with their orders and totals."}
						action={
							q ? (
								<button type="button" onClick={() => setQuery("")} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
									<X className="h-4 w-4" aria-hidden /> Clear search
								</button>
							) : undefined
						}
					/>
				) : (
					<>
						<ul className="divide-y divide-slate-100 lg:hidden">
							{customers.map((c, i) => (
								<li key={`${c.customer_id ?? "x"}-${c.email ?? c.name ?? i}`} className="px-4 py-4">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="truncate font-semibold text-slate-900">{c.name || "Unnamed customer"}</p>
											<p className="truncate text-sm text-slate-500">{contact(c) || "No contact details"}</p>
											<p className="truncate text-xs text-slate-500">{place(c)}</p>
										</div>
										<span className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">{formatMoney(c.total_fees)}</span>
									</div>
									<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
										<p className="text-xs text-slate-600">
											<strong className="text-slate-900">{c.shipments}</strong> shipments · <strong className="text-emerald-700">{c.delivered}</strong> delivered ·{" "}
											<strong className="text-indigo-700">{c.in_progress}</strong> in progress
											{c.last_shipment_at ? ` · last ${timeAgo(c.last_shipment_at)}` : ""}
										</p>
										<ViewButton c={c} onView={onViewShipments} />
									</div>
								</li>
							))}
						</ul>

						<div className="hidden overflow-x-auto lg:block">
							<table className="w-full text-left text-sm">
								<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
									<tr>
										<th className="px-5 py-3">Customer</th>
										<th className="px-5 py-3">Location</th>
										<th className="px-5 py-3 text-right">Shipments</th>
										<th className="px-5 py-3 text-right">Delivered</th>
										<th className="px-5 py-3 text-right">In progress</th>
										<th className="px-5 py-3 text-right">Total fees</th>
										<th className="px-5 py-3">Last shipment</th>
										<th className="px-5 py-3">
											<span className="sr-only">Actions</span>
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{customers.map((c, i) => (
										<tr key={`${c.customer_id ?? "x"}-${c.email ?? c.name ?? i}`} className="hover:bg-slate-50">
											<td className="max-w-[16rem] px-5 py-3.5">
												<p className="truncate font-semibold text-slate-900">{c.name || "Unnamed customer"}</p>
												<p className="truncate text-xs text-slate-500">{contact(c) || "—"}</p>
											</td>
											<td className="px-5 py-3.5 text-slate-700">{place(c)}</td>
											<td className="px-5 py-3.5 text-right tabular-nums text-slate-900">{c.shipments}</td>
											<td className="px-5 py-3.5 text-right tabular-nums text-emerald-700">{c.delivered}</td>
											<td className="px-5 py-3.5 text-right tabular-nums text-indigo-700">{c.in_progress}</td>
											<td className="px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">{formatMoney(c.total_fees)}</td>
											<td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{c.last_shipment_at ? timeAgo(c.last_shipment_at) : "—"}</td>
											<td className="px-5 py-3.5 text-right">
												<ViewButton c={c} onView={onViewShipments} />
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}
			</Panel>
		</div>
	);
}
