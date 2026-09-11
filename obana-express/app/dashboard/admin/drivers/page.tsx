"use client";

import React, { useState } from "react";
import { Pencil, Plus, Search, ShieldAlert, Trash2, Truck, UserCheck, Users, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import PhoneInput from "@/components/PhoneInput";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, StatCard, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button, Input, Select } from "@/components/ui";
import { apiClient } from "@/lib/api";
import type { Tone } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

type DriverMeta = { first_name?: string; last_name?: string; phone?: string; email?: string };

// Shape of GET /users?role=driver (Drivers.findAll with the linked user).
interface Driver {
	id: number;
	user_id: number;
	driver_code: string;
	vehicle_type: string;
	vehicle_registration?: string | null;
	status: string;
	total_deliveries?: number;
	metadata?: DriverMeta | string | null;
	user?: { id?: number; email?: string; phone?: string; createdAt?: string } | null;
}

type Form = {
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
	password: string;
	vehicle_type: string;
	vehicle_registration: string;
	status: string;
};
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY_FORM: Form = { first_name: "", last_name: "", email: "", phone: "", password: "", vehicle_type: "bike", vehicle_registration: "", status: "active" };

const VEHICLES = [
	{ value: "bike", label: "Bike" },
	{ value: "car", label: "Car" },
	{ value: "van", label: "Van" },
	{ value: "truck", label: "Truck" },
];

// Mirrors the status ENUM in Backend/src/models/driversModel.js.
const STATUS: Record<string, { label: string; tone: Tone }> = {
	active: { label: "Active", tone: "success" },
	inactive: { label: "Inactive", tone: "neutral" },
	on_leave: { label: "On leave", tone: "neutral" },
	suspended: { label: "Suspended", tone: "danger" },
};
const STATUS_OPTIONS = Object.entries(STATUS).map(([value, s]) => ({ value, label: s.label }));
const FILTERS = [{ value: "", label: "All" }, ...STATUS_OPTIONS];

const statusOf = (s?: string) => STATUS[s ?? ""] ?? { label: s ? s.replace(/_/g, " ") : "Unknown", tone: "neutral" as Tone };

function metaOf(d: Driver): DriverMeta {
	if (typeof d.metadata === "string") {
		try {
			return JSON.parse(d.metadata) as DriverMeta;
		} catch {
			return {};
		}
	}
	return d.metadata ?? {};
}

const nameOf = (d: Driver) => {
	const m = metaOf(d);
	return [m.first_name, m.last_name].filter(Boolean).join(" ");
};
const phoneOf = (d: Driver) => d.user?.phone || metaOf(d).phone || "";
const emailOf = (d: Driver) => d.user?.email || metaOf(d).email || "";

/** Numbers saved by the phone field have no "+"; show them in international form. */
function showPhone(p: string) {
	if (!p) return "";
	return /^\d{10,15}$/.test(p) && !p.startsWith("0") ? `+${p}` : p;
}

