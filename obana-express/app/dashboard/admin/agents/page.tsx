"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, ShieldAlert, ShieldCheck, Trash2, UserCheck, Users, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel, StatCard, ToneBadge } from "@/components/dashboard/kit";
import { Alert, Button } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { formatDate, type Tone } from "@/lib/shipments";
import { errorMessage, useRemote } from "@/lib/useRemote";

// Shape of GET /agents (agentController.listAgents — names are merged in from user attributes).
export interface Agent {
	id: number;
	agent_code: string;
	verification_status: "pending" | "verified" | "failed";
	status: "pending_verification" | "active" | "suspended" | "deactivated";
	createdAt: string;
	city?: string | null;
	state?: string | null;
	user: {
		id: number;
		email: string;
		phone: string;
		first_name: string;
		last_name: string;
	};
}

// Mirrors the ENUMs in Backend/src/models/agentModel.js.
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

const VERIFY_FILTERS = [
	{ value: "", label: "All" },
	{ value: "pending", label: "Needs review" },
	{ value: "verified", label: "Verified" },
	{ value: "failed", label: "Rejected" },
];
const ACCOUNT_FILTERS = [
	{ value: "", label: "Any status" },
	{ value: "pending_verification", label: "Awaiting verification" },
	{ value: "active", label: "Active" },
	{ value: "suspended", label: "Suspended" },
	{ value: "deactivated", label: "Deactivated" },
];

const nameOf = (a: Agent) => [a.user?.first_name, a.user?.last_name].filter(Boolean).join(" ");

