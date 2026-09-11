"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, MapPin, Package, Search, Truck, X } from "lucide-react";
import { API_BASE_URL } from "@/lib/site";

type Tab = "track" | "send" | "business";

type TrackingEvent = { id: number | string; status: string; createdAt: string; description?: string; location?: string };
type Address = { city?: string; state?: string };
type Shipment = {
	shipment_reference: string;
	status: string;
	pickup_address?: Address;
	delivery_address?: Address;
	service_level?: string;
	transport_mode?: string;
	total_items?: number;
	tracking_events?: TrackingEvent[];
};

type TrackState = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "found"; shipment: Shipment };

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
const when = (iso: string) =>
	new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const TABS: { key: Tab; label: string; short: string; icon: typeof Search }[] = [
	{ key: "track", label: "Track", short: "Track", icon: Search },
	{ key: "send", label: "Send a package", short: "Send", icon: Package },
	{ key: "business", label: "For business", short: "Business", icon: Building2 },
];

/** Looks up a shipment on the public tracking endpoint (works for guests and emailed / WhatsApp links). */
async function fetchShipment(id: string): Promise<TrackState> {
	try {
		const res = await fetch(`${API_BASE_URL}/shipments/public/track/${encodeURIComponent(id)}`);
		const body = await res.json().catch(() => ({}));
		if (res.ok && body?.success && body.data) return { kind: "found", shipment: body.data };
		return {
			kind: "error",
			message: res.status === 404 ? "We couldn't find that tracking number. Check it and try again." : body?.message || "Something went wrong. Please try again.",
		};
	} catch {
		return { kind: "error", message: "We can't reach Obana right now. Check your connection and try again." };
	}
}

