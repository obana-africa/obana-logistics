"use client";

import React, { useState } from "react";
import { Search, Users, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Pager, Panel, ToneBadge } from "@/components/dashboard/kit";
import { apiClient } from "@/lib/api";
import { formatDate, type Tone } from "@/lib/shipments";
import { useRemote } from "@/lib/useRemote";
import { usePaged } from "@/lib/usePaged";

// Shape of GET /users (userController.getUsers): user columns with every user attribute flattened on top
// (first_name, last_name, role …). Older payloads may nest them under `attributes`.
interface AdminUser {
	id: number;
	email?: string | null;
	phone?: string | null;
	createdAt?: string;
	role?: string;
	account_type?: string;
	first_name?: string;
	last_name?: string;
	attributes?: { first_name?: string; last_name?: string } | null;
}

const ROLES: Record<string, { label: string; tone: Tone }> = {
	customer: { label: "Customer", tone: "neutral" },
	driver: { label: "Driver", tone: "info" },
	agent: { label: "Agent", tone: "progress" },
	admin: { label: "Admin", tone: "warning" },
};
const FILTERS = [
	{ value: "", label: "All" },
	{ value: "customer", label: "Customers" },
	{ value: "driver", label: "Drivers" },
	{ value: "agent", label: "Agents" },
	{ value: "admin", label: "Admins" },
];

const roleOf = (u: AdminUser) => String(u.account_type ?? u.role ?? "customer").toLowerCase();
const roleMeta = (r: string) => ROLES[r] ?? { label: r.replace(/_/g, " "), tone: "neutral" as Tone };
const nameOf = (u: AdminUser) =>
	[u.first_name ?? u.attributes?.first_name, u.last_name ?? u.attributes?.last_name]
		.filter((x) => typeof x === "string" && x.trim())
		.join(" ");

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

const CREATABLE = [
	{ value: "customer", label: "Customer", hint: "Books and tracks their own shipments." },
	{ value: "agent", label: "Agent", hint: "Books and manages shipments for customers." },
	{ value: "driver", label: "Driver", hint: "Delivers the shipments assigned to them." },
	{ value: "admin", label: "Admin", hint: "Full access, including creating other accounts." },
];

const FIELD =
	"w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1B3B5F]";

/**
 * Creates an account for someone who cannot sign up themselves.
 *
 * The password comes back once and is stored hashed, so it stays on screen
 * until dismissed — there is no second chance to read it.
 */