function showPhone(p?: string | null) {
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

function Chips({ label, options, value, onChange, counts }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; counts?: (v: string) => number }) {
	return (
		<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={label}>
			{options.map((o) => (
				<button
					key={o.value || "all"}
					type="button"
					aria-pressed={value === o.value}
					onClick={() => onChange(o.value)}
					className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${
						value === o.value ? "bg-[#1B3B5F] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
					}`}
				>
					{o.label}
					{counts && <span className={`text-xs tabular-nums ${value === o.value ? "text-white/70" : "text-slate-400"}`}>{counts(o.value)}</span>}
				</button>
			))}
		</div>
	);
}

export default function ManageAgentsPage() {
	const { data, loading, error, retry } = useRemote<Agent[]>("admin-agents", async () => {
		const response = await apiClient.listAgents();
		if (response.status !== "success") throw new Error(response.message || "Failed to fetch agents.");
		return (response.data ?? []) as Agent[];
	});

	const [query, setQuery] = useState("");
	const [verification, setVerification] = useState("");
	const [account, setAccount] = useState("");
	const [target, setTarget] = useState<Agent | null>(null);
	const [busy, setBusy] = useState(false);
	const [sheetError, setSheetError] = useState("");
	const [notice, setNotice] = useState("");

	const agents = data ?? [];
	const needsReview = agents.filter((a) => a.verification_status === "pending").length;
	const q = query.trim().toLowerCase();
	const qDigits = q.replace(/\D/g, "");
	// Agents waiting for ID review always come first; otherwise keep the API's newest-first order.
	const visible = agents
		.filter((a) => {
			if (verification && a.verification_status !== verification) return false;
			if (account && a.status !== account) return false;
			if (!q) return true;
			const hay = [nameOf(a), a.agent_code, a.user?.email, a.user?.phone, a.city, a.state].join(" ").toLowerCase();
			return hay.includes(q) || (qDigits.length >= 3 && (a.user?.phone ?? "").replace(/\D/g, "").includes(qDigits));
		})
		.map((a, i) => ({ a, i }))
		.sort((x, y) => Number(y.a.verification_status === "pending") - Number(x.a.verification_status === "pending") || x.i - y.i)
		.map(({ a }) => a);
	const filtered = Boolean(q || verification || account);
	const verifyCount = (v: string) => (v ? agents.filter((a) => a.verification_status === v).length : agents.length);

	const clearFilters = () => {
		setQuery("");
		setVerification("");
		setAccount("");
	};

	const openDelete = (a: Agent) => {
		setTarget(a);
		setSheetError("");
	};

	const handleDelete = async () => {
		if (!target) return;
		setBusy(true);
		setSheetError("");
		try {
			await apiClient.deleteAgent(target.id.toString());
			setNotice(`${nameOf(target) || target.agent_code}'s agent profile was removed. Their account stays, now as a customer.`);
			setTarget(null);
			retry();
		} catch (err) {
			setSheetError(errorMessage(err, "Failed to delete agent. Please try again."));
		} finally {
			setBusy(false);
		}
	};

	const badges = (a: Agent) => {
		const v = meta(VERIFICATION, a.verification_status);
		const s = meta(ACCOUNT, a.status);
		return (
			<>
				<ToneBadge tone={v.tone}>{v.label}</ToneBadge>
				{a.status !== "pending_verification" && <ToneBadge tone={s.tone}>{s.label}</ToneBadge>}
			</>
		);
	};

	return (
		<DashboardLayout role="admin">
			<div className="space-y-5">
				<PageHeader title="Agents" description="Review new agents' ID documents and manage who can handle shipments in their area." />

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
						<StatCard label="Total agents" value={agents.length} icon={Users} loading={loading} />
					</div>
					<StatCard label="Needs review" value={needsReview} icon={ShieldAlert} tone="warning" loading={loading} />
					<StatCard label="Active" value={agents.filter((a) => a.status === "active").length} icon={UserCheck} tone="success" loading={loading} />
				</div>

				{!loading && !error && needsReview > 0 && verification !== "pending" && (
					<div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-start gap-3">
							<ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
							<div>
								<p className="font-semibold text-amber-950">
									{needsReview} {needsReview === 1 ? "agent is" : "agents are"} waiting for ID review
								</p>
								<p className="text-sm text-amber-900">They can&apos;t take shipments until you check their ID and approve them.</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								setVerification("pending");
								setAccount("");
							}}
							className="h-10 shrink-0 self-start rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950 sm:self-auto"
						>
							Review now
						</button>
					</div>
				)}

				<div className="space-y-3">
					<label className="relative block">
						<span className="sr-only">Search agents</span>
						<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Name, agent code, email, phone or city"
							className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
						/>
					</label>
					<Chips label="Filter by ID verification" options={VERIFY_FILTERS} value={verification} onChange={setVerification} counts={loading ? undefined : verifyCount} />
					<div className="flex items-center gap-2">
						<label htmlFor="account-filter" className="shrink-0 text-sm font-medium text-slate-600">
							Account
						</label>
						<select
							id="account-filter"
							value={account}
							onChange={(e) => setAccount(e.target.value)}
							className="h-10 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-800 shadow-sm outline-none focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10 sm:text-sm"
						>
							{ACCOUNT_FILTERS.map((o) => (
								<option key={o.value || "any"} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</div>
				</div>

				<Panel flush>
					{loading ? (
						<ListSkeleton rows={5} />
					) : error ? (
						<ErrorState text={error} onRetry={retry} />
					) : !visible.length ? (
						<EmptyState
							icon={ShieldCheck}
							title={filtered ? "No agents match" : "No agents yet"}
							text={filtered ? "Try another name, code or filter." : "People who sign up as agents appear here for you to verify."}
							action={
								filtered ? (
									<button type="button" onClick={clearFilters} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
										<X className="h-4 w-4" aria-hidden /> Clear filters
									</button>
								) : undefined
							}
						/>
					) : (
						<>
							{/* Phones and tablets: cards */}
							<ul className="divide-y divide-slate-100 lg:hidden">
								{visible.map((a) => {
									const name = nameOf(a) || a.user?.email || a.agent_code;
									return (
										<li key={a.id} className={`flex items-stretch ${a.verification_status === "pending" ? "bg-amber-50/40" : ""}`}>
											<Link href={`/dashboard/admin/agents/${a.id}`} className="flex min-w-0 flex-1 gap-3 py-4 pl-4 pr-2 hover:bg-slate-50">
												<Avatar label={name} />
												<div className="min-w-0 flex-1">
													<p className="truncate font-semibold text-slate-900">{name}</p>
													<p className="truncate text-xs text-slate-500">
														<span className="font-mono">{a.agent_code}</span>
														{a.city || a.state ? ` · ${[a.city, a.state].filter(Boolean).join(", ")}` : ""}
													</p>
													<p className="mt-1 truncate text-sm text-slate-600">{[showPhone(a.user?.phone), nameOf(a) ? a.user?.email : ""].filter(Boolean).join(" · ") || "—"}</p>
													<div className="mt-2 flex flex-wrap gap-1.5">{badges(a)}</div>
												</div>
												<ChevronRight className="mt-2 h-5 w-5 shrink-0 text-slate-300" aria-hidden />
											</Link>
											<button
												type="button"
												onClick={() => openDelete(a)}
												aria-label={`Remove ${name}'s agent profile`}
												className="flex w-12 shrink-0 items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-700"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</li>
									);
								})}
							</ul>

							{/* Desktop: table */}
							<div className="hidden overflow-x-auto lg:block">
								<table className="w-full text-left text-sm">
									<thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500">
										<tr>
											<th className="px-5 py-3">Agent</th>
											<th className="px-5 py-3">Contact</th>
											<th className="px-5 py-3">ID check</th>
											<th className="px-5 py-3">Account</th>
											<th className="px-5 py-3">Joined</th>
											<th className="px-5 py-3 text-right">
												<span className="sr-only">Actions</span>
											</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{visible.map((a) => {
											const name = nameOf(a) || a.user?.email || a.agent_code;
											const v = meta(VERIFICATION, a.verification_status);
											const s = meta(ACCOUNT, a.status);
											return (
												<tr key={a.id} className={`group hover:bg-slate-50 ${a.verification_status === "pending" ? "bg-amber-50/40" : ""}`}>
													<td className="px-5 py-3">
														<div className="flex items-center gap-3">
															<Avatar label={name} />
															<div className="min-w-0">
																<Link href={`/dashboard/admin/agents/${a.id}`} className="font-semibold text-slate-900 hover:text-[#1B3B5F] hover:underline">
																	{name}
																</Link>
																<p className="text-xs text-slate-500">
																	<span className="font-mono">{a.agent_code}</span>
																	{a.city || a.state ? ` · ${[a.city, a.state].filter(Boolean).join(", ")}` : ""}
																</p>
															</div>
														</div>
													</td>
													<td className="max-w-[16rem] px-5 py-3">
														<p className="truncate text-slate-800">{a.user?.email || "—"}</p>
														<p className="truncate text-xs text-slate-500">{showPhone(a.user?.phone)}</p>
													</td>
													<td className="px-5 py-3">
														<ToneBadge tone={v.tone}>{v.label}</ToneBadge>
													</td>
													<td className="px-5 py-3">
														<ToneBadge tone={s.tone}>{s.label}</ToneBadge>
													</td>
													<td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(a.createdAt)}</td>
													<td className="px-5 py-3">
														<div className="flex items-center justify-end gap-1">
															<Link
																href={`/dashboard/admin/agents/${a.id}`}
																className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold ${
																	a.verification_status === "pending" ? "bg-[#1B3B5F] text-white hover:bg-[#15304d]" : "text-[#1B3B5F] hover:bg-slate-100"
																}`}
															>
																{a.verification_status === "pending" ? "Review" : "View"}
															</Link>
															<button
																type="button"
																onClick={() => openDelete(a)}
																aria-label={`Remove ${name}'s agent profile`}
																title="Remove agent profile"
																className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700"
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

			{target && (
				<SheetFrame title="Remove agent profile?" subtitle={`${nameOf(target) || target.user?.email || ""} · ${target.agent_code}`} onClose={() => !busy && setTarget(null)}>
					<div className="space-y-4">
						{sheetError && <Alert type="error">{sheetError}</Alert>}
						<p className="text-sm text-slate-600">
							<strong className="text-slate-900">{nameOf(target) || target.agent_code}</strong> will stop being an agent and can no longer handle shipments. Their user account stays — it becomes a
							customer account, so they can still sign in and book shipments.
						</p>
						<p className="text-sm text-slate-500">To pause them for a while, open the agent and set their account to Suspended instead.</p>
						<div className="grid gap-2 sm:grid-cols-2">
							<Button variant="secondary" size="lg" fullWidth onClick={() => setTarget(null)} disabled={busy}>
								Keep agent
							</Button>
							<Button variant="danger" size="lg" fullWidth loading={busy} onClick={handleDelete}>
								{busy ? "Removing…" : "Remove profile"}
							</Button>
						</div>
					</div>
				</SheetFrame>
			)}
		</DashboardLayout>
	);
}
