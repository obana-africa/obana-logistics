"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Handshake, MapPin, Package, Send, Truck, UserRound, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ErrorState, ListSkeleton, Panel, StatusBadge, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button, Input, Select, Textarea } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { CLOSED_STATUSES, STATUS_OPTIONS, formatDate, formatMoney, statusMeta, type ShipmentStatus } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

type Address = { name?: string; first_name?: string; last_name?: string; contact_name?: string; line1?: string; line2?: string; city?: string; state?: string; country?: string; phone?: string; email?: string; contact_email?: string } | null;
interface Shipment {
	id: number;
	shipment_reference: string;
	order_reference?: string;
	vendor_name?: string;
	carrier_name?: string;
	carrier_type?: "internal" | "external";
	external_carrier_reference?: string | null;
	status: ShipmentStatus;
	createdAt: string;
	currency?: string;
	shipping_fee?: number | string;
	product_value?: number | string;
	pickup_address?: Address;
	delivery_address?: Address;
	items?: { id: number; name: string; quantity: number; weight?: number | string; total_price?: number | string; currency?: string }[];
	tracking_events?: { id: number; status: string; description?: string; location?: string; createdAt: string }[];
	driver?: { id?: number; driver_code?: string; vehicle_type?: string; vehicle_registration?: string } | null;
	agent?: { agent_code?: string; status?: string; user?: { email?: string; attributes?: { first_name?: string; last_name?: string } } } | null;
}
interface Driver {
	id: number;
	driver_code: string;
	vehicle_type?: string;
	status?: string;
	metadata?: { first_name?: string; last_name?: string };
	user?: { email?: string };
}

interface PartnerQuotes {
	terminal_shipment_id: string;
	options: { rate_id: string; carrier_name: string; carrier_logo?: string | null; partner?: string; cost: number; price: number; markup_percent: number; eta?: string | null }[];
}

type Sheet = "status" | "driver" | "partner" | "push" | null;

