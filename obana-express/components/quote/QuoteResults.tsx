"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Clock, Hourglass, Mail, MapPinned, PackageSearch, Plane, RotateCw, Route, Ship, Truck, TriangleAlert, Wallet } from "lucide-react";
import { ToneBadge } from "@/components/dashboard/kit";
import { Skeleton } from "@/components/ui";
import type { PublicQuote, PublicQuoteOption, PublicQuoteRequest } from "@/lib/api";
import { formatMoney } from "@/lib/shipments";
import { SUPPORT_EMAIL } from "@/lib/site";
import { QUOTE_FORM_ID } from "./QuoteForm";
import { bookingPath, formatPrice, withNext } from "./quote";

export type QuoteState =
	| { status: "idle" }
	| { status: "loading"; body: PublicQuoteRequest }
	| { status: "success"; body: PublicQuoteRequest; quote: PublicQuote }
	| { status: "empty"; body: PublicQuoteRequest }
	| { status: "limited"; body: PublicQuoteRequest }
	| { status: "error"; body: PublicQuoteRequest; message: string };

const display = { fontFamily: "var(--font-display)" } as const;

const MODE: Record<string, { label: string; Icon: React.ElementType }> = {
	road: { label: "Road", Icon: Truck },
	air: { label: "Air freight", Icon: Plane },
	sea: { label: "Sea freight", Icon: Ship },
};

const primaryLink =
	"inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1B3B5F] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#15304d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20 sm:text-[15px]";
const retryButton =
	"mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1B3B5F]/20";

const routeText = (b: PublicQuoteRequest) => `${b.origin.city}, ${b.origin.country} → ${b.destination.city}, ${b.destination.country} · ${b.weight_kg} kg`;

function CarrierMark({ option }: { option: PublicQuoteOption }) {
	const [broken, setBroken] = useState(false);
	if (option.provider === "obana") {
		return (
			<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1B3B5F] text-white">
				<Truck className="h-5 w-5" aria-hidden />
			</span>
		);
	}
	if (option.logo_url && !broken) {
		return (
			<span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
				{/* eslint-disable-next-line @next/next/no-img-element -- partner logos can come from any host */}
				<img src={option.logo_url} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
			</span>
		);
	}
	const initials = option.carrier_name
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
	return <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">{initials || "?"}</span>;
}

function OptionCard({
	option,
	quote,
	body,
	signedIn,
}: {
	option: PublicQuoteOption;
	quote: PublicQuote;
	body: PublicQuoteRequest;
	signedIn: boolean;
}) {
	const cheapest = option.id === quote.cheapest_id;
	const fastest = !!quote.fastest_id && option.id === quote.fastest_id;
	const converted = quote.fx !== null && quote.display_currency !== "NGN" && option.display_price !== null;
	const provider = option.provider === "obana" ? "Obana fleet" : option.carrier_name;
	const mode = option.transport_mode ? MODE[option.transport_mode] : undefined;
	const ModeIcon = mode?.Icon ?? Route;
	const details = [mode?.label, option.service_level].filter(Boolean).join(" · ");
	const book = bookingPath(body);
	const charged = formatMoney(option.price, "NGN");
	const shown = converted ? formatPrice(option.display_price as number, quote.display_currency) : charged;

	return (
		<li
			data-option-id={option.id}
			className={
				cheapest
					? "rounded-2xl border-2 border-[#1B3B5F] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5"
					: "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
			}
		>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="flex min-w-0 items-start gap-3">
					<CarrierMark option={option} />
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="font-semibold text-slate-900">{provider}</h3>
							{cheapest && <ToneBadge tone="success">Cheapest</ToneBadge>}
							{fastest && <ToneBadge tone="info">Fastest</ToneBadge>}
						</div>
						<p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
							<span className="inline-flex items-center gap-1.5">
								<ModeIcon className="h-4 w-4 text-slate-400" aria-hidden />
								{details || "Delivery"}
							</span>
							{option.eta && (
								<span className="inline-flex items-center gap-1.5">
									<Clock className="h-4 w-4 text-slate-400" aria-hidden />
									{option.eta}
								</span>
							)}
						</p>
					</div>
				</div>
				<div className="sm:text-right" aria-label={converted ? `About ${shown}, charged ${charged}` : `${charged}`}>
					<p className="text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl" style={display}>
						{converted && <span className="mr-1 text-lg font-semibold text-slate-400">≈</span>}
						{shown}
					</p>
					{converted && <p className="mt-0.5 text-sm text-slate-500">charged {charged}</p>}
				</div>
			</div>

			<div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
				{!signedIn && (
					<Link href={withNext("/auth/login", book)} className="py-2 text-center text-sm font-semibold text-[#1B3B5F] hover:underline">
						I already have an account
					</Link>
				)}
				<Link href={signedIn ? book : withNext("/auth/signup", book)} aria-label={`Book this shipment with ${provider}`} className={primaryLink}>
					Book this shipment
				</Link>
			</div>
		</li>
	);
}

