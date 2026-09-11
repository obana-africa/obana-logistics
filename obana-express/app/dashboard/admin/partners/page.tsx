"use client";

import React, { useState } from "react";
import { Handshake, Percent, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button, Input } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { formatMoney, timeAgo } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

interface Partner {
	slug: string;
	name: string;
	logo_url?: string | null;
	enabled: boolean;
	markup_percent: number | null;
	last_seen_at?: string | null;
}
interface PartnerSettings {
	default_markup_percent: number;
	partners: Partner[];
}

const EXAMPLE_RATE = 10000;

function parsePercent(v: string) {
	const n = Number(v);
	return v.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
		>
			<span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? "translate-x-6" : "translate-x-1"}`} />
		</button>
	);
}

function PartnerLogo({ p }: { p: Partner }) {
	if (p.logo_url) {
		// eslint-disable-next-line @next/next/no-img-element
		return <img src={p.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1" />;
	}
	return <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">{p.name.slice(0, 2).toUpperCase()}</span>;
}

export default function PartnersPage() {
	const { data, loading, error, retry } = useRemote<PartnerSettings>("admin-partners", async () => {
		try {
			return (await apiClient.listPartners()).data;
		} catch (err) {
			if ((err as { response?: { status?: number } })?.response?.status === 404) {
				throw new Error("Partner settings aren't on the server yet — deploy the latest backend to turn them on.");
			}
			throw err;
		}
	});

	const [defaultDraft, setDefaultDraft] = useState<string | null>(null);
	const [savingDefault, setSavingDefault] = useState(false);
	const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
	const [editing, setEditing] = useState<Partner | null>(null);
	const [form, setForm] = useState({ useDefault: true, percent: "" });
	const [saving, setSaving] = useState(false);
	const [sheetError, setSheetError] = useState("");
	const [toggling, setToggling] = useState<string | null>(null);

	const defaultPct = data?.default_markup_percent ?? 0;
	const draft = defaultDraft ?? String(defaultPct);
	const draftPct = parsePercent(draft);
	const partners = data?.partners ?? [];
	const enabledCount = partners.filter((p) => p.enabled).length;

	const saveDefault = async (e: React.FormEvent) => {
		e.preventDefault();
		if (draftPct === null) return;
		setSavingDefault(true);
		setNotice(null);
		try {
			await apiClient.updatePartnerDefaults({ markup_percent: draftPct });
			setDefaultDraft(null);
			setNotice({ type: "success", text: `Default markup set to ${draftPct}%. New quotes use it straight away.` });
			retry();
		} catch (err) {
			setNotice({ type: "error", text: errorMessage(err) });
		} finally {
			setSavingDefault(false);
		}
	};

	const toggle = async (p: Partner, enabled: boolean) => {
		setToggling(p.slug);
		setNotice(null);
		try {
			await apiClient.updatePartner(p.slug, { enabled });
			setNotice({ type: "success", text: `${p.name} ${enabled ? "will be offered in quotes again" : "is switched off — its rates won't be offered"}.` });
			retry();
		} catch (err) {
			setNotice({ type: "error", text: errorMessage(err) });
		} finally {
			setToggling(null);
		}
	};

	const openEdit = (p: Partner) => {
		setEditing(p);
		setSheetError("");
		setForm({ useDefault: p.markup_percent === null, percent: p.markup_percent === null ? "" : String(p.markup_percent) });
	};

	const customPct = parsePercent(form.percent);
	const saveEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editing || (!form.useDefault && customPct === null)) return;
		setSaving(true);
		setSheetError("");
		try {
			await apiClient.updatePartner(editing.slug, { markup_percent: form.useDefault ? null : customPct });
			setNotice({ type: "success", text: `${editing.name} now uses ${form.useDefault ? `the default markup (${defaultPct}%)` : `${customPct}% markup`}.` });
			setEditing(null);
			retry();
		} catch (err) {
			setSheetError(errorMessage(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<DashboardLayout role="admin">
			<div className="space-y-6">
				<PageHeader title="Partners & markup" description="Carriers Obana books through when our own fleet can't take a shipment. Customers see the partner's rate plus your markup." />

				{notice && (
					<Alert type={notice.type} role="status">
						{notice.text}
					</Alert>
				)}

				{error ? (
					<Panel>
						<ErrorState text={error} onRetry={retry} />
					</Panel>
				) : (
					<>
						<Panel title="Default markup" description="Applied to every partner unless you set a custom markup for it.">
							<form onSubmit={saveDefault} className="flex flex-col gap-4 sm:flex-row sm:items-end">
								<div className="sm:w-48">
									<Input
										label="Markup"
										type="number"
										inputMode="decimal"
										min={0}
										max={100}
										step="0.5"
										disabled={loading}
										value={loading ? "" : draft}
										onChange={(e) => setDefaultDraft(e.target.value)}
										error={draftPct === null ? "Enter 0 to 100." : undefined}
										trailing={<Percent className="mr-2 h-4 w-4 text-slate-400" aria-hidden />}
									/>
								</div>
								<p className="flex-1 pb-3 text-sm text-slate-600">
									{draftPct === null ? (
										"—"
									) : (
										<>
											A {formatMoney(EXAMPLE_RATE)} partner rate is quoted to the customer at{" "}
											<strong className="text-slate-900">{formatMoney(Math.ceil(EXAMPLE_RATE * (1 + draftPct / 100)))}</strong>.
										</>
									)}
								</p>
								<Button type="submit" loading={savingDefault} disabled={loading || draftPct === null || draftPct === defaultPct}>
									{savingDefault ? "Saving…" : "Save"}
								</Button>
							</form>
						</Panel>

						<Panel title="Partner carriers" description={loading ? undefined : `${enabledCount} of ${partners.length} offered in quotes`} flush>
							{loading ? (
								<ListSkeleton rows={4} />
							) : !partners.length ? (
								<EmptyState
									icon={Handshake}
									title="No partners yet"
									text="Partners appear here automatically the first time a quote comes back with their rates (through Terminal Africa: GIG, DHL, FedEx, UPS and others)."
								/>
							) : (
								<ul className="divide-y divide-slate-100">
									{partners.map((p) => (
										<li key={p.slug} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:px-5">
											<PartnerLogo p={p} />
											<div className="min-w-0 flex-1">
												<p className="truncate font-semibold text-slate-900">{p.name}</p>
												<p className="text-sm text-slate-500">{p.last_seen_at ? `Rates seen ${timeAgo(p.last_seen_at)}` : "No rates seen yet"}</p>
											</div>
											<button
												type="button"
												onClick={() => openEdit(p)}
												className="order-3 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 sm:order-none"
											>
												{p.markup_percent === null ? `Default · ${defaultPct}%` : `Custom · ${p.markup_percent}%`}
											</button>
											<div className="ml-auto flex items-center gap-2 sm:ml-0">
												<ToneBadge tone={p.enabled ? "success" : "neutral"}>{p.enabled ? "On" : "Off"}</ToneBadge>
												<Switch checked={p.enabled} disabled={toggling === p.slug} onChange={(v) => toggle(p, v)} label={`Offer ${p.name} in quotes`} />
											</div>
										</li>
									))}
								</ul>
							)}
						</Panel>

						<Panel title="How partner pricing works">
							<ol className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
								{[
									["Quote", "A customer or connected platform asks for a price."],
									["Rates", "If our fleet doesn't cover the route, we fetch partner rates."],
									["Markup", "We add the markup and offer the cheapest partner that is switched on."],
									["Book", "After payment, open the shipment and use “Book with partner”."],
								].map(([t, d], i) => (
									<li key={t} className="flex gap-3">
										<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1B3B5F] text-xs font-bold text-white">{i + 1}</span>
										<span>
											<strong className="block text-slate-900">{t}</strong>
											{d}
										</span>
									</li>
								))}
							</ol>
						</Panel>
					</>
				)}
			</div>

			{editing && (
				<div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="partner-title">
					<button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/40" onClick={() => setEditing(null)} />
					<form onSubmit={saveEdit} className="relative w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl">
						<div className="flex items-start justify-between gap-3">
							<div className="flex items-center gap-3">
								<PartnerLogo p={editing} />
								<div>
									<h2 id="partner-title" className="text-lg font-semibold text-slate-900">
										{editing.name}
									</h2>
									<p className="text-sm text-slate-500">Markup on this partner&apos;s rates</p>
								</div>
							</div>
							<button type="button" onClick={() => setEditing(null)} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100">
								<X className="h-5 w-5" />
							</button>
						</div>
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<fieldset className="space-y-2">
							<legend className="sr-only">Markup</legend>
							{[
								{ v: true, t: `Use the default (${defaultPct}%)`, d: "Changes when you change the default." },
								{ v: false, t: "Custom markup", d: "Only for this partner." },
							].map((o) => (
								<label key={String(o.v)} className={`flex cursor-pointer gap-3 rounded-2xl border p-4 ${form.useDefault === o.v ? "border-[#1B3B5F] bg-[#1B3B5F]/5" : "border-slate-200"}`}>
									<input type="radio" name="markup-mode" className="mt-1 h-4 w-4 accent-[#1B3B5F]" checked={form.useDefault === o.v} onChange={() => setForm({ ...form, useDefault: o.v })} />
									<span>
										<span className="block font-semibold text-slate-900">{o.t}</span>
										<span className="text-sm text-slate-500">{o.d}</span>
									</span>
								</label>
							))}
						</fieldset>
						{!form.useDefault && (
							<Input
								label="Custom markup"
								type="number"
								inputMode="decimal"
								min={0}
								max={100}
								step="0.5"
								required
								value={form.percent}
								onChange={(e) => setForm({ ...form, percent: e.target.value })}
								error={form.percent !== "" && customPct === null ? "Enter 0 to 100." : undefined}
								helperText={customPct !== null ? `${formatMoney(EXAMPLE_RATE)} → ${formatMoney(Math.ceil(EXAMPLE_RATE * (1 + customPct / 100)))}` : undefined}
								trailing={<Percent className="mr-2 h-4 w-4 text-slate-400" aria-hidden />}
							/>
						)}
						<Button type="submit" size="lg" fullWidth loading={saving} disabled={!form.useDefault && customPct === null}>
							{saving ? "Saving…" : "Save"}
						</Button>
					</form>
				</div>
			)}
		</DashboardLayout>
	);
}