function AddressBlock({ label, a, tone }: { label: string; a?: Address; tone: "pickup" | "delivery" }) {
	const name = a?.name || a?.contact_name || [a?.first_name, a?.last_name].filter(Boolean).join(" ");
	return (
		<div className="flex gap-3">
			<span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone === "pickup" ? "bg-[#1B3B5F]" : "bg-emerald-500"}`} aria-hidden />
			<div className="min-w-0 text-sm">
				<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
				{name && <p className="font-semibold text-slate-900">{name}</p>}
				<p className="text-slate-700">{[a?.line1, a?.line2].filter(Boolean).join(", ") || "—"}</p>
				<p className="text-slate-700">{[a?.city, a?.state, a?.country].filter(Boolean).join(", ")}</p>
				{a?.phone && (
					<a href={`tel:${a.phone}`} className="text-[#1B3B5F] hover:underline">
						{a.phone}
					</a>
				)}
				{(a?.email || a?.contact_email) && <p className="truncate text-slate-500">{a?.email || a?.contact_email}</p>}
			</div>
		</div>
	);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 py-2 text-sm">
			<dt className="text-slate-500">{label}</dt>
			<dd className="text-right font-medium text-slate-900">{children}</dd>
		</div>
	);
}

function SheetFrame({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
			<button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
			<div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
				<div className="mb-4 flex items-start justify-between gap-3">
					<div>
						<h2 id="sheet-title" className="text-lg font-semibold text-slate-900">
							{title}
						</h2>
						{subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100">
						<X className="h-5 w-5" />
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

export default function AdminShipmentDetailPage() {
	const reference = String(useParams().reference ?? "");
	const { data: shipment, loading, error, retry } = useRemote<Shipment>(reference ? `admin-shipment:${reference}` : null, async () => {
		const res = await apiClient.getShipment(reference);
		if (!res?.success || !res.data) throw new Error(res?.message || "Shipment not found");
		return res.data;
	});

	const [sheet, setSheet] = useState<Sheet>(null);
	const [busy, setBusy] = useState(false);
	const [sheetError, setSheetError] = useState("");
	const [notice, setNotice] = useState("");
	const [statusForm, setStatusForm] = useState({ status: "", location: "", notes: "" });
	const [driverId, setDriverId] = useState("");
	const [pick, setPick] = useState("");
	const [quoteRound, setQuoteRound] = useState(0);

	const drivers = useRemote<Driver[]>(sheet === "driver" ? "admin-drivers" : null, async () => (await apiClient.listDrivers()).data ?? []);
	// Fresh partner rates every time the sheet opens (rates expire).
	const quotes = useRemote<PartnerQuotes>(sheet === "push" && shipment ? `partner-quotes:${shipment.id}:${quoteRound}` : null, async () => (await apiClient.getPartnerQuotes(String(shipment?.id))).data);

	const open = (s: Sheet) => {
		setSheetError("");
		if (s === "status" && shipment) setStatusForm({ status: shipment.status, location: "", notes: "" });
		if (s === "driver") setDriverId(shipment?.driver?.id ? String(shipment.driver.id) : "");
		if (s === "push") {
			setPick("");
			setQuoteRound((n) => n + 1);
		}
		setSheet(s);
	};

	const run = async (action: () => Promise<unknown>, done: string) => {
		setBusy(true);
		setSheetError("");
		try {
			await action();
			setSheet(null);
			setNotice(done);
			retry();
		} catch (err) {
			setSheetError(errorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	if (loading && !shipment) {
		return (
			<DashboardLayout role="admin">
				<div className="space-y-4" aria-label="Loading">
					<div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
					<div className="grid gap-4 lg:grid-cols-3">
						<div className="h-72 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
						<div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (error || !shipment) {
		return (
			<DashboardLayout role="admin">
				<Panel>
					<ErrorState text={error || "Shipment not found."} onRetry={retry} />
					<div className="text-center">
						<Link href="/dashboard/admin/shipments" className="text-sm font-semibold text-[#1B3B5F] hover:underline">
							Back to shipments
						</Link>
					</div>
				</Panel>
			</DashboardLayout>
		);
	}

	const s = shipment;
	const closed = CLOSED_STATUSES.includes(s.status);
	const isPartner = s.carrier_type === "external";
	const needsBooking = isPartner && !s.external_carrier_reference;
	const events = [...(s.tracking_events ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const agentName = [s.agent?.user?.attributes?.first_name, s.agent?.user?.attributes?.last_name].filter(Boolean).join(" ");
	const deliveryPlace = [s.delivery_address?.city, s.delivery_address?.state].filter(Boolean).join(", ");
	const total = Number(s.shipping_fee || 0) + Number(s.product_value || 0);

	return (
		<DashboardLayout role="admin">
			<div className="space-y-6">
				<Link href="/dashboard/admin/shipments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#1B3B5F]">
					<ArrowLeft className="h-4 w-4" aria-hidden /> Shipments
				</Link>

				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="font-mono text-2xl font-bold text-slate-900 sm:text-3xl">{s.shipment_reference}</h1>
							<StatusBadge status={s.status} />
							{needsBooking && <ToneBadge tone="warning">Needs booking</ToneBadge>}
						</div>
						<p className="mt-1 text-sm text-slate-600">
							Created {formatDate(s.createdAt)}
							{s.order_reference ? ` · Order ${s.order_reference}` : ""}
							{s.vendor_name ? ` · ${s.vendor_name}` : ""}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{needsBooking && (
							<Button onClick={() => open("partner")}>
								<Handshake className="h-4 w-4" aria-hidden /> Book with partner
							</Button>
						)}
						{!isPartner && !closed && (
							<Button variant="secondary" onClick={() => open("push")}>
								<Send className="h-4 w-4" aria-hidden /> Send to partner
							</Button>
						)}
						{!isPartner && !closed && (
							<Button variant="secondary" onClick={() => open("driver")}>
								<Truck className="h-4 w-4" aria-hidden /> {s.driver ? "Change driver" : "Assign driver"}
							</Button>
						)}
						<Button variant={needsBooking ? "secondary" : "primary"} onClick={() => open("status")}>
							Update status
						</Button>
					</div>
				</div>

				{notice && (
					<Alert type="success" role="status">
						{notice}
					</Alert>
				)}

				<div className="grid gap-6 lg:grid-cols-3">
					<div className="space-y-6 lg:col-span-2">
						<Panel title="Tracking history" flush>
							{events.length ? (
								<ol className="px-4 py-2 sm:px-5">
									{events.map((ev, i) => (
										<li key={ev.id ?? i} className="relative flex gap-4 pb-5 last:pb-2">
											{i < events.length - 1 && <span className="absolute left-[7px] top-5 h-full w-px bg-slate-200" aria-hidden />}
											<span className={`relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white ${i === 0 ? "bg-[#1B3B5F]" : "bg-slate-300"}`} aria-hidden />
											<div className="min-w-0 flex-1">
												<div className="flex flex-wrap items-baseline justify-between gap-x-3">
													<p className="font-semibold text-slate-900">{statusMeta(ev.status).label}</p>
													<time className="text-xs text-slate-500" dateTime={ev.createdAt}>
														{new Date(ev.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
													</time>
												</div>
												{ev.description && <p className="text-sm text-slate-600">{ev.description}</p>}
												{ev.location && (
													<p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
														<MapPin className="h-3 w-3" aria-hidden /> {ev.location}
													</p>
												)}
											</div>
										</li>
									))}
								</ol>
							) : (
								<p className="px-5 py-8 text-center text-sm text-slate-500">No tracking updates yet.</p>
							)}
						</Panel>

						<Panel title={`Items (${s.items?.length ?? 0})`} flush>
							{s.items?.length ? (
								<ul className="divide-y divide-slate-100">
									{s.items.map((it) => (
										<li key={it.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
											<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
												<Package className="h-4 w-4" aria-hidden />
											</span>
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-slate-900">{it.name}</p>
												<p className="text-sm text-slate-500">
													Qty {it.quantity}
													{it.weight ? ` · ${it.weight} kg` : ""}
												</p>
											</div>
											<span className="text-sm font-semibold tabular-nums text-slate-900">{formatMoney(it.total_price, it.currency || s.currency)}</span>
										</li>
									))}
								</ul>
							) : (
								<p className="px-5 py-8 text-center text-sm text-slate-500">No items recorded.</p>
							)}
						</Panel>
					</div>

					<div className="space-y-6">
						<Panel title="Route">
							<div className="space-y-5">
								<AddressBlock label="Pickup" a={s.pickup_address} tone="pickup" />
								<AddressBlock label="Delivery" a={s.delivery_address} tone="delivery" />
							</div>
						</Panel>

						<Panel title="Handled by">
							<dl className="divide-y divide-slate-100">
								<Row label="Carrier">{isPartner ? s.carrier_name || "Partner carrier" : "Obana fleet"}</Row>
								{isPartner && <Row label="Partner tracking">{s.external_carrier_reference || <ToneBadge tone="warning">Not booked</ToneBadge>}</Row>}
								{!isPartner && (
									<Row label="Driver">
										{s.driver ? (
											<span>
												{s.driver.driver_code}
												{s.driver.vehicle_type ? <span className="block text-xs font-normal capitalize text-slate-500">{s.driver.vehicle_type} {s.driver.vehicle_registration || ""}</span> : null}
											</span>
										) : (
											<ToneBadge tone="neutral">Not assigned</ToneBadge>
										)}
									</Row>
								)}
								<Row label="Agent">
									{s.agent ? (
										<span>
											{agentName || s.agent.agent_code}
											<span className="block text-xs font-normal text-slate-500">{s.agent.user?.email}</span>
										</span>
									) : (
										"—"
									)}
								</Row>
							</dl>
						</Panel>

						<Panel title="Payment">
							<dl className="divide-y divide-slate-100">
								<Row label="Shipping fee">{formatMoney(s.shipping_fee, s.currency)}</Row>
								<Row label="Goods value">{formatMoney(s.product_value, s.currency)}</Row>
								<Row label="Total">{formatMoney(total, s.currency)}</Row>
							</dl>
						</Panel>
					</div>
				</div>
			</div>

			{sheet === "status" && (
				<SheetFrame title="Update status" subtitle={s.shipment_reference} onClose={() => setSheet(null)}>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							const location = statusForm.status === "delivered" ? statusForm.location || deliveryPlace : statusForm.location;
							run(() => apiClient.updateShipmentStatus(String(s.id), statusForm.status, statusForm.notes || undefined, location), `Status changed to ${statusMeta(statusForm.status).label}.`);
						}}
					>
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<Select label="Status" required value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })} options={STATUS_OPTIONS} />
						<Input
							label="Current location"
							placeholder={statusForm.status === "delivered" ? deliveryPlace || "Delivery address" : "e.g. Ikeja, Lagos"}
							value={statusForm.location}
							onChange={(e) => setStatusForm({ ...statusForm, location: e.target.value })}
							helperText={statusForm.status === "delivered" ? "Leave empty to use the delivery address." : undefined}
						/>
						<Textarea label="Note for the customer (optional)" rows={2} value={statusForm.notes} onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })} />
						<Button type="submit" size="lg" fullWidth loading={busy} disabled={statusForm.status === s.status && !statusForm.notes && !statusForm.location}>
							{busy ? "Saving…" : "Save update"}
						</Button>
					</form>
				</SheetFrame>
			)}

			{sheet === "driver" && (
				<SheetFrame title={s.driver ? "Change driver" : "Assign driver"} subtitle={s.shipment_reference} onClose={() => setSheet(null)}>
					<form
						className="space-y-4"
						onSubmit={(e) => {
							e.preventDefault();
							const d = drivers.data?.find((x) => String(x.id) === driverId);
							run(() => apiClient.assignDriver(String(s.id), driverId), `Assigned to ${d?.driver_code ?? "driver"}.`);
						}}
					>
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						{drivers.error ? (
							<ErrorState text={drivers.error} onRetry={drivers.retry} />
						) : (
							<Select
								label="Driver"
								required
								placeholder={drivers.loading ? "Loading drivers…" : "Choose a driver"}
								disabled={drivers.loading}
								value={driverId}
								onChange={(e) => setDriverId(e.target.value)}
								options={(drivers.data ?? [])
									.filter((d) => !d.status || d.status === "active")
									.map((d) => {
										const name = [d.metadata?.first_name, d.metadata?.last_name].filter(Boolean).join(" ");
										return { value: String(d.id), label: `${d.driver_code}${name ? ` · ${name}` : ""}${d.vehicle_type ? ` · ${d.vehicle_type}` : ""}` };
									})}
								helperText="Only active drivers are listed. The driver is notified and sees it in their app."
							/>
						)}
						<Button type="submit" size="lg" fullWidth loading={busy} disabled={!driverId}>
							<UserRound className="h-4 w-4" aria-hidden /> {busy ? "Assigning…" : "Assign driver"}
						</Button>
					</form>
				</SheetFrame>
			)}

			{sheet === "push" && (
				<SheetFrame title="Send to a partner" subtitle={s.shipment_reference} onClose={() => setSheet(null)}>
					<div className="space-y-4">
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<p className="text-sm text-slate-600">
							Live partner rates for this route. The customer already paid <strong className="text-slate-900">{formatMoney(s.shipping_fee, s.currency)}</strong> — booking a partner doesn&apos;t change
							their price. The partner collects from the pickup address.
						</p>
						{quotes.loading ? (
							<div className="-mx-4 sm:-mx-5">
								<ListSkeleton rows={3} />
							</div>
						) : quotes.error ? (
							<ErrorState text={quotes.error} onRetry={quotes.retry} />
						) : !quotes.data?.options?.length ? (
							<p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">No partner can take this route right now. Check the addresses or try again later.</p>
						) : (
							<fieldset className="space-y-2">
								<legend className="sr-only">Choose a partner</legend>
								{quotes.data.options.map((o) => {
									const margin = Number(s.shipping_fee || 0) - o.cost;
									return (
										<label key={o.rate_id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${pick === o.rate_id ? "border-[#1B3B5F] bg-[#1B3B5F]/5" : "border-slate-200"}`}>
											<input type="radio" name="partner-rate" className="h-4 w-4 accent-[#1B3B5F]" checked={pick === o.rate_id} onChange={() => setPick(o.rate_id)} />
											<span className="min-w-0 flex-1">
												<span className="block truncate font-semibold text-slate-900">{o.carrier_name}</span>
												<span className="text-xs text-slate-500">{o.eta || "Delivery time not given"}</span>
											</span>
											<span className="text-right text-sm">
												<span className="block font-semibold tabular-nums text-slate-900">{formatMoney(o.cost)}</span>
												<span className={`text-xs font-medium ${margin >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
													{margin >= 0 ? "Margin" : "Loss"} {formatMoney(Math.abs(margin))}
												</span>
											</span>
										</label>
									);
								})}
							</fieldset>
						)}
						<Button
							size="lg"
							fullWidth
							disabled={!pick || !quotes.data}
							loading={busy}
							onClick={() =>
								run(() => apiClient.pushToPartner(String(s.id), { rate_id: pick, terminal_shipment_id: quotes.data?.terminal_shipment_id ?? "", carrier_name: quotes.data?.options.find((o) => o.rate_id === pick)?.carrier_name }), "Sent to the partner — pickup booked.")
							}
						>
							{busy ? "Booking…" : "Book with selected partner"}
						</Button>
					</div>
				</SheetFrame>
			)}

			{sheet === "partner" && (
				<SheetFrame title="Book with partner" subtitle={s.shipment_reference} onClose={() => setSheet(null)}>
					<div className="space-y-4">
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<p className="text-sm text-slate-600">
							This books the pickup with <strong className="text-slate-900">{s.carrier_name || "the partner carrier"}</strong> through Terminal Africa at the rate the customer was quoted. The partner will
							collect from the pickup address and give a tracking number. This can&apos;t be undone here.
						</p>
						<dl className="rounded-2xl bg-slate-50 px-4">
							<Row label="Route">
								{s.pickup_address?.city || "—"} → {s.delivery_address?.city || "—"}
							</Row>
							<Row label="Customer paid">{formatMoney(s.shipping_fee, s.currency)}</Row>
						</dl>
						<div className="grid gap-2 sm:grid-cols-2">
							<Button variant="secondary" size="lg" fullWidth onClick={() => setSheet(null)}>
								Cancel
							</Button>
							<Button size="lg" fullWidth loading={busy} onClick={() => run(() => apiClient.confirmExternalShipment(String(s.id)), "Pickup booked with the partner.")}>
								{busy ? "Booking…" : "Book pickup"}
							</Button>
						</div>
					</div>
				</SheetFrame>
			)}
		</DashboardLayout>
	);
}
