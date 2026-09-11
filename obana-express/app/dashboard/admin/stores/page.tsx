"use client";

import React, { useState } from "react";
import { Search, Store as StoreIcon, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, ToneBadge } from "@/components/dashboard/kit";
import { Alert } from "@/components/ui";
import { ConfirmSheet } from "@/components/stores/Sheet";
import { lastUsedLabel, prettyUrl, storeStatusLabel, storeStatusTone } from "@/components/stores/stores";
import { apiClient, type Store } from "@/lib/api";
import { formatDate } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

function ToggleButton({ s, onClick }: { s: Store; onClick: () => void }) {
	const paused = s.status === "paused";
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={`${paused ? "Resume" : "Pause"} ${s.name}`}
			className={`inline-flex h-9 shrink-0 items-center rounded-lg px-3 text-xs font-semibold ${
				paused ? "bg-[#1B3B5F] text-white hover:bg-[#15304d]" : "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
			}`}
		>
			{paused ? "Resume" : "Pause"}
		</button>
	);
}

export default function AdminStoresPage() {
	const { data, loading, error, retry } = useRemote<Store[]>("admin-stores", async () => (await apiClient.listStores(true)).data ?? []);
	const [query, setQuery] = useState("");
	const [target, setTarget] = useState<Store | null>(null);
	const [busy, setBusy] = useState(false);
	const [sheetError, setSheetError] = useState("");
	const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const all = data ?? [];
	const q = query.trim().toLowerCase();
	const stores = q ? all.filter((s) => [s.name, s.website_url, s.owner?.email, s.owner?.phone].some((v) => v?.toLowerCase().includes(q))) : all;
	const active = all.filter((s) => s.status === "active").length;

	const toggle = async () => {
		if (!target) return;
		const resume = target.status === "paused";
		setBusy(true);
		setSheetError("");
		try {
			await apiClient.updateStore(target.id, { status: resume ? "active" : "paused" });
			setNotice({ type: "success", text: resume ? `${target.name} is active again.` : `${target.name} is paused — its API key is refused until it's resumed.` });
			setTarget(null);
			retry();
		} catch (err) {
			setSheetError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	const open = (s: Store) => {
		setSheetError("");
		setTarget(s);
	};

	return (
		<DashboardLayout role="admin">
			<div className="space-y-5">
				<PageHeader title="Stores" description="Every store connected to Obana through the API, and the account that owns it." />

				{notice && (
					<Alert type={notice.type} role="status">
						{notice.text}
					</Alert>
				)}

				<label className="relative block">
					<span className="sr-only">Search stores</span>
					<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Store name, website or owner email"
						className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
					/>
				</label>

				<Panel flush title="All stores" description={data ? `${all.length.toLocaleString()} stores · ${active.toLocaleString()} active` : undefined}>
					{loading && !data ? (
						<ListSkeleton rows={5} />
					) : error ? (
						<ErrorState text={error} onRetry={retry} />
					) : !stores.length ? (
						<EmptyState
							icon={StoreIcon}
							title={q ? "No stores match" : "No stores yet"}
							text={q ? "Try another name, website or email." : "Stores appear here when business accounts connect them."}
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
								{stores.map((s) => (
									<li key={s.id} className="px-4 py-4">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<p className="truncate font-semibold text-slate-900">{s.name}</p>
												<p className="truncate text-sm text-slate-500">{s.owner?.email || s.owner?.phone || "Unknown owner"}</p>
											</div>
											<ToneBadge tone={storeStatusTone(s.status)}>{storeStatusLabel(s.status)}</ToneBadge>
										</div>
										<div className="mt-3 flex items-end justify-between gap-3">
											<p className="min-w-0 text-xs text-slate-500">
												{(s.shipments_count ?? 0).toLocaleString()} shipments · {lastUsedLabel(s.last_used_at)} · since {formatDate(s.created_at)}
												{s.website_url ? <span className="block truncate">{prettyUrl(s.website_url)}</span> : null}
											</p>
											<ToggleButton s={s} onClick={() => open(s)} />
										</div>
									</li>
								))}
							</ul>

							<div className="hidden overflow-x-auto lg:block">
								<table className="w-full text-left text-sm">
									<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
										<tr>
											<th className="px-5 py-3">Store</th>
											<th className="px-5 py-3">Owner</th>
											<th className="px-5 py-3">Status</th>
											<th className="px-5 py-3 text-right">Shipments</th>
											<th className="px-5 py-3">Last used</th>
											<th className="px-5 py-3">Created</th>
											<th className="px-5 py-3">
												<span className="sr-only">Actions</span>
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{stores.map((s) => (
											<tr key={s.id} className="hover:bg-slate-50">
												<td className="max-w-[16rem] px-5 py-3.5">
													<p className="truncate font-semibold text-slate-900">{s.name}</p>
													<p className="truncate text-xs text-slate-500">{prettyUrl(s.website_url) || "No website"}</p>
												</td>
												<td className="max-w-[16rem] px-5 py-3.5">
													<p className="truncate text-slate-800">{s.owner?.email || "—"}</p>
													{s.owner?.phone && <p className="truncate text-xs text-slate-500">{s.owner.phone}</p>}
												</td>
												<td className="px-5 py-3.5">
													<ToneBadge tone={storeStatusTone(s.status)}>{storeStatusLabel(s.status)}</ToneBadge>
												</td>
												<td className="px-5 py-3.5 text-right tabular-nums text-slate-900">{(s.shipments_count ?? 0).toLocaleString()}</td>
												<td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{lastUsedLabel(s.last_used_at)}</td>
												<td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(s.created_at)}</td>
												<td className="px-5 py-3.5 text-right">
													<ToggleButton s={s} onClick={() => open(s)} />
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

			{target && (
				<ConfirmSheet
					title={target.status === "paused" ? "Resume this store?" : "Pause this store?"}
					subtitle={`${target.name}${target.owner?.email ? ` · ${target.owner.email}` : ""}`}
					confirmLabel={target.status === "paused" ? "Resume store" : "Pause store"}
					busyLabel={target.status === "paused" ? "Resuming…" : "Pausing…"}
					danger={target.status !== "paused"}
					busy={busy}
					error={sheetError}
					onConfirm={toggle}
					onClose={() => setTarget(null)}
				>
					{target.status === "paused" ? (
						<p>Its API key starts working again straight away.</p>
					) : (
						<p>Requests made with this store&apos;s API key will be refused until it&apos;s resumed. Shipments already booked keep moving. The owner sees the store as paused.</p>
					)}
				</ConfirmSheet>
			)}
		</DashboardLayout>
	);
}
