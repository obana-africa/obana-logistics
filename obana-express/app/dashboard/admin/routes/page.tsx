"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, Pencil, Plus, Route as RouteIcon, Search, Trash2, UserRound, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, StatCard, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button } from "@/components/ui";
import { BracketsTable } from "@/components/admin/routes/BracketsTable";
import { RouteFormSheet } from "@/components/admin/routes/RouteFormSheet";
import { Sheet } from "@/components/admin/routes/Sheet";
import {
	SERVICE_LEVELS,
	TRANSPORT_MODES,
	lowestPrice,
	modeLabel,
	modeTone,
	routeCountries,
	routeTitle,
	serviceTone,
	type DriverSummary,
	type RoutePayload,
	type RouteTemplate,
} from "@/components/admin/routes/model";
import { apiClient } from "@/lib/api";
import { formatMoney } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

const MODE_CHIPS = [{ value: "", label: "All modes" }, ...TRANSPORT_MODES];
const SERVICE_CHIPS = [{ value: "", label: "All services" }, ...SERVICE_LEVELS];

const chipClass = (active: boolean) =>
	active
		? "h-9 shrink-0 rounded-full bg-[#1B3B5F] px-3.5 text-sm font-medium text-white"
		: "h-9 shrink-0 rounded-full border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50";

const bracketCount = (r: RouteTemplate) => {
	const n = Array.isArray(r.weight_brackets) ? r.weight_brackets.length : 0;
	return `${n} bracket${n === 1 ? "" : "s"}`;
};