function LoadingCards() {
	return (
		<ul className="space-y-3" aria-hidden>
			{[0, 1, 2].map((i) => (
				<li key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
					<div className="flex items-start gap-3">
						<Skeleton className="h-11 w-11 rounded-xl" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-2/5" />
							<Skeleton className="h-3 w-3/5" />
						</div>
						<Skeleton className="hidden h-8 w-24 sm:block" />
					</div>
					<div className="mt-5 flex justify-end">
						<Skeleton className="h-12 w-full sm:w-44" />
					</div>
				</li>
			))}
		</ul>
	);
}

function IdlePanel() {
	const steps = [
		{ title: "Tell us the route and weight", text: "Pick where it starts and where it's going — any city or town." },
		{ title: "Compare options", text: "See Obana's own fleet and partner carriers side by side, in your currency." },
		{ title: "Book when you're ready", text: "Create an account or sign in, and we'll carry your route and weight over." },
	];
	return (
		<ol className="grid gap-3 sm:grid-cols-3">
			{steps.map((s, i) => (
				<li key={s.title} className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5">
					<span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dcfbf9] text-sm font-bold text-[#1B3B5F]">{i + 1}</span>
					<p className="mt-3 font-semibold text-slate-900">{s.title}</p>
					<p className="mt-1 text-sm text-slate-600">{s.text}</p>
				</li>
			))}
		</ol>
	);
}

