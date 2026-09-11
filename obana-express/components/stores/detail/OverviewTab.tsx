"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Package, Truck } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton, Panel, StatCard } from "@/components/dashboard/kit";
import { CodeBox } from "@/components/stores/Copy";
import { StoreShipmentList } from "@/components/stores/ShipmentList";
import { lastUsedLabel, testCurl } from "@/components/stores/stores";
import { apiClient, type StoreDetail, type StoreShipmentPage } from "@/lib/api";
import { useRemote } from "@/lib/useRemote";

export function storeCounts(stats?: StoreDetail["stats"]) {
	const by = stats?.by_status ?? {};
	const n = (k: string) => Number(by[k] ?? 0);
	const total = Number(stats?.total ?? 0);
	return {
		total,
		delivered: n("delivered"),
		inProgress: Math.max(0, total - n("delivered") - n("failed") - n("cancelled") - n("returned")),
		attention: n("failed") + n("returned"),
	};
}

export function OverviewTab({ store, onOpenShipments, onOpenKey }: { store: StoreDetail; onOpenShipments: () => void; onOpenKey: () => void }) {
	const c = storeCounts(store.stats);
	const recent = useRemote<StoreShipmentPage>(`store-recent:${store.id}`, async () => {
		const res = await apiClient.listStoreShipments(store.id, { page: 1, limit: 5 });
		return res.data ?? { shipments: [], pagination: { total: 0, page: 1, pages: 0, limit: 5 } };
	});
	const shipments = recent.data?.shipments ?? [];

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
				<StatCard label="Total shipments" value={c.total.toLocaleString()} icon={Package} />
				<StatCard label="In progress" value={c.inProgress.toLocaleString()} icon={Truck} tone="progress" />
				<StatCard label="Delivered" value={c.delivered.toLocaleString()} icon={CheckCircle2} tone="success" />
				<StatCard label="Needs attention" value={c.attention.toLocaleString()} icon={AlertTriangle} tone={c.attention ? "danger" : "neutral"} hint="Failed or returned" />
			</div>

			<div className="grid gap-6 lg:grid-cols-5">
				<div className="min-w-0 lg:col-span-3">
					<Panel
						title="Recent shipments"
						flush
						actions={
							shipments.length ? (
								<button type="button" onClick={onOpenShipments} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1B3B5F] hover:underline">
									View all <ArrowRight className="h-4 w-4" aria-hidden />
								</button>
							) : undefined
						}
					>
						{recent.loading && !recent.data ? (
							<ListSkeleton rows={3} />
						) : recent.error ? (
							<ErrorState text={recent.error} onRetry={recent.retry} />
						) : !shipments.length ? (
							<EmptyState icon={Package} title="No shipments yet" text="Shipments your store creates with its API key show up here, with the customer and live status." />
						) : (
							<StoreShipmentList shipments={shipments} />
						)}
					</Panel>
				</div>

				<div className="min-w-0 lg:col-span-2">
					<Panel title="Quick start" description="Check your key works, then create shipments from your store.">
						<div className="space-y-4">
							<dl className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
								<dt className="text-slate-500">Key</dt>
								<dd className="min-w-0 truncate font-mono text-slate-900">{store.api_key_hint}</dd>
							</dl>
							<p className="text-xs text-slate-500">
								Last used: {lastUsedLabel(store.last_used_at)}. Lost the full key?{" "}
								<button type="button" onClick={onOpenKey} className="font-semibold text-[#1B3B5F] hover:underline">
									Create a new one
								</button>
							</p>
							<CodeBox code={testCurl("YOUR_API_KEY")} />
							<Link href="/docs" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1B3B5F] hover:underline">
								<BookOpen className="h-4 w-4" aria-hidden /> Read the API docs
							</Link>
						</div>
					</Panel>
				</div>
			</div>
		</div>
	);
}