export default function AdminRoutesPage() {
	const routesQ = useRemote<RouteTemplate[]>("admin-routes", async () => {
		const res = await apiClient.listRoutes();
		return Array.isArray(res?.data) ? res.data : [];
	});
	const driversQ = useRemote<DriverSummary[]>("admin-route-drivers", async () => {
		const res = await apiClient.listDrivers();
		return Array.isArray(res?.data) ? res.data : [];
	});

	const [query, setQuery] = useState("");
	const [mode, setMode] = useState("");
	const [service, setService] = useState("");
	const [expanded, setExpanded] = useState<string | null>(null);
	const [notice, setNotice] = useState("");

	const [editing, setEditing] = useState<{ route: RouteTemplate | null } | null>(null);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState("");

	const [deleting, setDeleting] = useState<RouteTemplate | null>(null);
	const [deleteBusy, setDeleteBusy] = useState(false);
	const [deleteError, setDeleteError] = useState("");

	const routes = routesQ.data ?? [];
	const drivers = driversQ.data ?? [];
	const firstLoad = routesQ.loading && !routesQ.data;

	const cities = new Set(
		routes.flatMap((r) => [
			`${(r.origin_city || "").trim().toLowerCase()}|${r.metadata?.origin_country_code || r.metadata?.origin_country || ""}`,
			`${(r.destination_city || "").trim().toLowerCase()}|${r.metadata?.destination_country_code || r.metadata?.destination_country || ""}`,
		]),
	).size;
	const withDriver = routes.filter((r) => (r.preferred_driver_id !== null && r.preferred_driver_id !== undefined) || r.preferred_driver).length;

	const q = query.trim().toLowerCase();
	const filtered = Boolean(q || mode || service);
	const visible = routes.filter((r) => {
		if (mode && (r.transport_mode || "").toLowerCase() !== mode) return false;
		if (service && r.service_level !== service) return false;
		if (!q) return true;
		const m = r.metadata ?? {};
		return [r.origin_city, r.destination_city, m.origin_state, m.origin_country, m.destination_state, m.destination_country].some((v) => v?.toLowerCase().includes(q));
	});

	const driverCode = (r: RouteTemplate) => {
		if (r.preferred_driver?.driver_code) return r.preferred_driver.driver_code;
		if (r.preferred_driver_id === null || r.preferred_driver_id === undefined) return null;
		return drivers.find((d) => String(d.id) === String(r.preferred_driver_id))?.driver_code || `Driver #${r.preferred_driver_id}`;
	};

	const clearFilters = () => {
		setQuery("");
		setMode("");
		setService("");
	};

	const openForm = (route: RouteTemplate | null) => {
		setSaveError("");
		setEditing({ route });
	};

	const closeForm = () => {
		if (!saving) setEditing(null);
	};

	const save = async (payload: RoutePayload) => {
		const route = editing?.route ?? null;
		setSaving(true);
		setSaveError("");
		try {
			if (route) await apiClient.updateRoute(String(route.id), payload);
			else await apiClient.createRoute(payload);
			setEditing(null);
			setNotice(`${routeTitle(payload)} ${route ? "updated" : "created"}.`);
			routesQ.retry();
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch (err) {
			setSaveError(errorMessage(err, "We couldn't save this route. Please try again."));
		} finally {
			setSaving(false);
		}
	};

	const askDelete = (route: RouteTemplate) => {
		setDeleteError("");
		setDeleting(route);
	};

	const confirmDelete = async () => {
		if (!deleting) return;
		setDeleteBusy(true);
		setDeleteError("");
		try {
			await apiClient.deleteRoute(String(deleting.id));
			setNotice(`${routeTitle(deleting)} deleted.`);
			setDeleting(null);
			routesQ.retry();
			window.scrollTo({ top: 0, behavior: "smooth" });
		} catch (err) {
			setDeleteError(errorMessage(err, "We couldn't delete this route. Please try again."));
		} finally {
			setDeleteBusy(false);
		}
	};

	const toggle = (id: string) => setExpanded((cur) => (cur === id ? null : id));

	return (
		<DashboardLayout role="admin">
			<div className="space-y-5">
				<div className="space-y-2">
					<PageHeader
						title="Routes & pricing"
						description="What the Obana fleet charges on each route, by weight."
						actions={
							<Button onClick={() => openForm(null)}>
								<Plus className="h-4 w-4" aria-hidden /> New route
							</Button>
						}
					/>
					<p className="text-sm text-slate-500">
						Partner-carrier prices and markup are set on the{" "}
						<Link href="/dashboard/admin/partners" className="font-semibold text-[#1B3B5F] underline-offset-2 hover:underline">
							Partners page
						</Link>
						.
					</p>
				</div>

				{notice && (
					<Alert type="success" role="status">
						<div className="flex items-start justify-between gap-3">
							<p>{notice}</p>
							<button type="button" onClick={() => setNotice("")} aria-label="Dismiss" className="-my-1 -mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-100">
								<X className="h-4 w-4" aria-hidden />
							</button>
						</div>
					</Alert>
				)}

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
					<StatCard label="Routes" value={routes.length} icon={RouteIcon} tone="info" loading={firstLoad} />
					<StatCard label="Cities covered" value={cities} icon={MapPin} tone="progress" loading={firstLoad} />
					<div className="col-span-2 sm:col-span-1">
						<StatCard
							label="With preferred driver"
							value={withDriver}
							hint={routes.length ? `of ${routes.length} route${routes.length === 1 ? "" : "s"}` : undefined}
							icon={UserRound}
							tone="success"
							loading={firstLoad}
						/>
					</div>
				</div>

				<div className="space-y-3">
					<label className="relative block" role="search">
						<span className="sr-only">Search routes</span>
						<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search by city, state or country"
							className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
						/>
					</label>
					<div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
						<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 lg:pb-0" role="group" aria-label="Filter by transport mode">
							{MODE_CHIPS.map((o) => (
								<button key={o.value || "all"} type="button" aria-pressed={mode === o.value} onClick={() => setMode(o.value)} className={chipClass(mode === o.value)}>
									{o.label}
								</button>
							))}
						</div>
						<span className="hidden h-6 w-px bg-slate-200 lg:block" aria-hidden />
						<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 lg:pb-0" role="group" aria-label="Filter by service level">
							{SERVICE_CHIPS.map((o) => (
								<button key={o.value || "all"} type="button" aria-pressed={service === o.value} onClick={() => setService(o.value)} className={chipClass(service === o.value)}>
									{o.label}
								</button>
							))}
						</div>
					</div>
				</div>

				<Panel
					title="Route templates"
					description={firstLoad || routesQ.error ? undefined : filtered ? `Showing ${visible.length} of ${routes.length}` : `${routes.length} route${routes.length === 1 ? "" : "s"}`}
					flush
				>
					{firstLoad ? (
						<ListSkeleton rows={5} />
					) : routesQ.error ? (
						<ErrorState text={routesQ.error} onRetry={routesQ.retry} />
					) : !routes.length ? (
						<EmptyState
							icon={RouteIcon}
							title="No routes yet"
							text="Add the cities the Obana fleet serves, with a price and delivery time for each weight range."
							action={
								<Button onClick={() => openForm(null)}>
									<Plus className="h-4 w-4" aria-hidden /> Create your first route
								</Button>
							}
						/>
					) : !visible.length ? (
						<EmptyState
							icon={Search}
							title="No routes match"
							text="Try another city, mode or service level."
							action={
								<button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
									<X className="h-4 w-4" aria-hidden /> Clear filters
								</button>
							}
						/>
					) : (
						<>
							{/* Phones and tablets: cards */}
							<ul className="divide-y divide-slate-100 lg:hidden">
								{visible.map((r) => {
									const id = String(r.id);
									const open = expanded === id;
									const title = routeTitle(r);
									const from = lowestPrice(r);
									const code = driverCode(r);
									return (
										<li key={id} className="px-4 py-4 sm:px-5">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<p className="truncate font-semibold text-slate-900">{title}</p>
													{routeCountries(r) && <p className="truncate text-xs text-slate-500">{routeCountries(r)}</p>}
												</div>
												<p className="shrink-0 text-right">
													<span className="block text-xs text-slate-500">from</span>
													<span className="font-semibold tabular-nums text-slate-900">{from === null ? "—" : formatMoney(from)}</span>
												</p>
											</div>
											<div className="mt-2 flex flex-wrap items-center gap-1.5">
												<ToneBadge tone={modeTone(r.transport_mode)}>{modeLabel(r.transport_mode)}</ToneBadge>
												<ToneBadge tone={serviceTone(r.service_level)}>{r.service_level || "—"}</ToneBadge>
											</div>
											<p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
												<UserRound className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
												{code ? <span className="font-medium text-slate-800">{code}</span> : <span className="text-slate-500">No preferred driver</span>}
											</p>
											<div className="mt-3 flex items-center gap-2">
												<button
													type="button"
													onClick={() => toggle(id)}
													aria-expanded={open}
													aria-controls={`brackets-card-${id}`}
													aria-label={`${bracketCount(r)} for ${title}`}
													className="inline-flex h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
												>
													<span className="truncate">{bracketCount(r)}</span>
													<ChevronDown className={open ? "h-4 w-4 shrink-0 rotate-180 text-slate-500 transition" : "h-4 w-4 shrink-0 text-slate-500 transition"} aria-hidden />
												</button>
												<Button variant="secondary" onClick={() => openForm(r)} aria-label={`Edit ${title}`}>
													<Pencil className="h-4 w-4" aria-hidden /> Edit
												</Button>
												<button
													type="button"
													onClick={() => askDelete(r)}
													aria-label={`Delete ${title}`}
													className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50"
												>
													<Trash2 className="h-4 w-4" aria-hidden />
												</button>
											</div>
											{open && (
												<div className="mt-3">
													<BracketsTable route={r} id={`brackets-card-${id}`} />
												</div>
											)}
										</li>
									);
								})}
							</ul>

							{/* Desktop: table */}
							<div className="hidden overflow-x-auto lg:block">
								<table className="w-full text-left text-sm">
									<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
										<tr>
											<th scope="col" className="px-5 py-3">Route</th>
											<th scope="col" className="px-5 py-3">Mode</th>
											<th scope="col" className="px-5 py-3">Service</th>
											<th scope="col" className="px-5 py-3 text-right">From</th>
											<th scope="col" className="px-5 py-3">Brackets</th>
											<th scope="col" className="px-5 py-3">Preferred driver</th>
											<th scope="col" className="px-5 py-3 text-right">
												<span className="sr-only">Actions</span>
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{visible.map((r) => {
											const id = String(r.id);
											const open = expanded === id;
											const title = routeTitle(r);
											const from = lowestPrice(r);
											const code = driverCode(r);
											return (
												<React.Fragment key={id}>
													<tr className={open ? "bg-slate-50" : "hover:bg-slate-50"}>
														<td className="px-5 py-3.5">
															<p className="font-semibold text-slate-900">{title}</p>
															{routeCountries(r) && <p className="text-xs text-slate-500">{routeCountries(r)}</p>}
														</td>
														<td className="px-5 py-3.5">
															<ToneBadge tone={modeTone(r.transport_mode)}>{modeLabel(r.transport_mode)}</ToneBadge>
														</td>
														<td className="px-5 py-3.5">
															<ToneBadge tone={serviceTone(r.service_level)}>{r.service_level || "—"}</ToneBadge>
														</td>
														<td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-slate-900">{from === null ? "—" : formatMoney(from)}</td>
														<td className="px-5 py-3.5">
															<button
																type="button"
																onClick={() => toggle(id)}
																aria-expanded={open}
																aria-controls={`brackets-row-${id}`}
																aria-label={`${bracketCount(r)} for ${title}`}
																className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
															>
																{bracketCount(r)}
																<ChevronDown className={open ? "h-4 w-4 rotate-180 text-slate-500 transition" : "h-4 w-4 text-slate-500 transition"} aria-hidden />
															</button>
														</td>
														<td className="whitespace-nowrap px-5 py-3.5">{code ? <span className="font-medium text-slate-800">{code}</span> : <span className="text-slate-500">No preferred driver</span>}</td>
														<td className="px-5 py-3.5">
															<div className="flex justify-end gap-1">
																<button
																	type="button"
																	onClick={() => openForm(r)}
																	aria-label={`Edit ${title}`}
																	className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#1B3B5F]"
																>
																	<Pencil className="h-4 w-4" aria-hidden />
																</button>
																<button
																	type="button"
																	onClick={() => askDelete(r)}
																	aria-label={`Delete ${title}`}
																	className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"
																>
																	<Trash2 className="h-4 w-4" aria-hidden />
																</button>
															</div>
														</td>
													</tr>
													{open && (
														<tr className="bg-slate-50">
															<td colSpan={7} className="px-5 pb-4 pt-1">
																<BracketsTable route={r} id={`brackets-row-${id}`} />
															</td>
														</tr>
													)}
												</React.Fragment>
											);
										})}
									</tbody>
								</table>
							</div>
						</>
					)}
				</Panel>
			</div>

			{editing && (
				<RouteFormSheet
					route={editing.route}
					drivers={drivers}
					driversError={Boolean(driversQ.error)}
					saving={saving}
					serverError={saveError}
					onCancel={closeForm}
					onSave={save}
				/>
			)}

			{deleting && (
				<Sheet
					size="small"
					title="Delete route?"
					onClose={() => !deleteBusy && setDeleting(null)}
					footer={
						<>
							<Button type="button" variant="secondary" onClick={() => setDeleting(null)} disabled={deleteBusy} className="flex-1 sm:flex-none">
								Cancel
							</Button>
							<Button type="button" variant="danger" onClick={confirmDelete} loading={deleteBusy} className="flex-1 sm:flex-none">
								{deleteBusy ? "Deleting…" : "Delete route"}
							</Button>
						</>
					}
				>
					<div className="space-y-3">
						<p className="text-sm text-slate-600">
							<span className="font-semibold text-slate-900">{routeTitle(deleting)}</span> ({modeLabel(deleting.transport_mode)} · {deleting.service_level}) and its{" "}
							{bracketCount(deleting)} will be removed. New shipments can no longer be priced on it. This can&apos;t be undone.
						</p>
						{deleteError && <Alert type="error">{deleteError}</Alert>}
					</div>
				</Sheet>
			)}
		</DashboardLayout>
	);
}
