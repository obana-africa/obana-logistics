"use client";

import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { Globe2 } from "lucide-react";
import Footer from "@/components/home/Footer";
import Navigation from "@/components/home/Navigation";
import { QUOTE_FORM_ID, QuoteForm, type QuoteErrors } from "@/components/quote/QuoteForm";
import { QuoteResults, TrustStrip, type QuoteState } from "@/components/quote/QuoteResults";
import { DEFAULT_DESTINATION, DEFAULT_ORIGIN, MAX_KG, MIN_KG, buildRequest, currencyFor, parsePrefill, type Place } from "@/components/quote/quote";
import { Button } from "@/components/ui";
import { apiClient, type PublicQuoteRequest } from "@/lib/api";
import { useAuth } from "@/lib/authContext";

// Public quote page: anyone can price a shipment, signed in or not.

const subscribeNothing = () => () => {};
const readSearch = () => window.location.search;

/** What the visitor has changed; everything else comes from the link (?from=GB&to=NG&kg=5) or the defaults. */
type Edits = { origin?: Place; destination?: Place; weight?: string; declared?: string; currency?: string };

const NETWORK_ERROR = "We couldn't reach our pricing service. Check your connection and try again.";

function validate(origin: Place, destination: Place, weight: string, declared: string): QuoteErrors {
	const e: QuoteErrors = {};
	if (!origin.city.trim()) e.origin = origin.state ? "Choose or type the pickup city." : "Choose the pickup state and city.";
	if (!destination.city.trim()) e.destination = destination.state ? "Choose or type the delivery city." : "Choose the delivery state and city.";
	const kg = parseFloat(weight);
	if (!weight.trim()) e.weight = "Enter the weight in kg.";
	else if (!(kg >= MIN_KG && kg <= MAX_KG)) e.weight = `Enter a weight between ${MIN_KG} and ${MAX_KG.toLocaleString()} kg.`;
	if (declared.trim() && !(parseFloat(declared) >= 0)) e.declared = "Enter an amount in naira, or leave it empty.";
	return e;
}