function CreateUserPanel({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
	const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "customer" });
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState("");
	const [created, setCreated] = useState<{ email: string; password?: string } | null>(null);
	const [copied, setCopied] = useState(false);

	const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		setForm((f) => ({ ...f, [key]: e.target.value }));
		setFailure("");
	};

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.email.trim()) {
			setFailure("An email address is required — they sign in with it.");
			return;
		}

		setBusy(true);
		setFailure("");
		try {
			const res = await apiClient.createUserAsAdmin({
				email: form.email.trim(),
				phone: form.phone.trim() || undefined,
				first_name: form.first_name.trim() || undefined,
				last_name: form.last_name.trim() || undefined,
				role: form.role,
			});
			const body = (res?.data ?? {}) as { email?: string; temporary_password?: string };
			setCreated({ email: body.email ?? form.email.trim(), password: body.temporary_password });
			onCreated();
		} catch (err: unknown) {
			const e2 = err as { response?: { data?: { message?: string } }; message?: string };
			setFailure(e2?.response?.data?.message ?? e2?.message ?? "Could not create that account.");
		} finally {
			setBusy(false);
		}
	};

	if (created) {
		return (
			<Panel>
				<div className="p-5">
					<h2 className="text-lg font-semibold text-slate-900">Account created</h2>
					<p className="mt-1 text-sm text-slate-600">{created.email} can sign in now.</p>

					{created.password && (
						<div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
								Temporary password — shown once
							</p>
							<p className="mt-2 font-mono text-lg font-bold tracking-wide text-slate-900">
								{created.password}
							</p>
							<button
								type="button"
								onClick={() => {
									navigator.clipboard?.writeText(`${created.email} / ${created.password}`);
									setCopied(true);
								}}
								className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900"
							>
								{copied ? "Copied" : "Copy email and password"}
							</button>
							<p className="mt-2 text-xs leading-relaxed text-amber-800">
								Give this to them and ask them to change it after signing in. It cannot be
								shown again — if it is lost, they use Forgot password.
							</p>
						</div>
					)}

					<button
						type="button"
						onClick={onClose}
						className="mt-4 rounded-lg bg-[#1B3B5F] px-4 py-2 text-sm font-semibold text-white"
					>
						Done
					</button>
				</div>
			</Panel>
		);
	}

	return (
		<Panel>
			<form onSubmit={submit} className="p-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold text-slate-900">New account</h2>
						<p className="mt-1 text-sm text-slate-600">
							They sign in with the email below. A password is generated and shown once.
						</p>
					</div>
					<button type="button" onClick={onClose} aria-label="Close" className="text-slate-400">
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					<label className="block">
						<span className="text-xs font-semibold text-slate-700">First name</span>
						<input value={form.first_name} onChange={set("first_name")} className={`mt-1 ${FIELD}`} />
					</label>
					<label className="block">
						<span className="text-xs font-semibold text-slate-700">Last name</span>
						<input value={form.last_name} onChange={set("last_name")} className={`mt-1 ${FIELD}`} />
					</label>
					<label className="block sm:col-span-2">
						<span className="text-xs font-semibold text-slate-700">Email</span>
						<input
							type="email"
							value={form.email}
							onChange={set("email")}
							placeholder="they.sign.in@with.this"
							className={`mt-1 ${FIELD}`}
						/>
					</label>
					<label className="block">
						<span className="text-xs font-semibold text-slate-700">Phone</span>
						<input value={form.phone} onChange={set("phone")} className={`mt-1 ${FIELD}`} />
					</label>
					<label className="block">
						<span className="text-xs font-semibold text-slate-700">Role</span>
						<select value={form.role} onChange={set("role")} className={`mt-1 ${FIELD}`}>
							{CREATABLE.map((r) => (
								<option key={r.value} value={r.value}>
									{r.label}
								</option>
							))}
						</select>
					</label>
				</div>

				<p className="mt-2 text-xs text-slate-500">
					{CREATABLE.find((r) => r.value === form.role)?.hint}
				</p>

				{failure && <p className="mt-3 text-sm text-red-600">{failure}</p>}

				<div className="mt-5 flex gap-2">
					<button
						type="submit"
						disabled={busy}
						className="rounded-lg bg-[#1B3B5F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
					>
						{busy ? "Creating…" : "Create account"}
					</button>
					<button
						type="button"
						onClick={onClose}
						disabled={busy}
						className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
					>
						Cancel
					</button>
				</div>
			</form>
		</Panel>
	);
}