/** The hero's working card: track a shipment, start a quote, or jump into the business path. */
export function ActionCard() {
	const router = useRouter();
	const [tab, setTab] = useState<Tab>("track");
	const [reference, setReference] = useState("");
	const [track, setTrack] = useState<TrackState>({ kind: "idle" });
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [weight, setWeight] = useState("");

	const runTrack = async (raw: string) => {
		const id = raw.trim();
		if (!id) return;
		setTab("track");
		setTrack({ kind: "loading" });
		setTrack(await fetchShipment(id));
	};

	// Links in emails and WhatsApp messages arrive as /?track=OBN-… — show the result as soon as it's back.
	useEffect(() => {
		const fromLink = new URLSearchParams(window.location.search).get("track")?.trim();
		if (!fromLink) return;
		let cancelled = false;
		fetchShipment(fromLink).then((result) => {
			if (cancelled) return;
			setReference(fromLink);
			setTrack(result);
			document.getElementById("track")?.scrollIntoView({ block: "center" });
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const startQuote = (e: React.FormEvent) => {
		e.preventDefault();
		const params = new URLSearchParams();
		if (from.trim()) params.set("from", from.trim());
		if (to.trim()) params.set("to", to.trim());
		if (weight.trim()) params.set("kg", weight.trim());
		router.push(`/route-match${params.size ? `?${params}` : ""}`);
	};

	const field =
		"h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink placeholder:text-slate-400 outline-none transition focus:border-navy focus:ring-4 focus:ring-navy/10";

	return (
		<div id="track" className="w-full rounded-3xl border border-line bg-white p-2 shadow-lift">
			<div role="tablist" aria-label="What would you like to do?" className="grid grid-cols-3 gap-1 rounded-2xl bg-canvas p-1">
				{TABS.map(({ key, label, short, icon: Icon }) => (
					<button
						key={key}
						type="button"
						role="tab"
						id={`tab-${key}`}
						aria-selected={tab === key}
						aria-controls={`panel-${key}`}
						aria-label={label}
						onClick={() => setTab(key)}
						className={`flex h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold transition sm:text-sm ${
							tab === key ? "bg-white text-navy shadow-card" : "text-muted hover:text-ink"
						}`}
					>
						<Icon className="hidden h-4 w-4 sm:block" aria-hidden />
						<span className="sm:hidden">{short}</span>
						<span className="hidden sm:inline">{label}</span>
					</button>
				))}
			</div>

			<div className="p-4 sm:p-5">
				{tab === "track" && (
					<div role="tabpanel" id="panel-track" aria-labelledby="tab-track">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								runTrack(reference);
							}}
							className="flex flex-col gap-3 sm:flex-row"
						>
							<label htmlFor="tracking-number" className="sr-only">
								Tracking number
							</label>
							<input
								id="tracking-number"
								value={reference}
								onChange={(e) => setReference(e.target.value)}
								placeholder="Tracking number, e.g. OBN-20260430-IYU2FXS7"
								autoComplete="off"
								spellCheck={false}
								className={`${field} font-mono text-[15px]`}
							/>
							<button
								type="submit"
								disabled={track.kind === "loading" || !reference.trim()}
								className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-navy px-6 text-base font-semibold text-white transition hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{track.kind === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
								Track
							</button>
						</form>

						<div aria-live="polite">
							{track.kind === "idle" && (
								<p className="mt-3 text-sm text-muted">Find your tracking number in your confirmation email or WhatsApp message.</p>
							)}
							{track.kind === "error" && (
								<p role="alert" className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
									{track.message}
								</p>
							)}
							{track.kind === "found" && (
								<TrackingResult
									shipment={track.shipment}
									onClear={() => {
										setTrack({ kind: "idle" });
										setReference("");
									}}
								/>
							)}
						</div>
					</div>
				)}

				{tab === "send" && (
					<form role="tabpanel" id="panel-send" aria-labelledby="tab-send" onSubmit={startQuote} className="space-y-3">
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="from-city" className="mb-1.5 block text-sm font-medium text-ink">
									From
								</label>
								<input id="from-city" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="City, e.g. Lagos" className={field} />
							</div>
							<div>
								<label htmlFor="to-city" className="mb-1.5 block text-sm font-medium text-ink">
									To
								</label>
								<input id="to-city" value={to} onChange={(e) => setTo(e.target.value)} placeholder="City, e.g. Abuja" className={field} />
							</div>
						</div>
						<div>
							<label htmlFor="weight" className="mb-1.5 block text-sm font-medium text-ink">
								Weight <span className="font-normal text-muted">(kg, optional)</span>
							</label>
							<input id="weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 5" className={field} />
						</div>
						<button type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy px-6 text-base font-semibold text-white transition hover:bg-navy-700">
							See price & delivery time
							<ArrowRight className="h-4 w-4" />
						</button>
						<p className="text-center text-xs text-muted">You see the full price in naira before you book — no hidden fees.</p>
					</form>
				)}

				{tab === "business" && (
					<div role="tabpanel" id="panel-business" aria-labelledby="tab-business">
						<ul className="space-y-3 text-sm text-ink">
							{[
								"Book single, bulk and recurring shipments from one dashboard",
								"Connect your store or platform with our REST API",
								"Your customers get tracking links plus email and WhatsApp updates",
							].map((item) => (
								<li key={item} className="flex gap-3">
									<span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint text-navy">
										<Truck className="h-3 w-3" aria-hidden />
									</span>
									{item}
								</li>
							))}
						</ul>
						<div className="mt-5 grid gap-2 sm:grid-cols-2">
							<Link href="/onboarding/business" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-navy px-5 text-sm font-semibold text-white transition hover:bg-navy-700">
								Get an API key
								<ArrowRight className="h-4 w-4" />
							</Link>
							<Link href="/auth/signup" className="inline-flex h-12 items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-ink transition hover:bg-canvas">
								Open a business account
							</Link>
						</div>
						<Link href="/docs" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy hover:underline">
							Read the API docs <ArrowRight className="h-3.5 w-3.5" />
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}

function TrackingResult({ shipment, onClear }: { shipment: Shipment; onClear: () => void }) {
	const events = [...(shipment.tracking_events ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const status = shipment.status?.toLowerCase() ?? "";
	return (
		<div className="mt-4 rounded-2xl border border-line bg-canvas/60 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-medium uppercase tracking-wider text-muted">Tracking number</p>
					<p className="truncate font-mono text-sm font-semibold text-ink">{shipment.shipment_reference}</p>
				</div>
				<span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700 ring-slate-500/20"}`}>
					{pretty(shipment.status)}
				</span>
			</div>

			<div className="mt-4 flex items-center gap-2 text-sm">
				<MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
				<span className="font-medium text-ink">{place(shipment.pickup_address)}</span>
				<ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
				<span className="font-medium text-ink">{place(shipment.delivery_address)}</span>
			</div>

			<div className="mt-3 flex flex-wrap gap-2 text-xs">
				{[shipment.service_level, shipment.transport_mode && pretty(shipment.transport_mode), shipment.total_items != null && `${shipment.total_items} item${shipment.total_items === 1 ? "" : "s"}`]
					.filter(Boolean)
					.map((chip) => (
						<span key={String(chip)} className="rounded-full bg-white px-2.5 py-1 font-medium text-muted ring-1 ring-inset ring-line">
							{chip}
						</span>
					))}
			</div>

			{events.length > 0 && (
				<ol className="mt-4 max-h-56 overflow-y-auto pr-1">
					{events.map((ev, i) => (
						<li key={ev.id} className="relative pb-4 pl-7 last:pb-0">
							{/* Dots and connector sit inside the scroll area, so nothing gets clipped. */}
							{i < events.length - 1 && <span className="absolute bottom-0 left-[9px] top-5 w-0.5 bg-line" aria-hidden />}
							<span className={`absolute left-1 top-1 h-3 w-3 rounded-full ${i === 0 ? "bg-navy ring-4 ring-navy/15" : "bg-slate-300"}`} aria-hidden />
							<p className={`text-sm font-semibold ${i === 0 ? "text-ink" : "text-muted"}`}>{pretty(ev.status)}</p>
							<p className="text-xs text-muted">
								{when(ev.createdAt)}
								{ev.location ? ` · ${ev.location}` : ""}
							</p>
							{ev.description && <p className="mt-0.5 text-sm text-muted">{ev.description}</p>}
						</li>
					))}
				</ol>
			)}

			<button type="button" onClick={onClear} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-navy hover:underline">
				<X className="h-3.5 w-3.5" /> Track another shipment
			</button>
		</div>
	);
}