function initials(text: string) {
	const parts = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({ label }: { label: string }) {
	return (
		<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1B3B5F]/10 text-sm font-semibold text-[#1B3B5F]" aria-hidden>
			{initials(label)}
		</span>
	);
}

function SheetFrame({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
	return (
		<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
			<button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
			<div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
				<div className="mb-4 flex items-start justify-between gap-3">
					<div className="min-w-0">
						<h2 id="sheet-title" className="text-lg font-semibold text-slate-900">
							{title}
						</h2>
						{subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-100">
						<X className="h-5 w-5" />
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}

function validate(form: Form, creating: boolean): Errors {
	const e: Errors = {};
	if (!form.first_name.trim()) e.first_name = "Enter the driver's first name.";
	if (!form.last_name.trim()) e.last_name = "Enter the driver's last name.";
	if (creating) {
		if (!form.email.trim()) e.email = "Enter an email address — the driver signs in with it.";
		else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address, like name@example.com.";
		if (form.password.length < 8) e.password = "Use at least 8 characters.";
	}
	if (form.phone.replace(/\D/g, "").length < 8) e.phone = "Enter a valid phone number.";
	if (!form.vehicle_type) e.vehicle_type = "Choose a vehicle type.";
	if (!creating && !form.status) e.status = "Choose a status.";
	return e;
}

export default function AdminDriversPage() {
	const { data, loading, error, retry } = useRemote<Driver[]>("admin-drivers", async () => ((await apiClient.listDrivers()).data ?? []) as Driver[]);

	const [query, setQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("");
	const [sheet, setSheet] = useState<"form" | "delete" | null>(null);
	const [editing, setEditing] = useState<Driver | null>(null);
	const [target, setTarget] = useState<Driver | null>(null);
	const [form, setForm] = useState<Form>(EMPTY_FORM);
	const [errors, setErrors] = useState<Errors>({});
	const [busy, setBusy] = useState(false);
	const [sheetError, setSheetError] = useState("");
	const [notice, setNotice] = useState("");

	const drivers = data ?? [];
	const q = query.trim().toLowerCase();
	const qDigits = q.replace(/\D/g, "");
	const visible = drivers.filter((d) => {
		if (statusFilter && d.status !== statusFilter) return false;
		if (!q) return true;
		const hay = [nameOf(d), d.driver_code, emailOf(d), phoneOf(d)].join(" ").toLowerCase();
		return hay.includes(q) || (qDigits.length >= 3 && phoneOf(d).replace(/\D/g, "").includes(qDigits));
	});
	const filtered = Boolean(q || statusFilter);
	const count = (s: string) => (s ? drivers.filter((d) => d.status === s).length : drivers.length);

	const set = (field: keyof Form, value: string) => {
		setForm((f) => ({ ...f, [field]: value }));
		if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
	};

	const openAdd = () => {
		setEditing(null);
		setForm(EMPTY_FORM);
		setErrors({});
		setSheetError("");
		setSheet("form");
	};

	const openEdit = (d: Driver) => {
		const m = metaOf(d);
		// Local Nigerian numbers (080…) are shown in international form so the phone field reads them correctly.
		const raw = phoneOf(d).replace(/[^\d]/g, "");
		const phone = /^0\d{10}$/.test(raw) ? `234${raw.slice(1)}` : raw;
		setEditing(d);
		setForm({
			first_name: m.first_name || "",
			last_name: m.last_name || "",
			email: emailOf(d),
			phone,
			password: "",
			vehicle_type: d.vehicle_type || "bike",
			vehicle_registration: d.vehicle_registration || "",
			status: d.status || "active",
		});
		setErrors({});
		setSheetError("");
		setSheet("form");
	};

	const openDelete = (d: Driver) => {
		setTarget(d);
		setSheetError("");
		setSheet("delete");
	};

	const close = () => {
		if (!busy) setSheet(null);
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const found = validate(form, !editing);
		setErrors(found);
		if (Object.keys(found).length) return;
		setBusy(true);
		setSheetError("");
		const formData = { ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), vehicle_registration: form.vehicle_registration.trim() };
		try {
			if (editing) {
				await apiClient.updateDriver(editing.user_id.toString(), formData);
				setNotice(`Changes saved for ${formData.first_name} ${formData.last_name}.`);
			} else {
				await apiClient.createDriver(formData);
				setNotice(`${formData.first_name} ${formData.last_name} was added. They can sign in with ${formData.email} and the password you set.`);
			}
			setSheet(null);
			retry();
		} catch (err) {
			setSheetError(errorMessage(err, editing ? "We couldn't save these changes. Please try again." : "We couldn't add this driver. Please try again."));
		} finally {
			setBusy(false);
		}
	};

	const remove = async () => {
		if (!target) return;
		setBusy(true);
		setSheetError("");
		try {
			await apiClient.deleteDriver(target.user_id.toString());
			setNotice(`${nameOf(target) || target.driver_code} was deleted.`);
			setSheet(null);
			retry();
		} catch (err) {
			setSheetError(errorMessage(err, "We couldn't delete this driver. Please try again."));
		} finally {
			setBusy(false);
		}
	};

	const clearFilters = () => {
		setQuery("");
		setStatusFilter("");
	};

	const vehicleLine = (d: Driver) => (
		<>
			<span className="capitalize">{d.vehicle_type || "—"}</span>
			{d.vehicle_registration ? <span className="font-mono text-xs uppercase text-slate-500"> · {d.vehicle_registration}</span> : null}
		</>
	);

	return (
		<DashboardLayout role="admin">
			<div className="space-y-5">
				<PageHeader
					title="Drivers"
					description="Your delivery fleet — add drivers, keep vehicle details current and control who can take jobs."
					actions={
						<Button onClick={openAdd}>
							<Plus className="h-4 w-4" aria-hidden /> Add driver
						</Button>
					}
				/>

				{notice && (
					<Alert type="success" role="status">
						<div className="flex items-start justify-between gap-3">
							<span>{notice}</span>
							<button type="button" onClick={() => setNotice("")} aria-label="Dismiss" className="-m-1 rounded p-1 hover:bg-emerald-100">
								<X className="h-4 w-4" />
							</button>
						</div>
					</Alert>
				)}

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
					<div className="col-span-2 sm:col-span-1">
						<StatCard label="Total drivers" value={drivers.length} icon={Users} loading={loading} />
					</div>
					<StatCard label="Active" value={count("active")} icon={UserCheck} tone="success" loading={loading} />
					<StatCard label="Suspended" value={count("suspended")} icon={ShieldAlert} tone="danger" loading={loading} />
				</div>

				<div className="space-y-3">
					<label className="relative block">
						<span className="sr-only">Search drivers</span>
						<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Name, driver code, phone or email"
							className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
						/>
					</label>
					<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by status">
						{FILTERS.map((o) => (
							<button
								key={o.value || "all"}
								type="button"
								aria-pressed={statusFilter === o.value}
								onClick={() => setStatusFilter(o.value)}
								className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${
									statusFilter === o.value ? "bg-[#1B3B5F] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
								}`}
							>
								{o.label}
								{!loading && <span className={`text-xs tabular-nums ${statusFilter === o.value ? "text-white/70" : "text-slate-400"}`}>{count(o.value)}</span>}
							</button>
						))}
					</div>
				</div>

				<Panel flush>
					{loading ? (
						<ListSkeleton rows={5} />
					) : error ? (
						<ErrorState text={error} onRetry={retry} />
					) : !visible.length ? (
						<EmptyState
							icon={Truck}
							title={filtered ? "No drivers match" : "No drivers yet"}
							text={filtered ? "Try another name, code or status." : "Add your first driver so you can assign deliveries to them."}
							action={
								filtered ? (
									<button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
										<X className="h-4 w-4" aria-hidden /> Clear filters
									</button>
								) : (
									<Button onClick={openAdd}>
										<Plus className="h-4 w-4" aria-hidden /> Add driver
									</Button>
								)
							}
						/>
					) : (
						<>
							{/* Phones and tablets: cards */}
							<ul className="divide-y divide-slate-100 lg:hidden">
								{visible.map((d) => {
									const name = nameOf(d) || "Unnamed driver";
									const st = statusOf(d.status);
									return (
										<li key={d.id} className="flex gap-3 px-4 py-4">
											<Avatar label={nameOf(d) || emailOf(d) || d.driver_code} />
											<div className="min-w-0 flex-1">
												<div className="flex items-start justify-between gap-2">
													<div className="min-w-0">
														<p className="truncate font-semibold text-slate-900">{name}</p>
														<p className="truncate font-mono text-xs text-slate-500">{d.driver_code}</p>
													</div>
													<ToneBadge tone={st.tone}>{st.label}</ToneBadge>
												</div>
												<div className="mt-2 space-y-0.5 text-sm">
													{phoneOf(d) && <p className="truncate text-slate-700">{showPhone(phoneOf(d))}</p>}
													{emailOf(d) && <p className="truncate text-slate-500">{emailOf(d)}</p>}
													<p className="truncate text-slate-600">
														{vehicleLine(d)}
														<span className="text-slate-500"> · {d.total_deliveries ?? 0} deliveries</span>
													</p>
												</div>
												<div className="mt-3 flex gap-2">
													<Button size="sm" variant="secondary" onClick={() => openEdit(d)} aria-label={`Edit ${name}`}>
														<Pencil className="h-4 w-4" aria-hidden /> Edit
													</Button>
													<Button size="sm" variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={() => openDelete(d)} aria-label={`Delete ${name}`}>
														<Trash2 className="h-4 w-4" aria-hidden /> Delete
													</Button>
												</div>
											</div>
										</li>
									);
								})}
							</ul>

							{/* Desktop: table */}
							<div className="hidden overflow-x-auto lg:block">
								<table className="w-full text-left text-sm">
									<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
										<tr>
											<th className="px-5 py-3">Driver</th>
											<th className="px-5 py-3">Contact</th>
											<th className="px-5 py-3">Vehicle</th>
											<th className="px-5 py-3">Status</th>
											<th className="px-5 py-3 text-right">Deliveries</th>
											<th className="px-5 py-3 text-right">
												<span className="sr-only">Actions</span>
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{visible.map((d) => {
											const name = nameOf(d) || "Unnamed driver";
											const st = statusOf(d.status);
											return (
												<tr key={d.id} className="hover:bg-slate-50">
													<td className="px-5 py-3">
														<div className="flex items-center gap-3">
															<Avatar label={nameOf(d) || emailOf(d) || d.driver_code} />
															<div className="min-w-0">
																<p className="font-semibold text-slate-900">{name}</p>
																<p className="font-mono text-xs text-slate-500">{d.driver_code}</p>
															</div>
														</div>
													</td>
													<td className="max-w-[16rem] px-5 py-3">
														<p className="truncate text-slate-800">{showPhone(phoneOf(d)) || "—"}</p>
														<p className="truncate text-xs text-slate-500">{emailOf(d)}</p>
													</td>
													<td className="px-5 py-3 text-slate-800">{vehicleLine(d)}</td>
													<td className="px-5 py-3">
														<ToneBadge tone={st.tone}>{st.label}</ToneBadge>
													</td>
													<td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-900">{d.total_deliveries ?? 0}</td>
													<td className="px-5 py-3">
														<div className="flex justify-end gap-1">
															<button
																type="button"
																onClick={() => openEdit(d)}
																aria-label={`Edit ${name}`}
																title="Edit"
																className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
															>
																<Pencil className="h-4 w-4" />
															</button>
															<button
																type="button"
																onClick={() => openDelete(d)}
																aria-label={`Delete ${name}`}
																title="Delete"
																className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-rose-50 hover:text-rose-700"
															>
																<Trash2 className="h-4 w-4" />
															</button>
														</div>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</>
					)}
				</Panel>
			</div>

			{sheet === "form" && (
				<SheetFrame
					title={editing ? "Edit driver" : "Add driver"}
					subtitle={editing ? `${nameOf(editing) || "Driver"} · ${editing.driver_code}` : "They get their own login to see and update deliveries."}
					onClose={close}
				>
					<form onSubmit={submit} noValidate className="space-y-4">
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<div className="grid gap-4 sm:grid-cols-2">
							<Input label="First name" required autoComplete="off" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} error={errors.first_name} />
							<Input label="Last name" required autoComplete="off" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} error={errors.last_name} />
						</div>
						<Input
							label="Email"
							type="email"
							inputMode="email"
							autoComplete="off"
							required={!editing}
							disabled={!!editing}
							value={form.email}
							onChange={(e) => set("email", e.target.value)}
							error={errors.email}
							helperText={editing ? "The sign-in email can't be changed here." : "The driver signs in with this email."}
						/>
						<PhoneInput label="Phone number" required value={form.phone} onChange={(v) => set("phone", v)} error={errors.phone} />
						{!editing && (
							<Input
								label="Password"
								type="password"
								autoComplete="new-password"
								required
								value={form.password}
								onChange={(e) => set("password", e.target.value)}
								error={errors.password}
								helperText="At least 8 characters. Share it with the driver privately."
							/>
						)}
						<div className="grid gap-4 sm:grid-cols-2">
							<Select label="Vehicle type" required placeholder="Choose vehicle" value={form.vehicle_type} onChange={(e) => set("vehicle_type", e.target.value)} options={VEHICLES} error={errors.vehicle_type} />
							<Input label="Registration no." placeholder="e.g. LSD-123-XY" autoComplete="off" value={form.vehicle_registration} onChange={(e) => set("vehicle_registration", e.target.value)} />
						</div>
						{editing && (
							<Select
								label="Status"
								required
								placeholder="Choose status"
								value={form.status}
								onChange={(e) => set("status", e.target.value)}
								options={STATUS_OPTIONS}
								error={errors.status}
								helperText="Only active drivers can be assigned new deliveries."
							/>
						)}
						<div className="grid gap-2 pt-1 sm:grid-cols-2">
							<Button type="button" variant="secondary" size="lg" fullWidth onClick={close} disabled={busy} className="order-2 sm:order-1">
								Cancel
							</Button>
							<Button type="submit" size="lg" fullWidth loading={busy} className="order-1 sm:order-2">
								{busy ? "Saving…" : editing ? "Save changes" : "Add driver"}
							</Button>
						</div>
					</form>
				</SheetFrame>
			)}

			{sheet === "delete" && target && (
				<SheetFrame title={`Delete ${nameOf(target) || "this driver"}?`} subtitle={target.driver_code} onClose={close}>
					<div className="space-y-4">
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<p className="text-sm text-slate-600">
							This permanently deletes <strong className="text-slate-900">{nameOf(target) || target.driver_code}</strong>&apos;s driver profile and login
							{emailOf(target) ? ` (${emailOf(target)})` : ""}. They won&apos;t be able to sign in or be assigned deliveries. This can&apos;t be undone.
						</p>
						{target.status !== "suspended" && <p className="text-sm text-slate-500">If they&apos;re only taking a break, edit the driver and set their status to On leave or Suspended instead.</p>}
						<div className="grid gap-2 sm:grid-cols-2">
							<Button variant="secondary" size="lg" fullWidth onClick={close} disabled={busy}>
								Keep driver
							</Button>
							<Button variant="danger" size="lg" fullWidth loading={busy} onClick={remove}>
								{busy ? "Deleting…" : "Delete driver"}
							</Button>
						</div>
					</div>
				</SheetFrame>
			)}
		</DashboardLayout>
	);
}
