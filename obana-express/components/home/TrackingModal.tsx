"use client";

import React, { useEffect, useState } from "react";
import { StageRail } from "@/components/shipments/StageRail";
import Link from "next/link";
import { ArrowRight, Loader2, MapPin, Package, Search, X } from "lucide-react";
import { apiClient } from "@/lib/api";
import { statusMeta, whenText as when } from "@/lib/shipments";

type TrackingEvent = { id: number | string; status: string; createdAt: string; description?: string; location?: string };
type Address = { city?: string; state?: string };
export type TrackedShipment = {
	shipment_reference: string;
	status: string;
	/** Package Created / In Transit / Fulfilled — what the sales order says too. */
	display_status?: string;
	/** Where the order came from, when it came from Zoho. */
	source?: { system: string; order_number?: string | null; ordered_at?: string | null } | null;
	/** The three stages, each with the moment it was reached. */
	timeline?: { label: string; at: string | null; done: boolean; current: boolean }[];
	createdAt?: string;
	pickup_address?: Address;
	delivery_address?: Address;
	service_level?: string;
	transport_mode?: string;
	total_items?: number;
	tracking_events?: TrackingEvent[];
};

type Lookup = { kind: "found"; shipment: TrackedShipment } | { kind: "error"; message: string };

const STATUS_STYLE: Record<string, string> = {
	delivered: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
	in_transit: "bg-sky-50 text-sky-700 ring-sky-600/20",
	picked_up: "bg-sky-50 text-sky-700 ring-sky-600/20",
	pending: "bg-amber-50 text-amber-800 ring-amber-600/25",
	cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
	returned: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const pretty = (s = "") => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const place = (a?: Address) => [a?.city, a?.state].filter(Boolean).join(", ") || "—";
/** True on a touch device. Read once, after mount, so SSR and the first paint agree. */
function useIsTouch() {
	const [touch, setTouch] = useState(false);
	useEffect(() => {
		setTouch(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
	}, []);
	return touch;
}


const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** Public tracking lookup — works for guests and for links in emails and WhatsApp messages. */
async function lookup(reference: string): Promise<Lookup> {
	try {
		const res = await apiClient.getPublicShipment(reference);
		if (res.success && res.data) return { kind: "found", shipment: res.data as TrackedShipment };
		return { kind: "error", message: res.message || "We couldn't find that tracking number." };
	} catch (err) {
		const status = (err as { response?: { status?: number; data?: { message?: string } } })?.response;
		if (status?.status === 404) return { kind: "error", message: "We couldn't find that tracking number. Check it and try again." };
		if (!status) return { kind: "error", message: "We can't reach Obana right now. Check your connection and try again." };
		return { kind: "error", message: status.data?.message || "Something went wrong. Please try again." };
	}
}

/**
 * One tracking window for the whole site (header button, hero form, emailed links).
 * A bottom sheet on phones, a centred dialog on larger screens.
 */
export default function TrackingModal({ open, onClose, reference }: { open: boolean; onClose: () => void; reference?: string }) {
	const isTouch = useIsTouch();
	const [input, setInput] = useState(reference ?? "");
	const [asked, setAsked] = useState(reference ?? "");
	const [result, setResult] = useState<{ ref: string; lookup: Lookup } | null>(null);

	// A new reference from the caller (hero form, emailed link) replaces what's in the box.
	const [lastReference, setLastReference] = useState(reference);
	if (reference !== lastReference) {
		setLastReference(reference);
		setInput(reference ?? "");
		setAsked(reference ?? "");
	}

	useEffect(() => {
		if (!open || !asked) return;
		let active = true;
		lookup(asked).then((l) => active && setResult({ ref: asked, lookup: l }));
		return () => {
			active = false;
		};
	}, [open, asked]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = overflow;
		};
	}, [open, onClose]);

	if (!open) return null;

	const loading = Boolean(asked) && result?.ref !== asked;
	const shown = result && result.ref === asked ? result.lookup : null;

	const reset = () => {
		setAsked("");
		setInput("");
		setResult(null);
	};

	return (
		<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="tracking-title"
				className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-8"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" aria-hidden />
				<button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900">
					<X className="h-5 w-5" />
				</button>

				<div className="mb-5 flex items-center gap-3">
					<span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "#1b3b5f" }}>
						<Package className="h-5 w-5 text-white" />
					</span>
					<div>
						<h2 id="tracking-title" className="text-xl font-bold" style={{ color: "#1b3b5f", fontFamily: "var(--font-display)" }}>
							Track your shipment
						</h2>
						<p className="text-sm text-slate-500">Real-time status from pickup to delivery</p>
					</div>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (input.trim()) setAsked(input.trim());
					}}
					className="flex gap-2"
				>
					<label htmlFor="tracking-id" className="sr-only">
						Tracking ID
					</label>
					<input
						id="tracking-id"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="e.g. OBN-20260430-IYU2FXS7"
						autoComplete="off"
						spellCheck={false}
						autoCorrect="off"
						autoCapitalize="characters"
						/* Desktop only. On a phone this throws the keyboard open the
						   moment the modal appears, which covers the field it just
						   focused and scrolls the page out from under the reader. */
						autoFocus={!reference && !isTouch}
						className="h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 font-mono text-base text-slate-900 outline-none focus:border-[#1b3b5f] focus:ring-4 focus:ring-[#1b3b5f]/10"
					/>
					<button
						type="submit"
						disabled={loading || !input.trim()}
						className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl px-5 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
						style={{ background: "#1b3b5f" }}
					>
						{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
						Track
					</button>
				</form>

				<div aria-live="polite">
					{loading && (
						<div className="mt-5 space-y-3" aria-label="Looking up your shipment">
							{[0, 1, 2].map((i) => (
								<div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
							))}
						</div>
					)}
					{shown?.kind === "error" && (
						<p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
							{shown.message}
						</p>
					)}
					{shown?.kind === "found" && <Result shipment={shown.shipment} onReset={reset} />}
					{!asked && (
						<p className="mt-5 text-center text-sm text-slate-500">
							Your tracking ID is in your confirmation email or WhatsApp message. No ID yet?{" "}
							<Link href="/auth/signup" onClick={onClose} className="font-semibold text-[#1b3b5f] hover:underline">
								Create a shipment
							</Link>
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function Result({ shipment, onReset }: { shipment: TrackedShipment; onReset: () => void }) {
	const events = [...(shipment.tracking_events ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const status = shipment.status?.toLowerCase() ?? "";
	return (
		<div className="mt-5 space-y-4">
			<div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Shipment reference</p>
					<p className="truncate font-mono text-sm font-bold" style={{ color: "#1b3b5f" }}>
						{shipment.shipment_reference}
					</p>
					{shipment.source?.order_number && (
						<p className="mt-1 truncate text-xs text-slate-500">
							Order {shipment.source.order_number}
							{shipment.source.ordered_at ? ` · placed ${day(shipment.source.ordered_at)}` : ""}
						</p>
					)}
				</div>
				<span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700 ring-slate-500/20"}`}>
					{shipment.display_status || statusMeta(shipment.status).label}
				</span>
			</div>

			<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
				<MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
				<span className="font-medium text-slate-900">{place(shipment.pickup_address)}</span>
				<ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
				<span className="font-medium text-slate-900">{place(shipment.delivery_address)}</span>
			</div>

			<div className="flex flex-wrap gap-2 text-xs">
				{[shipment.service_level, shipment.transport_mode && pretty(shipment.transport_mode), shipment.total_items != null && `${shipment.total_items} item${shipment.total_items === 1 ? "" : "s"}`]
					.filter(Boolean)
					.map((chip) => (
						<span key={String(chip)} className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
							{chip}
						</span>
					))}
			</div>

			<StageRail stages={shipment.timeline ?? []} />

			{events.length > 0 && (
				<ol className="max-h-60 overflow-y-auto pr-1">
					{events.map((ev, i) => (
						<li key={ev.id} className="relative pb-4 pl-7 last:pb-0">
							{i < events.length - 1 && <span className="absolute bottom-0 left-[9px] top-5 w-0.5 bg-slate-200" aria-hidden />}
							<span className={`absolute left-1 top-1 h-3 w-3 rounded-full ${i === 0 ? "bg-[#1b3b5f] ring-4 ring-[#1b3b5f]/15" : "bg-slate-300"}`} aria-hidden />
							<p className={`text-sm font-semibold ${i === 0 ? "text-slate-900" : "text-slate-500"}`}>{pretty(ev.status)}</p>
							<p className="text-xs text-slate-500">
								{when(ev.createdAt)}
								{ev.location ? ` · ${ev.location}` : ""}
							</p>
							{ev.description && <p className="mt-0.5 text-sm text-slate-600">{ev.description}</p>}
						</li>
					))}
				</ol>
			)}

			<button type="button" onClick={onReset} className="w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200">
				Track another shipment
			</button>
		</div>
	);
}
