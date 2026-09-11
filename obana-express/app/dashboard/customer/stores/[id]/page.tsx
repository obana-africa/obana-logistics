"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Pause, Play } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ErrorState, Panel, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button } from "@/components/ui";
import { ConfirmSheet } from "@/components/stores/Sheet";
import { TabList } from "@/components/stores/Tabs";
import { ApiKeyTab } from "@/components/stores/detail/ApiKeyTab";
import { CustomersTab } from "@/components/stores/detail/CustomersTab";
import { OverviewTab } from "@/components/stores/detail/OverviewTab";
import { ShipmentsTab, type ShipmentFilter } from "@/components/stores/detail/ShipmentsTab";
import { SettingsTab } from "@/components/stores/detail/SettingsTab";
import { WebhooksTab } from "@/components/stores/detail/WebhooksTab";
import { prettyUrl, safeHref, storeStatusLabel, storeStatusTone } from "@/components/stores/stores";
import { apiClient, type StoreCustomer, type StoreDetail } from "@/lib/api";
import { errorMessage, useRemote } from "@/lib/useRemote";

type Tab = "overview" | "shipments" | "customers" | "key" | "webhooks" | "settings";
const TABS: { value: Tab; label: string }[] = [
	{ value: "overview", label: "Overview" },
	{ value: "shipments", label: "Shipments" },
	{ value: "customers", label: "Customers" },
	{ value: "key", label: "API key" },
	{ value: "webhooks", label: "Webhooks" },
	{ value: "settings", label: "Settings" },
];

export default function StoreDetailPage() {
	const id = String(useParams().id ?? "");
	const { data: store, loading, error, retry } = useRemote<StoreDetail>(id ? `store:${id}` : null, async () => {
		const res = await apiClient.getStore(id);
		if (!res?.data) throw new Error(res?.message || "Store not found.");
		return res.data;
	});

	const [tab, setTab] = useState<Tab>("overview");
	// Bumping `n` remounts the Shipments tab with a fresh filter (e.g. from the Customers tab).
	const [shipFilter, setShipFilter] = useState<ShipmentFilter & { n: number }>({ n: 0 });
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const [sheetError, setSheetError] = useState("");
	const [notice, setNotice] = useState("");

	if (loading && !store) {
		return (
			<DashboardLayout role="customer">
				<div className="space-y-4" aria-label="Loading">
					<div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
					<div className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
					<div className="h-11 w-full animate-pulse rounded-lg bg-slate-100" />
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
						))}
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (error || !store) {
		return (
			<DashboardLayout role="customer">
				<Panel>
					<ErrorState text={error || "Store not found."} onRetry={retry} />
					<div className="text-center">
						<Link href="/dashboard/customer/stores" className="text-sm font-semibold text-[#1B3B5F] hover:underline">
							Back to stores
						</Link>
					</div>
				</Panel>
			</DashboardLayout>
		);
	}

	const paused = store.status === "paused";
	const site = safeHref(store.website_url);

	const toggleStatus = async () => {
		setBusy(true);
		setSheetError("");
		try {
			await apiClient.updateStore(store.id, { status: paused ? "active" : "paused" });
			setConfirming(false);
			setNotice(paused ? `${store.name} is active again — its API key works.` : `${store.name} is paused. Requests with its API key are refused until you resume it.`);
			retry();
		} catch (err) {
			setSheetError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	const viewCustomerShipments = (c: StoreCustomer) => {
		const name = c.name || c.email || "";
		setShipFilter((f) => (c.customer_id !== null && c.customer_id !== undefined ? { n: f.n + 1, customerId: String(c.customer_id), customerName: name } : { n: f.n + 1, q: name }));
		setTab("shipments");
	};

	return (
		<DashboardLayout role="customer">
			<div className="space-y-6">
				<Link href="/dashboard/customer/stores" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#1B3B5F]">
					<ArrowLeft className="h-4 w-4" aria-hidden /> Stores & API
				</Link>

				<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="min-w-0 break-words text-2xl font-bold text-slate-900 sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
								{store.name}
							</h1>
							<ToneBadge tone={storeStatusTone(store.status)}>{storeStatusLabel(store.status)}</ToneBadge>
						</div>
						{site ? (
							<a href={site} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-sm font-medium text-[#1B3B5F] hover:underline">
								<span className="truncate">{prettyUrl(store.website_url)}</span>
								<ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
							</a>
						) : (
							<p className="mt-1 text-sm text-slate-500">No website</p>
						)}
					</div>
					<Button
						variant={paused ? "primary" : "secondary"}
						onClick={() => {
							setSheetError("");
							setConfirming(true);
						}}
					>
						{paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
						{paused ? "Resume store" : "Pause store"}
					</Button>
				</div>

				{paused && <Alert type="warning">This store is paused. Requests made with its API key are refused, and no new shipments come in until you resume it.</Alert>}
				{notice && (
					<Alert type="success" role="status">
						{notice}
					</Alert>
				)}

				<TabList tabs={TABS} value={tab} onChange={setTab} label="Store sections" idBase="store" />

				<div role="tabpanel" id="store-panel" aria-labelledby={`store-tab-${tab}`} tabIndex={0} className="focus-visible:outline-none">
					{tab === "overview" && <OverviewTab store={store} onOpenShipments={() => setTab("shipments")} onOpenKey={() => setTab("key")} />}
					{tab === "shipments" && <ShipmentsTab key={shipFilter.n} storeId={String(store.id)} initial={shipFilter} />}
					{tab === "customers" && <CustomersTab storeId={String(store.id)} onViewShipments={viewCustomerShipments} />}
					{tab === "key" && <ApiKeyTab store={store} onChanged={retry} />}
					{tab === "webhooks" && <WebhooksTab store={store} onChanged={retry} />}
					{tab === "settings" && <SettingsTab store={store} onChanged={retry} />}
				</div>
			</div>

			{confirming && (
				<ConfirmSheet
					title={paused ? "Resume this store?" : "Pause this store?"}
					subtitle={store.name}
					confirmLabel={paused ? "Resume store" : "Pause store"}
					busyLabel={paused ? "Resuming…" : "Pausing…"}
					danger={!paused}
					busy={busy}
					error={sheetError}
					onConfirm={toggleStatus}
					onClose={() => setConfirming(false)}
				>
					{paused ? (
						<p>Its API key starts working again straight away.</p>
					) : (
						<p>
							Requests made with this store&apos;s API key will be refused until you resume it. Shipments already booked keep moving and customers still get updates.
						</p>
					)}
				</ConfirmSheet>
			)}
		</DashboardLayout>
	);
}
