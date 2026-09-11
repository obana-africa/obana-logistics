"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Package, Search, UserRound, X } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, Panel } from "@/components/dashboard/kit";
import { StoreShipmentList } from "@/components/stores/ShipmentList";
import { apiClient, type StoreShipmentPage } from "@/lib/api";
import { STATUS_OPTIONS } from "@/lib/shipments";
import { useRemote } from "@/lib/useRemote";

const LIMIT = 20;

/** Where the Customers tab sends you: a customer id, or (when the customer has no id) a name to search for. */
export type ShipmentFilter = { customerId?: string; customerName?: string; q?: string };

export function ShipmentsTab({ storeId, initial }: { storeId: string; initial: ShipmentFilter }) {
	const [page, setPage] = useState(1);
	const [status, setStatus] = useState("");
	const [query, setQuery] = useState(initial.q ?? "");
	const [q, setQ] = useState(initial.q ?? "");
	const [customer, setCustomer] = useState(initial.customerId ? { id: initial.customerId, name: initial.customerName || "this customer" } : null);

	const key = JSON.stringify({ storeId, page, status, q, customer: customer?.id ?? "" });
	const { data, loading, error, retry } = useRemote<StoreShipmentPage>(key, async () => {
		const res = await apiClient.listStoreShipments(storeId, { page, limit: LIMIT, status, q, customer_id: customer?.id });
		return res.data ?? { shipments: [], pagination: { total: 0, page: 1, pages: 0, limit: LIMIT } };
	});

	const shipments = data?.shipments ?? [];
	const pg = data?.pagination;
	const filtered = Boolean(status || q || customer);

	const applySearch = (e: React.FormEvent) => {
		e.preventDefault();
		setQ(query.trim());
		setPage(1);
	};
	const clearAll = () => {
		setQuery("");
		setQ("");
		setStatus("");
		setCustomer(null);
		setPage(1);
	};

	return (
		<div className="space-y-4">
			<form onSubmit={applySearch} className="flex gap-2" role="search">
				<label className="relative min-w-0 flex-1">
					<span className="sr-only">Search this store&apos;s shipments</span>
					<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Order number or reference"
						className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
					/>
				</label>
				<button type="submit" className="h-12 shrink-0 rounded-xl bg-[#1B3B5F] px-5 text-sm font-semibold text-white hover:bg-[#15304d]">
					Search
				</button>
			</form>

			{customer && (
				<div className="flex flex-wrap items-center gap-2">
					<span className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#1B3B5F]/5 py-1 pl-3 pr-1 text-sm font-medium text-[#1B3B5F] ring-1 ring-inset ring-[#1B3B5F]/15">
						<UserRound className="h-4 w-4 shrink-0" aria-hidden />
						<span className="truncate">Customer: {customer.name}</span>
						<button
							type="button"
							onClick={() => {
								setCustomer(null);
								setPage(1);
							}}
							aria-label="Remove customer filter"
							className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-[#1B3B5F]/10"
						>
							<X className="h-4 w-4" aria-hidden />
						</button>
					</span>
				</div>
			)}

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

			<Panel flush>
				{loading && !data ? (
					<ListSkeleton rows={5} />
				) : error ? (
					<ErrorState text={error} onRetry={retry} />
				) : !shipments.length ? (
					<EmptyState
						icon={Package}
						title={filtered ? "No shipments match" : "No shipments yet"}
						text={filtered ? "Try another status, customer or search." : "When your store creates shipments with its API key, they appear here."}
						action={
							filtered ? (
								<button type="button" onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
									<X className="h-4 w-4" aria-hidden /> Clear filters
								</button>
							) : undefined
						}
					/>
				) : (
					<div className={loading ? "opacity-60 transition-opacity" : undefined} aria-busy={loading || undefined}>
						<StoreShipmentList shipments={shipments} />
					</div>
				)}

				{pg && pg.total > 0 && !error && (
					<nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-5">
						<p className="text-sm text-slate-600">
							Page {pg.page} of {Math.max(pg.pages, 1)} · {pg.total.toLocaleString()} shipments
						</p>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => setPage((p) => p - 1)}
								disabled={page <= 1 || loading}
								aria-label="Previous page"
								className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
							>
								<ChevronLeft className="h-4 w-4" />
							</button>
							<button
								type="button"
								onClick={() => setPage((p) => p + 1)}
								disabled={page >= pg.pages || loading}
								aria-label="Next page"
								className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
							>
								<ChevronRight className="h-4 w-4" />
							</button>
						</div>
					</nav>
				)}
			</Panel>
		</div>
	);
}
