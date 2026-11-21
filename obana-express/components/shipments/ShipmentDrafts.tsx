"use client";

/**
 * Bookings somebody started and did not finish.
 *
 * Drafts have been saved for a while, but the only way to see one was the row
 * of chips at the top of the booking form, which showed six and no more. A
 * draft past the sixth existed, counted against the cap, and could not be
 * reached — so the feature quietly lost work it had been built to keep.
 *
 * This is the list: all of them, newest first, with what each one actually
 * holds, and the two things anybody wants to do with one.
 *
 * It changes nothing about how a booking is made. Continuing opens the
 * ordinary form with ?draft=<id>, which fills the boxes and prices the
 * shipment from scratch, exactly as picking the chip always did — a draft
 * carries a form, never a price.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Plus, Search, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { EmptyState, ErrorState, ListSkeleton, PageHeader, Panel } from "@/components/dashboard/kit";
import ConfirmDelete from "@/components/dashboard/ConfirmDelete";
import { Button } from "@/components/ui";
import { apiClient } from "@/lib/api";
import { useRemote } from "@/lib/useRemote";

type DraftForm = {
	pickup_address?: { city?: string; state?: string; country?: string };
	delivery_address?: { city?: string; state?: string; country?: string; name?: string };
	items?: unknown[];
	transport_mode?: string;
	service_level?: string;
};

type Draft = {
	id: number;
	label: string | null;
	form: DraftForm | null;
	created_at: string;
	updated_at: string;
};

const place = (a?: { city?: string; state?: string; country?: string }) => {
	const where = (a?.city || a?.state || "").trim();
	const country = (a?.country || "").trim();
	return where && country ? `${where}, ${country}` : where || country;
};

/** "3 items · Air · Standard" — whatever of it the half-filled form has. */
const describe = (form: DraftForm | null) => {
	const bits: string[] = [];
	const items = Array.isArray(form?.items) ? form.items.length : 0;
	if (items) bits.push(`${items} item${items === 1 ? "" : "s"}`);
	if (form?.transport_mode) bits.push(form.transport_mode.replace(/^./, (c) => c.toUpperCase()));
	if (form?.service_level) bits.push(form.service_level);
	return bits.join(" · ");
};

/* "2 hours ago" beats a timestamp here: the only question anybody asks of a
   draft list is which one they were last working on. */
const when = (iso: string) => {
	const then = new Date(iso).getTime();
	if (!Number.isFinite(then)) return "";
	const mins = Math.round((Date.now() - then) / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
	return new Date(iso).toLocaleDateString();
};

export default function ShipmentDrafts({ role }: { role: "admin" | "customer" }) {
	const base = `/dashboard/${role}/shipments`;
	const router = useRouter();
	const draftsQ = useRemote<Draft[]>("shipment-drafts", async () => {
		const res = await apiClient.listShipmentDrafts();
		return (res?.data ?? []) as Draft[];
	});

	const [query, setQuery] = useState("");
	const [removing, setRemoving] = useState<Draft | null>(null);
	const [deleted, setDeleted] = useState<number[]>([]);
	const [busy, setBusy] = useState(false);

	const all = (draftsQ.data ?? []).filter((d) => !deleted.includes(d.id));
	const needle = query.trim().toLowerCase();
	const drafts = needle
		? all.filter((d) => `${d.label ?? ""} ${place(d.form?.pickup_address)} ${place(d.form?.delivery_address)} ${d.form?.delivery_address?.name ?? ""}`.toLowerCase().includes(needle))
		: all;

	const remove = async (draft: Draft) => {
		/* A second press while the first is in flight would delete nothing and
		   report a 404, because the row is already gone. */
		if (busy) return;
		setBusy(true);
		try {
			await apiClient.deleteShipmentDraft(draft.id);
			/* Taken off the list here rather than refetched: the row is gone
			   and a round trip would only make it flicker. */
			setDeleted((prev) => [...prev, draft.id]);
			setRemoving(null);
		} finally {
			setBusy(false);
		}
	};

	return (
		<DashboardLayout role={role}>
			<div className="space-y-5">
				<PageHeader
					title="Draft shipments"
					description="Bookings you started and have not finished. Continuing one fills the form and prices it fresh."
					actions={
						<Link href={`${base}/new`}>
							<Button type="button">
								<Plus className="h-4 w-4" aria-hidden /> New shipment
							</Button>
						</Link>
					}
				/>

				{all.length > 0 && (
					<div className="relative max-w-sm">
						<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-slate-400" aria-hidden />
						<input
							type="search"
							value={query}
							onChange={(ev) => setQuery(ev.target.value)}
							placeholder="Search by name or city"
							aria-label="Search drafts"
							className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
						/>
					</div>
				)}

				<Panel flush>
					{draftsQ.loading ? (
						<ListSkeleton rows={4} />
					) : draftsQ.error ? (
						<ErrorState text={draftsQ.error} onRetry={draftsQ.retry} />
					) : !all.length ? (
						<EmptyState
							icon={FileText}
							title="No drafts yet"
							text="Start a booking and press Save for later, and it will be here to pick up."
							action={
								<Link href={`${base}/new`}>
									<Button type="button">Start a shipment</Button>
								</Link>
							}
						/>
					) : !drafts.length ? (
						<EmptyState icon={Search} title="Nothing matches that" text="Try a different name or city." />
					) : (
						<ul className="divide-y divide-slate-100">
							{drafts.map((d) => {
								const from = place(d.form?.pickup_address);
								const to = place(d.form?.delivery_address);
								const detail = describe(d.form);
								return (
									<li key={d.id} className="flex items-center gap-4 px-4 py-4 sm:px-5">
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
											<FileText className="h-5 w-5" aria-hidden />
										</span>
										<div className="min-w-0 flex-1">
											<p className="truncate font-semibold text-slate-900">{d.label || "Untitled draft"}</p>
											<p className="truncate text-slate-500 text-sm">
												{from && to ? `${from} → ${to}` : from || to || "Nothing filled in yet"}
												{detail && <span className="text-slate-400"> · {detail}</span>}
											</p>
											{d.form?.delivery_address?.name && <p className="truncate text-slate-400 text-xs">For {d.form.delivery_address.name}</p>}
										</div>
										<span className="hidden shrink-0 text-slate-400 text-xs sm:block">Saved {when(d.updated_at)}</span>
										<div className="flex shrink-0 items-center gap-1">
											<button
												type="button"
												onClick={() => router.push(`${base}/new?draft=${d.id}`)}
												className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 font-medium text-slate-800 text-sm hover:bg-slate-50"
											>
												Continue <ArrowRight className="h-4 w-4" aria-hidden />
											</button>
											<button
												type="button"
												onClick={() => setRemoving(d)}
												aria-label={`Delete ${d.label || "untitled draft"}`}
												className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
											>
												<Trash2 className="h-4 w-4" aria-hidden />
											</button>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</Panel>
			</div>

			{removing && (
				<ConfirmDelete
					what={removing.label || "Untitled draft"}
					detail="A draft, not a booking."
					consequence="Nothing that has already been booked is affected."
					onCancel={() => setRemoving(null)}
					onConfirm={() => remove(removing)}
				/>
			)}
		</DashboardLayout>
	);
}
