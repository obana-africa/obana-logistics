"use client";

import React, { useState } from "react";
import { CheckCircle2, MapPin, Package, Truck, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, StatCard, StatusBadge } from "@/components/dashboard/kit";
import { Alert, Button, Input, Select, Textarea } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { CLOSED_STATUSES, STATUS_OPTIONS, routeLabel, type ShipmentStatus } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

type Place = { city?: string; state?: string; country?: string; line1?: string; phone?: string };
interface Shipment {
	id: number;
	shipment_reference: string;
	pickup_address?: Place;
	delivery_address?: Place;
	total_weight?: string | number;
	status: ShipmentStatus;
	metadata?: { carrier_details?: { delivery_eta?: string } };
}

// A driver moves a shipment forward; creating/cancelling is for customers and admins.
const DRIVER_STATUSES = STATUS_OPTIONS.filter((o) => !["pending", "cancelled"].includes(o.value));

export default function DriverDashboard() {
	const user = useAuthStore((s) => s.user);
	const userId = user?.id ? String(user.id) : null;
	const { data, loading, error, retry } = useRemote<Shipment[]>(
		userId && `driver-shipments:${userId}`,
		async () => (await apiClient.listShipments(Number(userId), { role: "driver", limit: 50 })).data?.shipments ?? [],
	);

	const [selected, setSelected] = useState<Shipment | null>(null);
	const [form, setForm] = useState({ status: "", location: "", notes: "" });
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState("");
	const [notice, setNotice] = useState("");

	const shipments = data ?? [];
	const active = shipments.filter((s) => !CLOSED_STATUSES.includes(s.status));
	const done = shipments.filter((s) => s.status === "delivered");
	const firstName = user?.first_name ?? user?.attributes?.first_name;

	const open = (s: Shipment) => {
		setSelected(s);
		setSaveError("");
		setForm({ status: s.status === "pending" ? "picked_up" : s.status, location: "", notes: "" });
	};

	const deliveryPlace = (s: Shipment) => [s.delivery_address?.city, s.delivery_address?.state].filter(Boolean).join(", ");

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selected) return;
		setSaving(true);
		setSaveError("");
		try {
			const location = form.status === "delivered" ? form.location || deliveryPlace(selected) : form.location;
			await apiClient.updateShipmentStatus(String(selected.id), form.status, form.notes || undefined, location);
			setNotice(`${selected.shipment_reference} updated.`);
			setSelected(null);
			retry();
		} catch (err) {
			setSaveError(errorMessage(err, "We couldn't update this shipment. Please try again."));
		} finally {
			setSaving(false);
		}
	};

	return (
		<DashboardLayout role="driver">
			<div className="space-y-6">
				<PageHeader title={firstName ? `Hi ${firstName}` : "Your deliveries"} description="Update each delivery as you go — customers see it straight away." />

				{notice && (
					<Alert type="success" role="status">
						{notice}
					</Alert>
				)}

				<div className="grid grid-cols-2 gap-3 sm:gap-4">
					<StatCard label="To deliver" value={active.length} icon={Truck} tone="progress" loading={loading} />
					<StatCard label="Delivered" value={done.length} icon={CheckCircle2} tone="success" loading={loading} />
				</div>

				<Panel title="Assigned to you" flush>
					{loading ? (
						<ListSkeleton rows={3} />
					) : error ? (
						<ErrorState text={error} onRetry={retry} />
					) : !shipments.length ? (
						<EmptyState icon={Package} title="No deliveries yet" text="When a shipment is assigned to you it appears here, with the pickup and drop-off address." />
					) : (
						<ul className="divide-y divide-slate-100">
							{shipments.map((s) => (
								<li key={s.id} className="px-4 py-4 sm:px-5">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="font-semibold text-slate-900">{routeLabel(s.pickup_address, s.delivery_address)}</p>
											<p className="mt-0.5 font-mono text-xs text-slate-500">{s.shipment_reference}</p>
										</div>
										<StatusBadge status={s.status} />
									</div>
									{s.delivery_address?.line1 && (
										<p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
											<MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
											{s.delivery_address.line1}
										</p>
									)}
									<div className="mt-3 flex items-center justify-between gap-3">
										<p className="text-sm text-slate-500">
											{s.total_weight ? `${s.total_weight} kg` : ""}
											{s.metadata?.carrier_details?.delivery_eta ? ` · ETA ${s.metadata.carrier_details.delivery_eta}` : ""}
										</p>
										{!CLOSED_STATUSES.includes(s.status) && (
											<Button size="sm" onClick={() => open(s)}>
												Update status
											</Button>
										)}
									</div>
								</li>
							))}
						</ul>
					)}
				</Panel>
			</div>

			{selected && (
				<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="update-title">
					<button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={() => setSelected(null)} />
					<form onSubmit={submit} className="relative w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
						<div className="flex items-start justify-between gap-3">
							<div>
								<h2 id="update-title" className="text-lg font-semibold text-slate-900">
									Update delivery
								</h2>
								<p className="font-mono text-xs text-slate-500">{selected.shipment_reference}</p>
							</div>
							<button type="button" onClick={() => setSelected(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100">
								<X className="h-5 w-5" />
							</button>
						</div>
						{saveError && <Alert type="error">{saveError}</Alert>}
						<Select label="Status" required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={DRIVER_STATUSES} />
						<Input
							label="Where are you now?"
							required={form.status !== "delivered"}
							placeholder={form.status === "delivered" ? deliveryPlace(selected) || "Delivery address" : "e.g. Ikeja, Lagos"}
							value={form.location}
							onChange={(e) => setForm({ ...form, location: e.target.value })}
							helperText={form.status === "delivered" ? "Leave empty to use the delivery address." : undefined}
						/>
						<Textarea label="Note for the customer (optional)" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
						<Button type="submit" size="lg" fullWidth loading={saving}>
							{saving ? "Saving…" : "Save update"}
						</Button>
					</form>
				</div>
			)}
		</DashboardLayout>
	);
}
