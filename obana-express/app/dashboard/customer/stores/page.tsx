"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Plus, Store as StoreIcon } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, PageHeader, Panel, ToneBadge } from "@/components/dashboard/kit";
import { Button } from "@/components/ui";
import { AddStoreSheet } from "@/components/stores/AddStoreSheet";
import { lastUsedLabel, prettyUrl, storePath, storeStatusLabel, storeStatusTone } from "@/components/stores/stores";
import { apiClient, type Store } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { useRemote } from "@/lib/useRemote";

function StoreCard({ s }: { s: Store }) {
	return (
		<Link
			href={storePath(s.id)}
			className="group block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20 sm:p-5"
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate font-semibold text-slate-900 group-hover:text-[#1B3B5F]">{s.name}</p>
					<p className="truncate text-sm text-slate-500">{prettyUrl(s.website_url) || "No website"}</p>
				</div>
				<ToneBadge tone={storeStatusTone(s.status)}>{storeStatusLabel(s.status)}</ToneBadge>
			</div>
			<p className="mt-3 truncate rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-700">{s.api_key_hint}</p>
			<dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
				<div className="min-w-0">
					<dt className="text-xs text-slate-500">Shipments</dt>
					<dd className="font-semibold tabular-nums text-slate-900">{(s.shipments_count ?? 0).toLocaleString()}</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-xs text-slate-500">Last used</dt>
					<dd className="truncate font-semibold text-slate-900">{lastUsedLabel(s.last_used_at)}</dd>
				</div>
				<div className="min-w-0">
					<dt className="text-xs text-slate-500">Webhook</dt>
					<dd className={`font-semibold ${s.webhook_url ? "text-emerald-700" : "text-slate-500"}`}>{s.webhook_url ? "On" : "Off"}</dd>
				</div>
			</dl>
		</Link>
	);
}

export default function StoresPage() {
	const { user } = useAuth();
	const { data, loading, error, retry } = useRemote<Store[]>("my-stores", async () => (await apiClient.listStores()).data ?? []);
	const [adding, setAdding] = useState(false);

	const stores = data ?? [];
	const hasBusiness = Boolean(user?.attributes?.business_name);

	return (
		<DashboardLayout role="customer">
			<div className="space-y-6">
				<PageHeader
					title="Stores & API"
					description="Connect your website, Shopify shop or app. Each store has its own API key, shipments and customers."
					actions={
						stores.length > 0 ? (
							<Button onClick={() => setAdding(true)}>
								<Plus className="h-4 w-4" aria-hidden /> Add store
							</Button>
						) : undefined
					}
				/>

				{!hasBusiness && (
					<Link
						href="/onboarding/business"
						className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 transition hover:bg-amber-100"
					>
						<Building2 className="h-5 w-5 shrink-0" aria-hidden />
						<span className="min-w-0 flex-1">
							<strong className="font-semibold">Add your business details.</strong> Tell us your business name so we can label your shipments and invoices.
						</span>
						<ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
					</Link>
				)}

				{loading && !data ? (
					<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading">
						{[0, 1, 2].map((i) => (
							<div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
						))}
					</div>
				) : error ? (
					<Panel>
						<ErrorState text={error} onRetry={retry} />
					</Panel>
				) : !stores.length ? (
					<Panel>
						<EmptyState
							icon={StoreIcon}
							title="No stores yet"
							text="Add your website, Shopify shop or app to get an API key. Orders it sends us are priced, picked up and delivered — and you see every one here."
							action={
								<Button onClick={() => setAdding(true)}>
									<Plus className="h-4 w-4" aria-hidden /> Add your first store
								</Button>
							}
						/>
					</Panel>
				) : (
					<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{stores.map((s) => (
							<li key={s.id} className="min-w-0">
								<StoreCard s={s} />
							</li>
						))}
					</ul>
				)}
			</div>

			{adding && <AddStoreSheet onClose={() => setAdding(false)} onCreated={() => retry()} />}
		</DashboardLayout>
	);
}