function Notice({ tone, icon: Icon, children }: { tone: "amber" | "rose" | "slate"; icon: React.ElementType; children: React.ReactNode }) {
	const box =
		tone === "amber"
			? "border-amber-200 bg-amber-50 text-amber-900"
			: tone === "rose"
				? "border-rose-200 bg-rose-50 text-rose-900"
				: "border-slate-200 bg-white text-slate-700";
	const badge = tone === "amber" ? "bg-amber-100 text-amber-700" : tone === "rose" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600";
	return (
		<div className={`flex flex-col items-center rounded-2xl border px-5 py-10 text-center ${box}`}>
			<span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${badge}`}>
				<Icon className="h-6 w-6" aria-hidden />
			</span>
			{children}
		</div>
	);
}

interface QuoteResultsProps {
	state: QuoteState;
	signedIn: boolean;
	stale: boolean;
	onRetry: () => void;
	headingRef: React.RefObject<HTMLHeadingElement | null>;
}

export function QuoteResults({ state, signedIn, stale, onRetry, headingRef }: QuoteResultsProps) {
	const quote = state.status === "success" ? state.quote : null;
	const options = quote ? [...quote.options].sort((a, b) => a.price - b.price) : [];
	const converted = !!quote && quote.fx !== null && quote.display_currency !== "NGN";
	const heading = {
		idle: "Your prices will appear here",
		loading: "Finding prices…",
		success: `${options.length} ${options.length === 1 ? "option" : "options"} for your shipment`,
		empty: "No routes for this shipment yet",
		limited: "Too many quotes in a row",
		error: "We couldn't get prices",
	}[state.status];
	const validUntil = quote ? new Date(quote.expires_at) : null;

	return (
		<section aria-labelledby="quote-results-heading" aria-busy={state.status === "loading"}>
			<div aria-live="polite">
				<h2 id="quote-results-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none sm:text-2xl" style={display}>
					{heading}
				</h2>
				{state.status !== "idle" && <p className="mt-1 text-sm text-slate-600">{routeText(state.body)}</p>}

				{stale && (
					<p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
						You&apos;ve changed the details since this quote.
						<button type="submit" form={QUOTE_FORM_ID} className="font-semibold underline underline-offset-2">
							Update quote
						</button>
					</p>
				)}

				<div className="mt-5">
					{state.status === "idle" && <IdlePanel />}

					{state.status === "loading" && (
						<>
							<span className="sr-only">Loading prices</span>
							<LoadingCards />
						</>
					)}

					{state.status === "success" && quote && (
						<>
							<div className="mb-4 flex flex-col gap-1 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
								{converted && quote.fx ? (
									<p>
										Converted at today&apos;s rate; you&apos;re charged in NGN.{" "}
										<span className="text-slate-500">
											1 {quote.display_currency} ≈ {formatMoney(1 / quote.fx.rate, "NGN")}
										</span>
									</p>
								) : quote.display_currency !== "NGN" ? (
									<p>Live exchange rates are unavailable right now, so prices are shown in naira.</p>
								) : (
									<p>Prices in Nigerian naira.</p>
								)}
								{validUntil && !Number.isNaN(validUntil.getTime()) && (
									<p className="inline-flex items-center gap-1.5 font-medium text-slate-700">
										<Clock className="h-4 w-4 text-slate-400" aria-hidden />
										Quote valid until {validUntil.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
									</p>
								)}
							</div>
							<ul className="space-y-3">
								{options.map((o) => (
									<OptionCard key={o.id} option={o} quote={quote} body={state.body} signedIn={signedIn} />
								))}
							</ul>
						</>
					)}

					{state.status === "empty" && (
						<Notice tone="slate" icon={PackageSearch}>
							<p className="mt-4 max-w-md text-sm leading-relaxed">
								We don&apos;t have a carrier for this route and weight yet. Try a nearby major city or a different weight — or tell us what you&apos;re sending and
								we&apos;ll look for a way to move it.
							</p>
							<a
								href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Quote request: ${routeText(state.body)}`)}`}
								className={`mt-5 ${primaryLink}`}
							>
								<Mail className="h-4 w-4" aria-hidden />
								Talk to us
							</a>
						</Notice>
					)}

					{state.status === "limited" && (
						<Notice tone="amber" icon={Hourglass}>
							<p className="mt-4 max-w-md text-sm leading-relaxed">You&apos;ve asked for a lot of quotes in a short time. Please wait a minute, then try again.</p>
							<button type="button" onClick={onRetry} className={retryButton}>
								<RotateCw className="h-4 w-4" aria-hidden /> Try again
							</button>
						</Notice>
					)}

					{state.status === "error" && (
						<div role="alert">
							<Notice tone="rose" icon={TriangleAlert}>
								<p className="mt-4 max-w-md text-sm leading-relaxed">{state.message}</p>
								<button type="button" onClick={onRetry} className={retryButton}>
									<RotateCw className="h-4 w-4" aria-hidden /> Try again
								</button>
							</Notice>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}

export function TrustStrip() {
	const items = [
		{ icon: MapPinned, title: "Live tracking", text: "Follow every shipment from pickup to the final doorstep." },
		{ icon: Truck, title: "Our fleet + partner carriers", text: "Obana drivers for local runs, trusted partners for longer and international routes." },
		{ icon: Wallet, title: "Pay after you quote", text: "See the full price before you book — no hidden fees." },
	];
	return (
		<ul className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Why ship with Obana">
			{items.map(({ icon: Icon, title, text }) => (
				<li key={title} className="flex gap-3 rounded-2xl bg-[#f1fdfc] p-4 ring-1 ring-inset ring-[#dcfbf9]">
					<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#1B3B5F] shadow-sm">
						<Icon className="h-5 w-5" aria-hidden />
					</span>
					<span className="min-w-0">
						<span className="block text-sm font-semibold text-slate-900">{title}</span>
						<span className="mt-0.5 block text-xs leading-relaxed text-slate-600">{text}</span>
					</span>
				</li>
			))}
		</ul>
	);
}
