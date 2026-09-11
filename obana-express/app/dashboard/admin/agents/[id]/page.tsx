"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, FileImage, ShieldAlert, Trash2, X, XCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { ButtonLink, ErrorState, Panel, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button, Select } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { formatDate, type Tone } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";
import type { Agent } from "../page";

// Shape of GET /agents/:id — the agent row plus user { id, email, phone } (no names on this endpoint).
type AgentDetail = Omit<Agent, "user"> & {
	user_id?: number;
	user?: Partial<Agent["user"]> | null;
	government_id_type?: string | null;
	government_id_number?: string | null;
	government_id_image?: string | null;
	profile_photo?: string | null;
	country?: string | null;
	state?: string | null;
	city?: string | null;
	lga?: string | null;
	assigned_zone?: string | null;
	service_radius?: number | null;
	updatedAt?: string;
};

type Change = { verification_status: string; status: string };

// Mirrors the ENUMs in Backend/src/models/agentModel.js (same labels as the agents list).
const VERIFICATION: Record<string, { label: string; tone: Tone }> = {
	pending: { label: "Needs review", tone: "warning" },
	verified: { label: "ID verified", tone: "success" },
	failed: { label: "ID rejected", tone: "danger" },
};
const ACCOUNT: Record<string, { label: string; tone: Tone }> = {
	pending_verification: { label: "Awaiting verification", tone: "neutral" },
	active: { label: "Active", tone: "success" },
	suspended: { label: "Suspended", tone: "danger" },
	deactivated: { label: "Deactivated", tone: "neutral" },
};

const meta = (map: Record<string, { label: string; tone: Tone }>, key?: string | null) => map[key ?? ""] ?? { label: key ? key.replace(/_/g, " ") : "Unknown", tone: "neutral" as Tone };

const VERIFICATION_OPTIONS = [
	{ value: "pending", label: "Pending review" },
	{ value: "verified", label: "Verified" },
	{ value: "failed", label: "Failed (rejected)" },
];
const ACCOUNT_OPTIONS = [
	{ value: "pending_verification", label: "Pending verification" },
	{ value: "active", label: "Active" },
	{ value: "suspended", label: "Suspended" },
	{ value: "deactivated", label: "Deactivated" },
];

function showPhone(p?: string | null) {
	if (!p) return "";
	return /^\d{10,15}$/.test(p) && !p.startsWith("0") ? `+${p}` : p;
}