export default function QuotePage() {
	const { isAuthenticated } = useAuth();
	// Sign-in state and the link's params live in the browser: read them after hydration.
	const mounted = useSyncExternalStore(subscribeNothing, () => true, () => false);
	const signedIn = mounted && isAuthenticated;
	const search = useSyncExternalStore(subscribeNothing, readSearch, () => "");
	const prefill = useMemo(() => parsePrefill(search), [search]);

	const [edits, setEdits] = useState<Edits>({});
	const [showErrors, setShowErrors] = useState(false);
	const [result, setResult] = useState<QuoteState>({ status: "idle" });
	const headingRef = useRef<HTMLHeadingElement>(null);
	const latest = useRef(0);

	const places = (e: Edits) => ({
		origin: e.origin ?? prefill.origin ?? DEFAULT_ORIGIN,
		destination: e.destination ?? prefill.destination ?? DEFAULT_DESTINATION,
	});
	const { origin, destination } = places(edits);
	const weight = edits.weight ?? prefill.weight ?? "";
	const declared = edits.declared ?? prefill.declared ?? "";
	const currencyChoice = edits.currency ?? prefill.currency ?? "";
	const autoCurrency = currencyFor(origin.countryCode);
	const displayCurrency = currencyChoice || autoCurrency;

	const errors = validate(origin, destination, weight, declared);
	const valid = Object.keys(errors).length === 0;
	const requestKey = valid ? JSON.stringify(buildRequest(origin, destination, weight, declared, displayCurrency)) : "";
	const stale = (result.status === "success" || result.status === "empty") && requestKey !== JSON.stringify(result.body);
	const loading = result.status === "loading";

	const run = async (body: PublicQuoteRequest) => {
		const id = ++latest.current;
		setResult({ status: "loading", body });
		// On one-column layouts the results sit below the form — bring them into view.
		if (window.matchMedia("(max-width: 1023px)").matches) headingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

		let next: QuoteState;
		try {
			// Backend envelope: { status: "success", data: {...quote} } or { status: "error", code, message }.
			const res = await apiClient.getPublicQuote(body);
			if (res?.status === "error") next = { status: "error", body, message: res.message || NETWORK_ERROR };
			else if (res?.data?.options?.length) next = { status: "success", body, quote: res.data };
			else next = { status: "empty", body };
		} catch (err) {
			const code = axios.isAxiosError(err) ? err.response?.status : undefined;
			const message = axios.isAxiosError(err) ? (err.response?.data as { message?: string } | undefined)?.message : undefined;
			// Only the API's own JSON 404 means "no routes"; an HTML 404 means the endpoint itself is missing.
			if (code === 404 && message) next = { status: "empty", body };
			else if (code === 429) next = { status: "limited", body };
			else if (code === 400) next = { status: "error", body, message: message || "Some details don't look right. Check them and try again." };
			else next = { status: "error", body, message: NETWORK_ERROR };
		}
		if (id !== latest.current) return; // a newer quote was asked for meanwhile
		setResult(next);
		requestAnimationFrame(() => headingRef.current?.focus());
	};

	const onSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!valid) {
			setShowErrors(true);
			requestAnimationFrame(() => {
				const box = document.querySelector<HTMLElement>(`#${QUOTE_FORM_ID} [data-invalid="true"]`);
				box?.scrollIntoView({ behavior: "smooth", block: "center" });
				box?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled)")?.focus({ preventScroll: true });
			});
			return;
		}
		run(buildRequest(origin, destination, weight, declared, displayCurrency));
	};

	const retry = () => {
		if (result.status !== "idle") run(result.body);
	};

	return (
		<div className="flex min-h-screen flex-col bg-[#f7f8fb] pb-24 md:pb-0">
			<Navigation />

			<main className="flex-1 pt-20">
				<section className="border-b border-slate-200/70 bg-white bg-[radial-gradient(circle_at_12%_30%,rgba(220,251,249,0.8),transparent_60%)]">
					<div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-10 lg:pb-10 lg:pt-12">
						<p className="inline-flex items-center gap-2 rounded-full bg-[#dcfbf9] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#1B3B5F]">
							<Globe2 className="h-3.5 w-3.5" aria-hidden />
							Instant quote · No account needed
						</p>
						<h1 className="mt-4 text-3xl font-black tracking-tight text-[#1B3B5F] sm:text-4xl lg:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
							Get a shipping quote
						</h1>
						<p className="mt-3 max-w-2xl text-base text-slate-600 lg:text-lg">
							From Europe to Africa, and door to door across Nigeria. Compare our own fleet with partner carriers and see prices in your currency.
						</p>
					</div>
				</section>

				<div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10 lg:px-10 lg:py-10">
					<div className="lg:sticky lg:top-24">
						<QuoteForm
							origin={origin}
							destination={destination}
							weight={weight}
							declared={declared}
							currencyChoice={currencyChoice}
							autoCurrency={autoCurrency}
							errors={showErrors ? errors : {}}
							loading={loading}
							onOrigin={(p) => setEdits((prev) => ({ ...prev, origin: p }))}
							onDestination={(p) => setEdits((prev) => ({ ...prev, destination: p }))}
							onSwap={() =>
								setEdits((prev) => {
									const now = places(prev);
									return { ...prev, origin: now.destination, destination: now.origin };
								})
							}
							onWeight={(v) => setEdits((prev) => ({ ...prev, weight: v }))}
							onDeclared={(v) => setEdits((prev) => ({ ...prev, declared: v }))}
							onCurrency={(v) => setEdits((prev) => ({ ...prev, currency: v }))}
							onSubmit={onSubmit}
						/>
					</div>

					<div className="min-w-0">
						<QuoteResults state={result} signedIn={signedIn} stale={stale} onRetry={retry} headingRef={headingRef} />
						<TrustStrip />
					</div>
				</div>
			</main>

			<Footer />

			{/* Phones: the main action stays in reach while scrolling the form. */}
			<div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
				<Button type="submit" form={QUOTE_FORM_ID} size="lg" fullWidth loading={loading}>
					{loading ? "Getting prices…" : "Get quote"}
				</Button>
			</div>
		</div>
	);
}