export default function AdminUsersPage() {
	const [creating, setCreating] = useState(false);

	const { data, loading, error, retry } = useRemote<AdminUser[]>("admin-users", async () => {
		const response = await apiClient.getAllUsers();
		return (response?.data ?? []) as AdminUser[];
	});

	const [query, setQuery] = useState("");
	const [role, setRole] = useState("");

	const users = data ?? [];
	const q = query.trim().toLowerCase();
	const qDigits = q.replace(/\D/g, "");
	const visible = users.filter((u) => {
		if (role && roleOf(u) !== role) return false;
		if (!q) return true;
		const hay = [nameOf(u), u.email, u.phone].join(" ").toLowerCase();
		return hay.includes(q) || (qDigits.length >= 3 && (u.phone ?? "").replace(/\D/g, "").includes(qDigits));
	});
	const filtered = Boolean(q || role);
	const paged = usePaged(visible, 20, JSON.stringify([q, role]));
	const count = (r: string) => (r ? users.filter((u) => roleOf(u) === r).length : users.length);

	const clearFilters = () => {
		setQuery("");
		setRole("");
	};

	return (
		<DashboardLayout role="admin">
			<div className="space-y-5">
				<PageHeader
					title="Users"
					description="Everyone with an Obana account — customers, drivers, agents and admins."
					actions={
						!creating && (
							<button
								type="button"
								onClick={() => setCreating(true)}
								className="rounded-lg bg-[#1B3B5F] px-4 py-2 text-sm font-semibold text-white"
							>
								Create account
							</button>
						)
					}
				/>

				{creating && (
					<CreateUserPanel onClose={() => setCreating(false)} onCreated={retry} />
				)}

				<div className="space-y-3">
					<label className="relative block">
						<span className="sr-only">Search users</span>
						<Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
						<input
							type="search"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Name, email or phone"
							className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#1B3B5F] focus:ring-4 focus:ring-[#1B3B5F]/10"
						/>
					</label>
					<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by role">
						{FILTERS.map((o) => (
							<button
								key={o.value || "all"}
								type="button"
								aria-pressed={role === o.value}
								onClick={() => setRole(o.value)}
								className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${
									role === o.value ? "bg-[#1B3B5F] text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
								}`}
							>
								{o.label}
								{!loading && <span className={`text-xs tabular-nums ${role === o.value ? "text-white/70" : "text-slate-400"}`}>{count(o.value)}</span>}
							</button>
						))}
					</div>
				</div>

				<Panel flush>
					{loading ? (
						<ListSkeleton rows={6} />
					) : error ? (
						<ErrorState text={error} onRetry={retry} />
					) : !visible.length ? (
						<EmptyState
							icon={Users}
							title={filtered ? "No users match" : "No users yet"}
							text={filtered ? "Try another name, email, phone or role." : "People who sign up to Obana appear here."}
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
								{paged.items.map((u) => {
									const name = nameOf(u);
									const r = roleMeta(roleOf(u));
									return (
										<li key={u.id} className="flex gap-3 px-4 py-4">
											<Avatar label={name || u.email || "?"} />
											<div className="min-w-0 flex-1">
												<div className="flex items-start justify-between gap-2">
													<p className="min-w-0 truncate font-semibold text-slate-900">{name || u.email || "No name"}</p>
													<ToneBadge tone={r.tone}>{r.label}</ToneBadge>
												</div>
												{name && u.email && <p className="truncate text-sm text-slate-600">{u.email}</p>}
												<p className="mt-0.5 truncate text-sm text-slate-500">
													{[showPhone(u.phone), `Joined ${formatDate(u.createdAt)}`].filter(Boolean).join(" · ")}
												</p>
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
											<th className="px-5 py-3">User</th>
											<th className="px-5 py-3">Phone</th>
											<th className="px-5 py-3">Role</th>
											<th className="px-5 py-3 text-right">Joined</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{paged.items.map((u) => {
											const name = nameOf(u);
											const r = roleMeta(roleOf(u));
											return (
												<tr key={u.id} className="hover:bg-slate-50">
													<td className="max-w-[24rem] px-5 py-3">
														<div className="flex items-center gap-3">
															<Avatar label={name || u.email || "?"} />
															<div className="min-w-0">
																<p className="truncate font-semibold text-slate-900">{name || u.email || "No name"}</p>
																{name && u.email && <p className="truncate text-xs text-slate-500">{u.email}</p>}
															</div>
														</div>
													</td>
													<td className="whitespace-nowrap px-5 py-3 text-slate-700">{showPhone(u.phone) || "—"}</td>
													<td className="px-5 py-3">
														<ToneBadge tone={r.tone}>{r.label}</ToneBadge>
													</td>
													<td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">{formatDate(u.createdAt)}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</>
					)}
					<Pager page={paged.page} pages={paged.pages} total={paged.total} noun="users" onPage={paged.setPage} />
				</Panel>

				{!loading && !error && users.length > 0 && (
					<p className="text-center text-sm text-slate-500">
						Showing {visible.length.toLocaleString()} of {users.length.toLocaleString()} users
					</p>
				)}
			</div>
		</DashboardLayout>
	);
}