function initials(text: string) {
	const parts = text.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-start justify-between gap-4 py-2.5 text-sm">
			<dt className="shrink-0 text-slate-500">{label}</dt>
			<dd className="min-w-0 break-words text-right font-medium text-slate-900">{children}</dd>
		</div>
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

function DocPreview({ label, src }: { label: string; src?: string | null }) {
	return (
		<div>
			<p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
			{src ? (
				<a href={src} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
					{/* Uploads can live on any storage host, so a plain <img> is used instead of next/image. */}
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src={src} alt={label} className="h-48 w-full object-contain transition group-hover:opacity-90" />
					<span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
						<ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open full size
					</span>
				</a>
			) : (
				<div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
					<FileImage className="mb-2 h-6 w-6 text-slate-400" aria-hidden />
					Not uploaded
				</div>
			)}
		</div>
	);
}

export default function AgentDetailPage() {
	const id = String(useParams().id ?? "");
	const { data: agent, loading, error, retry } = useRemote<AgentDetail>(id ? `admin-agent:${id}` : null, async () => {
		const response = await apiClient.getAgent(id);
		if (response.status !== "success" || !response.data) throw new Error(response.message || "Failed to fetch agent details.");
		return response.data as AgentDetail;
	});

	// Unsaved edits on top of the loaded agent (cleared after each save).
	const [draft, setDraft] = useState<Partial<Change>>({});
	const [confirm, setConfirm] = useState<{ change: Change; title: string; action: string } | null>(null);
	const [deleting, setDeleting] = useState(false);
	const [busy, setBusy] = useState(false);
	const [sheetError, setSheetError] = useState("");
	const [notice, setNotice] = useState("");
	const [removed, setRemoved] = useState("");

	if (removed) {
		return (
			<DashboardLayout role="admin">
				<Panel>
					<div className="flex flex-col items-center px-4 py-10 text-center">
						<span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
							<CheckCircle2 className="h-6 w-6" aria-hidden />
						</span>
						<p className="mt-4 font-semibold text-slate-900">Agent profile removed</p>
						<p className="mt-1 max-w-sm text-sm text-slate-500">{removed}</p>
						<div className="mt-5">
							<ButtonLink href="/dashboard/admin/agents" icon={ArrowLeft}>
								Back to agents
							</ButtonLink>
						</div>
					</div>
				</Panel>
			</DashboardLayout>
		);
	}

	if (loading && !agent) {
		return (
			<DashboardLayout role="admin">
				<div className="space-y-4" aria-label="Loading">
					<div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
					<div className="flex items-center gap-4">
						<div className="h-16 w-16 animate-pulse rounded-2xl bg-slate-200" />
						<div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
					</div>
					<div className="grid gap-4 lg:grid-cols-3">
						<div className="h-80 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
						<div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
					</div>
				</div>
			</DashboardLayout>
		);
	}

	if (error || !agent) {
		return (
			<DashboardLayout role="admin">
				<Panel>
					<ErrorState text={error || "Agent not found."} onRetry={retry} />
					<div className="text-center">
						<Link href="/dashboard/admin/agents" className="text-sm font-semibold text-[#1B3B5F] hover:underline">
							Back to agents
						</Link>
					</div>
				</Panel>
			</DashboardLayout>
		);
	}

	const a = agent;
	const name = [a.user?.first_name, a.user?.last_name].filter(Boolean).join(" ");
	const title = name || a.user?.email || a.agent_code;
	const current: Change = { verification_status: draft.verification_status ?? a.verification_status, status: draft.status ?? a.status };
	const dirty = current.verification_status !== a.verification_status || current.status !== a.status;
	const v = meta(VERIFICATION, a.verification_status);
	const s = meta(ACCOUNT, a.status);
	const pending = a.verification_status === "pending";

	const ask = (change: Change, sheetTitle: string, action: string) => {
		setSheetError("");
		setConfirm({ change, title: sheetTitle, action });
	};

	const save = async () => {
		if (!confirm) return;
		setBusy(true);
		setSheetError("");
		try {
			// Same payload as before: the whole agent record with the new statuses, minus id and user.
			const updateData: Record<string, unknown> = { ...a, ...confirm.change };
			delete updateData.id;
			delete updateData.user;
			const response = await apiClient.updateAgent(a.id.toString(), updateData);
			if (response.status !== "success") throw new Error(response.message || "Failed to update agent.");
			const nv = meta(VERIFICATION, confirm.change.verification_status).label;
			const ns = meta(ACCOUNT, confirm.change.status).label;
			setNotice(`${a.agent_code} updated — ${nv.toLowerCase()}, account ${ns.toLowerCase()}.${a.user?.email ? ` We've emailed ${a.user.email}.` : ""}`);
			setConfirm(null);
			setDraft({});
			retry();
		} catch (err) {
			setSheetError(errorMessage(err, "An error occurred while saving. Please try again."));
		} finally {
			setBusy(false);
		}
	};

	const remove = async () => {
		setBusy(true);
		setSheetError("");
		try {
			await apiClient.deleteAgent(a.id.toString());
			setDeleting(false);
			setRemoved(`${title} is no longer an agent. Their user account stays and is now a customer account.`);
		} catch (err) {
			setSheetError(errorMessage(err, "Failed to delete agent. Please try again."));
		} finally {
			setBusy(false);
		}
	};

	const changeLines = (c: Change) =>
		[
			c.verification_status !== a.verification_status && { label: "ID check", from: meta(VERIFICATION, a.verification_status).label, to: meta(VERIFICATION, c.verification_status).label },
			c.status !== a.status && { label: "Account", from: meta(ACCOUNT, a.status).label, to: meta(ACCOUNT, c.status).label },
		].filter(Boolean) as { label: string; from: string; to: string }[];

	return (
		<DashboardLayout role="admin">
			<div className="space-y-6">
				<Link href="/dashboard/admin/agents" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-[#1B3B5F]">
					<ArrowLeft className="h-4 w-4" aria-hidden /> Agents
				</Link>

				<div className="flex min-w-0 items-center gap-4">
					{a.profile_photo ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={a.profile_photo} alt="" className="h-16 w-16 shrink-0 rounded-2xl border border-slate-200 object-cover" />
					) : (
						<span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#1B3B5F]/10 text-xl font-semibold text-[#1B3B5F]" aria-hidden>
							{initials(title)}
						</span>
					)}
					<div className="min-w-0">
						<h1 className="truncate text-2xl font-bold text-slate-900 sm:text-3xl" style={{ fontFamily: "var(--font-display)" }}>
							{title}
						</h1>
						<p className="mt-0.5 text-sm text-slate-600">
							<span className="font-mono">{a.agent_code}</span> · Joined {formatDate(a.createdAt)}
						</p>
						<div className="mt-2 flex flex-wrap gap-1.5">
							<ToneBadge tone={v.tone}>{v.label}</ToneBadge>
							<ToneBadge tone={s.tone}>{s.label}</ToneBadge>
						</div>
					</div>
				</div>

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

				{pending && (
					<div className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
						<div className="flex items-start gap-3">
							<ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
							<div>
								<p className="font-semibold text-amber-950">This agent is waiting for ID review</p>
								<p className="text-sm text-amber-900">Check the ID photo and number below match their details, then approve or reject. They&apos;re emailed either way.</p>
							</div>
						</div>
						<div className="grid shrink-0 grid-cols-2 gap-2">
							<Button variant="secondary" onClick={() => ask({ verification_status: "failed", status: a.status }, "Reject this agent's ID?", "Reject ID")}>
								<XCircle className="h-4 w-4" aria-hidden /> Reject
							</Button>
							<Button onClick={() => ask({ verification_status: "verified", status: "active" }, "Approve this agent?", "Approve agent")}>
								<CheckCircle2 className="h-4 w-4" aria-hidden /> Approve
							</Button>
						</div>
					</div>
				)}

				<div className="grid gap-6 lg:grid-cols-3">
					<div className="space-y-6 lg:col-span-2">
						<Panel title="Identity" description="What the agent submitted when they signed up.">
							<dl className="divide-y divide-slate-100">
								<Row label="ID type">
									{a.government_id_type ? (
										a.government_id_type.length <= 4 ? (
											a.government_id_type.toUpperCase()
										) : (
											<span className="capitalize">{a.government_id_type.replace(/_/g, " ")}</span>
										)
									) : (
										"—"
									)}
								</Row>
								<Row label="ID number">{a.government_id_number ? <span className="font-mono">{a.government_id_number}</span> : "—"}</Row>
							</dl>
							<div className="mt-4 grid gap-4 sm:grid-cols-2">
								<DocPreview label="Government ID" src={a.government_id_image} />
								<DocPreview label="Profile photo" src={a.profile_photo} />
							</div>
						</Panel>

						<Panel title="Location & coverage">
							<dl className="grid gap-x-8 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
								<Row label="Country">{a.country || "—"}</Row>
								<Row label="State">{a.state || "—"}</Row>
								<Row label="City">{a.city || "—"}</Row>
								<Row label="LGA">{a.lga || "—"}</Row>
								<Row label="Assigned zone">{a.assigned_zone || "—"}</Row>
								<Row label="Service radius">{a.service_radius ? `${a.service_radius} km` : "—"}</Row>
							</dl>
						</Panel>
					</div>

					<div className="space-y-6">
						<Panel title="Contact">
							<dl className="divide-y divide-slate-100">
								<Row label="Email">
									{a.user?.email ? (
										<a href={`mailto:${a.user.email}`} className="text-[#1B3B5F] hover:underline">
											{a.user.email}
										</a>
									) : (
										"—"
									)}
								</Row>
								<Row label="Phone">
									{a.user?.phone ? (
										<a href={`tel:${showPhone(a.user.phone)}`} className="text-[#1B3B5F] hover:underline">
											{showPhone(a.user.phone)}
										</a>
									) : (
										"—"
									)}
								</Row>
								<Row label="Agent code">
									<span className="font-mono">{a.agent_code}</span>
								</Row>
								<Row label="Joined">{formatDate(a.createdAt)}</Row>
							</dl>
						</Panel>

						<Panel title="Review & status" description="The agent is emailed when either changes.">
							<form
								className="space-y-4"
								onSubmit={(e) => {
									e.preventDefault();
									if (dirty) ask(current, "Save these changes?", "Save changes");
								}}
							>
								<Select
									label="ID verification"
									placeholder="Select status"
									value={current.verification_status}
									onChange={(e) => setDraft((d) => ({ ...d, verification_status: e.target.value }))}
									options={VERIFICATION_OPTIONS}
								/>
								<Select
									label="Account status"
									placeholder="Select status"
									value={current.status}
									onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
									options={ACCOUNT_OPTIONS}
									helperText="Only active agents can handle shipments."
								/>
								<div className="flex gap-2">
									{dirty && (
										<Button type="button" variant="ghost" onClick={() => setDraft({})}>
											Undo
										</Button>
									)}
									<Button type="submit" fullWidth disabled={!dirty || !current.verification_status || !current.status}>
										Save changes
									</Button>
								</div>
							</form>
						</Panel>

						<Panel title="Remove agent">
							<p className="text-sm text-slate-600">Removes the agent profile. Their user account stays and becomes a customer account.</p>
							<Button
								variant="secondary"
								className="mt-4 text-rose-700 hover:bg-rose-50"
								fullWidth
								onClick={() => {
									setSheetError("");
									setDeleting(true);
								}}
							>
								<Trash2 className="h-4 w-4" aria-hidden /> Remove agent profile
							</Button>
						</Panel>
					</div>
				</div>
			</div>

			{confirm && (
				<SheetFrame title={confirm.title} subtitle={`${title} · ${a.agent_code}`} onClose={() => !busy && setConfirm(null)}>
					<div className="space-y-4">
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<dl className="rounded-2xl bg-slate-50 px-4">
							{changeLines(confirm.change).map((c) => (
								<Row key={c.label} label={c.label}>
									<span className="text-slate-500 line-through decoration-slate-300">{c.from}</span> → {c.to}
								</Row>
							))}
						</dl>
						<p className="text-sm text-slate-600">
							{confirm.change.verification_status === "failed"
								? "They'll be told their ID couldn't be verified and won't be able to handle shipments."
								: confirm.change.status === "active"
									? "They'll be able to receive and handle shipments straight away."
									: confirm.change.status === "suspended" || confirm.change.status === "deactivated"
										? "They won't be able to handle shipments until you reactivate them."
										: "The agent's profile will be updated."}
							{a.user?.email ? ` An email goes to ${a.user.email}.` : ""}
						</p>
						<div className="grid gap-2 sm:grid-cols-2">
							<Button variant="secondary" size="lg" fullWidth onClick={() => setConfirm(null)} disabled={busy}>
								Cancel
							</Button>
							<Button variant={confirm.change.verification_status === "failed" ? "danger" : "primary"} size="lg" fullWidth loading={busy} onClick={save}>
								{busy ? "Saving…" : confirm.action}
							</Button>
						</div>
					</div>
				</SheetFrame>
			)}

			{deleting && (
				<SheetFrame title="Remove agent profile?" subtitle={`${title} · ${a.agent_code}`} onClose={() => !busy && setDeleting(false)}>
					<div className="space-y-4">
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<p className="text-sm text-slate-600">
							<strong className="text-slate-900">{title}</strong> will stop being an agent and can no longer handle shipments. Their user account stays — it becomes a customer account, so they can
							still sign in and book shipments.
						</p>
						<p className="text-sm text-slate-500">To pause them for a while, set their account to Suspended instead.</p>
						<div className="grid gap-2 sm:grid-cols-2">
							<Button variant="secondary" size="lg" fullWidth onClick={() => setDeleting(false)} disabled={busy}>
								Keep agent
							</Button>
							<Button variant="danger" size="lg" fullWidth loading={busy} onClick={remove}>
								{busy ? "Removing…" : "Remove profile"}
							</Button>
						</div>
					</div>
				</SheetFrame>
			)}
		</DashboardLayout>
	);
}
