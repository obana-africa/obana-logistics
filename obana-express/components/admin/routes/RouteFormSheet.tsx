"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Alert, Button, Input, Select } from "@/components/ui";
import { LocationInput } from "@/components/LocationInput";
import { apiClient } from "@/lib/api";
import { NIGERIAN_STATES } from "@/lib/nigerianStates";
import { findLastMileRoute } from "./lastMileMatch";
import { bracketsDisagreeing, previewQuote, resolveRate } from "./pricing";
import { Sheet } from "./Sheet";
import {
	RATE_CURRENCIES,
	SERVICE_LEVELS,
	TRANSPORT_MODES,
	buildPayload,
	driverLabel,
	formFromRoute,
	bracketsAtRate,
	laneRateFromBracket,
	newBracket,
	syncBracket,
	routeTitle,
	validateRoute,
	type BracketDraft,
	type DriverSummary,
	type RouteForm,
	type RoutePayload,
	type RouteTemplate,
} from "./model";

/* The weight the last-mile suggestion is quoted at. The same figure the
   flat-fee helper text uses, so one number is being talked about throughout. */
const REFERENCE_KG = 245;

/* Where the preview starts before the server says what its own default is.
   Matches routeMarkupPercent's fallback, and is replaced the moment
   /routes/pricing-defaults answers — a hardcoded copy would be right until
   somebody changed the setting and silently wrong forever after. */
const DEFAULT_HANDLING_PERCENT = 10;

const naira = (n: number) => `₦${n.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
	return (
		<section className="space-y-4 border-t border-slate-100 pt-6 first:border-t-0 first:pt-0">
			<div>
				<h3 className="font-semibold text-slate-900">{title}</h3>
				{description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
			</div>
			{children}
		</section>
	);
}

export function RouteFormSheet({
	route,
	routes = [],
	drivers,
	driversError,
	saving,
	serverError,
	onCancel,
	onSave,
}: {
	route: RouteTemplate | null;
	/** Every lane already on sale, so a last mile that exists can be offered. */
	routes?: RouteTemplate[];
	drivers: DriverSummary[];
	driversError: boolean;
	saving: boolean;
	serverError: string;
	onCancel: () => void;
	onSave: (payload: RoutePayload) => void;
}) {
	const [form, setForm] = useState<RouteForm>(() => formFromRoute(route));
	const [showErrors, setShowErrors] = useState(false);

	const errors = validateRoute(form);
	const shown = showErrors ? errors : null;

	// Keep the route's current driver selectable even if the driver list didn't load.
	const driverOptions = drivers.map((d) => ({ value: String(d.id), label: driverLabel(d) }));
	if (form.preferred_driver_id && !driverOptions.some((o) => o.value === form.preferred_driver_id)) {
		driverOptions.unshift({
			value: form.preferred_driver_id,
			label: route?.preferred_driver ? driverLabel(route.preferred_driver) : `Driver #${form.preferred_driver_id}`,
		});
	}

	/* What a unit of the lane's currency is worth in naira.

	   This used to be one number fetched from the server, and every
	   conversion on the form was gated on it being above zero. When the call
	   failed — and it fails whenever the API is down, not only when a rate is
	   genuinely missing — the entire form went inert: typing a new rate at
	   the top moved nothing below it, with a yellow banner the only clue that
	   anything had been refused. The figures looked like dummy data because
	   they behaved like it.

	   So the rate is now a value with a visible source. Live where the feed
	   answers, typed where it does not, and 1 on a lane already in naira.
	   Only when there is neither does anything stop converting, and then the
	   form says so and offers the box to fix it. */
	const [liveRate, setLiveRate] = useState<{ nairaPerUnit: number; asOf: string | null } | null>(null);
	const [manualRate, setManualRate] = useState("");
	const [rateState, setRateState] = useState<"idle" | "loading" | "failed">("idle");

	const laneRate = resolveRate(form.rateCurrency, liveRate, manualRate);
	const nairaPerUnit = laneRate.nairaPerUnit;

	useEffect(() => {
		const code = form.rateCurrency;
		if (code === "NGN") {
			setLiveRate(null);
			setRateState("idle");
			return;
		}
		let live = true;
		setRateState("loading");
		apiClient
			.currencyRate(code)
			.then((res) => {
				if (!live) return;
				const value = Number(res?.data?.naira_per_unit) || 0;
				setLiveRate(value > 0 ? { nairaPerUnit: value, asOf: res?.data?.as_of ?? null } : null);
				setRateState(value > 0 ? "idle" : "failed");
			})
			.catch(() => {
				if (!live) return;
				/* The figures on screen are left exactly as they are. Quietly
				   converting at a guessed rate would write a wrong price —
				   but a rate the admin types is not a guess, so the form asks
				   for one instead of giving up. */
				setLiveRate(null);
				setRateState("failed");
			});
		return () => {
			live = false;
		};
	}, [form.rateCurrency]);

	/* Where the freight lands, which is where the inland leg starts: the
	   destination city of this lane. Nobody is asked to retype it. */
	const landingCity = form.destination.city || form.destination.state || "";

	/* The cities with a lane from there into the chosen state, read off the
	   routes themselves — so the list can only offer somewhere served. */
	const arrivalCityOptions = useMemo(() => {
		const state = form.arrivalState.trim().toLowerCase();
		const from = landingCity.trim().toLowerCase();
		if (!state || !from) return [];
		const seen = new Set<string>();
		const out: { value: string; label: string }[] = [];
		for (const r of routes) {
			if ((r.origin_city ?? "").trim().toLowerCase() !== from) continue;
			const meta = r.metadata as { destination_state?: string } | null | undefined;
			const city = (r.destination_city ?? "").trim();
			const rState = (meta?.destination_state ?? "").trim().toLowerCase() || city.toLowerCase();
			if (rState !== state && city.toLowerCase() !== state) continue;
			if (!city || seen.has(city.toLowerCase())) continue;
			seen.add(city.toLowerCase());
			out.push({ value: city, label: city });
		}
		return out;
	}, [routes, landingCity, form.arrivalState]);

	/* What that lane already charges, at the weight the rest of the form
	   quotes against. Offered, never written: the button is the only thing
	   that fills the box, so an admin who agreed a different price keeps it. */
	const lastMileSuggestion = useMemo(
		() => findLastMileRoute(routes, landingCity, form.arrivalState, REFERENCE_KG, form.arrivalCity),
		[routes, landingCity, form.arrivalState, form.arrivalCity],
	);

	/* The weight the preview is worked out at. A price is impossible to check
	   in the abstract — the question an admin is actually asking is "what
	   will a 245 kg shipment be billed?" — so the form answers it, at a
	   weight they can change. */
	const [previewKg, setPreviewKg] = useState(String(REFERENCE_KG));

	/* Obana's charge, as the server actually has it. Asked for once, and the
	   preview falls back to the documented default until it answers. */
	const [defaultHandling, setDefaultHandling] = useState(DEFAULT_HANDLING_PERCENT);
	useEffect(() => {
		let live = true;
		apiClient
			.pricingDefaults()
			.then((res) => {
				const pct = Number(res?.data?.service_charge_percent);
				if (live && Number.isFinite(pct) && pct >= 0) setDefaultHandling(pct);
			})
			.catch(() => {
				/* The preview keeps the documented default and still adds up.
				   A failed lookup is not worth a banner. */
			});
		return () => {
			live = false;
		};
	}, []);
	const preview = useMemo(
		() => previewQuote(form, nairaPerUnit, Number(previewKg) || 0, defaultHandling),
		[form, nairaPerUnit, previewKg, defaultHandling],
	);
	const staleBrackets = useMemo(() => bracketsDisagreeing(form, nairaPerUnit), [form, nairaPerUnit]);

	/* Price and rate move together — see syncBracket. Typing one fills the
	   other, so a lane sold by the kilo and a lane sold as a job are both
	   entered the way they were actually agreed.

	   A bracket's ₦/kg is also the lane's rate, in the lane's currency: edit
	   it here and the box at the top follows, which is the other half of the
	   two never contradicting each other. */
	const updateBracket = (key: number, field: keyof Omit<BracketDraft, "key">, value: string) =>
		setForm((prev) => {
			const brackets = prev.brackets.map((b) => (b.key === key ? syncBracket(b, field, value) : b));
			if (!prev.ratePerKg.trim()) return { ...prev, brackets };
			const edited = brackets.find((b) => b.key === key);
			const lane = edited ? laneRateFromBracket(edited.rate, nairaPerUnit) : null;
			return { ...prev, brackets, ratePerKg: lane ?? prev.ratePerKg };
		});

	/** The lane rate changed, so the brackets are restated at it. */
	const setLaneRate = (value: string) =>
		setForm((prev) => ({ ...prev, ratePerKg: value, brackets: bracketsAtRate(prev.brackets, value, nairaPerUnit) }));

	/* The last mile's own ranges. Price and rate are not linked here the way
	   they are on the freight brackets, because this leg is quoted as a job
	   within a weight range — there is no per-kilo figure anyone argues
	   about. So the price is simply the price. */
	const updateLastMileBracket = (key: number, field: "min" | "max" | "price" | "eta", value: string) =>
		setForm((prev) => ({
			...prev,
			lastMileBrackets: prev.lastMileBrackets.map((b) => (b.key === key ? { ...b, [field]: value } : b)),
		}));

	const addBracket = () => {
		const fresh = newBracket();
		setForm((prev) => {
			const last = prev.brackets[prev.brackets.length - 1];
			// Start where the previous bracket stops.
			return { ...prev, brackets: [...prev.brackets, { ...fresh, min: last?.max.trim() ? last.max : prev.brackets.length ? "" : "0" }] };
		});
	};

	const removeBracket = (key: number) => setForm((prev) => ({ ...prev, brackets: prev.brackets.filter((b) => b.key !== key) }));

	const submit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (saving) return;
		if (errors.count > 0) {
			setShowErrors(true);
			requestAnimationFrame(() => {
				document.querySelector<HTMLElement>("[data-route-form] [data-invalid='true']")?.scrollIntoView({ block: "center", behavior: "smooth" });
			});
			return;
		}
		onSave(buildPayload(form));
	};

	return (
		<Sheet
			title={route ? "Edit route" : "New route"}
			description={route ? routeTitle(route) : "Where the Obana fleet goes, how fast, and what it costs."}
			onClose={onCancel}
			onSubmit={submit}
			footer={
				<>
					<Button type="button" variant="secondary" onClick={onCancel} className="flex-1 sm:flex-none">
						Cancel
					</Button>
					<Button type="submit" loading={saving} className="flex-1 sm:min-w-40 sm:flex-none">
						{saving ? "Saving…" : route ? "Save changes" : "Create route"}
					</Button>
				</>
			}
		>
			<div className="space-y-6" data-route-form>
				{serverError && <Alert type="error">{serverError}</Alert>}
				{shown && shown.count > 0 && (
					<Alert type="error">
						Fix {shown.count === 1 ? "the highlighted field" : `the ${shown.count} highlighted fields`} before saving.
					</Alert>
				)}

				<div className="space-y-6">
				<Section title="Route" description="The city the fleet collects from and the city it delivers to.">
					<div data-invalid={shown?.origin ? "true" : undefined}>
						<LocationInput
							label="Origin"
							required
							value={form.origin}
							onChange={(location) => setForm((prev) => ({ ...prev, origin: location }))}
							placeholder="Origin city"
						/>
						{shown?.origin && <p className="mt-1.5 text-sm text-rose-600">{shown.origin}</p>}
						{/* One route for a whole country. Pricing has always honoured
						    this — endFit treats the end as a match on country alone —
						    but nothing could set it, so a route meant to cover
						    "anywhere in Nigeria" had to be created state by state, and
						    the one state nobody had got to failed the quote. */}
						<label className="mt-2 flex items-start gap-2 text-sm">
							<input
								type="checkbox"
								className="mt-0.5"
								checked={Boolean(form.origin.anyState)}
								onChange={(e) =>
									setForm((prev) => ({
										...prev,
										origin: { ...prev.origin, anyState: e.target.checked },
									}))
								}
							/>
							<span>
								Serves the whole country
								<span className="block text-muted-foreground text-xs">
									Any state in {form.origin.country || "this country"}, not just{" "}
									{form.origin.state || "the state above"}.
								</span>
							</span>
						</label>
					</div>
					<div data-invalid={shown?.destination ? "true" : undefined}>
						<LocationInput
							label="Destination"
							required
							value={form.destination}
							onChange={(location) => setForm((prev) => ({ ...prev, destination: location }))}
							placeholder="Destination city"
						/>
						{shown?.destination && <p className="mt-1.5 text-sm text-rose-600">{shown.destination}</p>}
						{/* One route for a whole country. Pricing has always honoured
						    this — endFit treats the end as a match on country alone —
						    but nothing could set it, so a route meant to cover
						    "anywhere in Nigeria" had to be created state by state, and
						    the one state nobody had got to failed the quote. */}
						<label className="mt-2 flex items-start gap-2 text-sm">
							<input
								type="checkbox"
								className="mt-0.5"
								checked={Boolean(form.destination.anyState)}
								onChange={(e) =>
									setForm((prev) => ({
										...prev,
										destination: { ...prev.destination, anyState: e.target.checked },
									}))
								}
							/>
							<span>
								Serves the whole country
								<span className="block text-muted-foreground text-xs">
									Any state in {form.destination.country || "this country"}, not just{" "}
									{form.destination.state || "the state above"}.
								</span>
							</span>
						</label>
					</div>

					{/* Only where the route actually crosses a border. On a
					    domestic lane there is no crossing to separate from a
					    last mile, and the field would be one more box to
					    wonder about. */}
					{form.origin.countryCode && form.destination.countryCode && form.origin.countryCode !== form.destination.countryCode && (
						<div className="mt-4 rounded-lg border bg-slate-50/60 p-3">
							<p className="font-medium text-sm">Where the goods land</p>
							<p className="mb-3 text-muted-foreground text-xs">
								This route covers all of {form.destination.country || "the destination country"} at one price, so a
								delivery far from where the freight arrives is not charged for that last stretch. Name the arrival
								city and it becomes its own line on the invoice, priced from your domestic routes.
								<span className="mt-1 block">Leave both blank and nothing changes — one freight charge, as now.</span>
							</p>
							<div className="grid gap-3 sm:grid-cols-2">
								{/* A list, not a text box.
								    
								    A state typed by hand does not match a route — "Port Harcourt"
								    went into this field, reasonably, and the search for a lane from
								    there found nothing, so the leg was silently never priced. The
								    values are spelled the way the route table spells them, which is
								    what the matching normalises against. */}
								<Select
									label="Arrival state"
									placeholder="Choose a state"
									value={form.arrivalState}
									onChange={(ev) => {
										const arrivalState = ev.target.value;
										setForm((prev) => ({ ...prev, arrivalState, arrivalCity: "" }));
									}}
									options={NIGERIAN_STATES}
								/>
								{/* The cities this platform actually runs a lane to, in that
								    state. Typing one it does not serve is the same dead end as
								    before, one level down. */}
								<Select
									label="Arrival city"
									placeholder={arrivalCityOptions.length ? "Choose a city" : "No lanes into that state yet"}
									value={form.arrivalCity}
									onChange={(ev) => setForm((prev) => ({ ...prev, arrivalCity: ev.target.value }))}
									options={arrivalCityOptions}
								/>
							</div>
							{/* The price this leg already has.
							    
							    Lagos → Port Harcourt exists, is priced and is booked on its own
							    every day. Making an admin look that figure up and retype it into
							    this lane is how the two drift apart — so it is offered, with the
							    lane it came from named, and nothing is written until it is
							    accepted. */}
							{lastMileSuggestion && (
								<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
									<div className="text-sm">
										<span className="font-medium text-slate-900">
											{lastMileSuggestion.route.origin_city} → {lastMileSuggestion.route.destination_city}
										</span>
										<span className="text-slate-600">
											{" "}already prices this at ₦{lastMileSuggestion.price.toLocaleString("en-NG")}
											{lastMileSuggestion.eta ? ` · ${lastMileSuggestion.eta} days` : ""} for {REFERENCE_KG} kg
										</span>
									</div>
									<button
										type="button"
										className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
										onClick={() =>
											/* The flat fee only. buildPayload already clears
											   last_mile_per_kg whenever a flat fee is set, so the
											   two cannot both be in force. */
											setForm((prev) => ({ ...prev, lastMile: String(Math.round(lastMileSuggestion.price)) }))
										}
									>
										Use this price
									</button>
								</div>
							)}
						</div>
					)}
				</Section>

				<Section title="Service">
					<div className="grid gap-4 sm:grid-cols-2">
						<div data-invalid={shown?.transport_mode ? "true" : undefined}>
							<Select
								label="Transport mode"
								required
								placeholder="Choose a mode"
								value={form.transport_mode}
								onChange={(e) => {
									const value = e.target.value;
									setForm((prev) => ({ ...prev, transport_mode: value }));
								}}
								options={TRANSPORT_MODES}
								error={shown?.transport_mode}
							/>
						</div>
						<div data-invalid={shown?.service_level ? "true" : undefined}>
							<Select
								label="Service level"
								required
								placeholder="Choose a service level"
								value={form.service_level}
								onChange={(e) => {
									const value = e.target.value;
									setForm((prev) => ({ ...prev, service_level: value }));
								}}
								options={SERVICE_LEVELS}
								error={shown?.service_level}
							/>
						</div>
					</div>
				</Section>

				{/* What this lane charges, in one place.

				    These three lived in three different places and none of
				    them was the route: the rate only in the weight brackets,
				    the last mile as a per-kilo figure no screen could show,
				    and the handling charge in a server-wide environment
				    variable. So an agreed price could be typed into a booking
				    and had to be typed again on the next one. Set here, it is
				    simply what the lane costs. */}
				<Section
					title="Pricing"
					description="All optional. Leave a box empty and this lane prices exactly as it does today."
				>
					<div className="grid gap-4 sm:grid-cols-3">
						<div className="sm:col-span-2" data-invalid={shown?.ratePerKg ? "true" : undefined}>
							<Input
								label="Rate per kg"
								type="number"
								inputMode="decimal"
								step="any"
								min="0"
								placeholder="10.09"
								value={form.ratePerKg}
								error={shown?.ratePerKg}
								helperText="Given, this decides the freight and the weight brackets below become the fallback."
								onChange={(ev) => setLaneRate(ev.target.value)}
							/>
						</div>
						<Select
							label="Currency"
							value={form.rateCurrency}
							options={RATE_CURRENCIES}
							onChange={(ev) => {
								/* A rate typed for euros is not a rate for dollars, so
								   switching currency drops it rather than silently
								   reinterpreting it against the wrong money. */
								setManualRate("");
								setForm((prev) => ({ ...prev, rateCurrency: ev.target.value }));
							}}
						/>
					</div>

					{/* The conversion, in the open.

					    Everything on this form that turns a foreign rate into
					    naira runs through one number, and that number used to
					    be invisible: fetched on load, never shown, and on a
					    bad day silently zero — which disabled every
					    calculation below without saying so. It is shown here
					    with where it came from, and it can be typed over,
					    because an admin looking at today's bank rate knows
					    something the feed does not.

					    It is never saved on the lane. The server converts at
					    quote time with its own feed; a rate typed here moves
					    the figures on this screen and nothing else. */}
					{form.rateCurrency !== "NGN" && (
						<div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
							<div className="flex flex-wrap items-end justify-between gap-3">
								<div className="text-sm">
									<p className="font-medium text-slate-900">
										1 {form.rateCurrency} ={" "}
										{nairaPerUnit > 0 ? (
											<span className="tabular-nums">{naira(nairaPerUnit)}</span>
										) : (
											<span className="text-rose-700">no rate yet</span>
										)}
									</p>
									<p className="mt-0.5 text-slate-500 text-xs">
										{rateState === "loading" && "Fetching today's rate…"}
										{laneRate.origin === "live" && `Live rate${laneRate.asOf ? `, ${new Date(laneRate.asOf).toLocaleDateString()}` : ""}. Type over it to use your own.`}
										{laneRate.origin === "manual" && "Your own rate. Clear the box to go back to the live one."}
										{laneRate.origin === "none" && rateState !== "loading" && "The live rate could not be fetched, so nothing below is being converted. Type today's rate to carry on."}
									</p>
								</div>
								<div className="w-44">
									<Input
										label={`₦ per ${form.rateCurrency}`}
										type="number"
										inputMode="decimal"
										step="any"
										min="0"
										placeholder={liveRate ? String(liveRate.nairaPerUnit) : "1479.29"}
										value={manualRate}
										onChange={(ev) => {
											const typed = ev.target.value;
											setManualRate(typed);
											/* The brackets follow the rate the moment it
											   changes — that is the whole point of the
											   two being one number. */
											const next = resolveRate(form.rateCurrency, liveRate, typed);
											if (next.nairaPerUnit > 0) {
												setForm((prev) => ({ ...prev, brackets: bracketsAtRate(prev.brackets, prev.ratePerKg, next.nairaPerUnit) }));
											}
										}}
									/>
								</div>
							</div>
						</div>
					)}

					{/* What that rate comes to on a real shipment. A rate in a
					    foreign currency is hard to sanity-check on its own, and
					    the figure people actually argue about is the total. */}
					{form.ratePerKg.trim() && (
						<p className="text-slate-500 text-xs">
							{form.rateCurrency} {form.ratePerKg.trim()} × 245 kg ={" "}
							<span className="font-semibold tabular-nums text-slate-700">
								{form.rateCurrency}{" "}
								{((parseFloat(form.ratePerKg) || 0) * 245).toLocaleString(undefined, { maximumFractionDigits: 2 })}
							</span>
						</p>
					)}

					<div className="grid gap-4 sm:grid-cols-2">
						{/* Only on a lane that crosses a border — the same
						    condition as the arrival city above, because there
						    is no last mile without one. */}
						{form.origin.countryCode && form.destination.countryCode && form.origin.countryCode !== form.destination.countryCode && (
							<div className="sm:col-span-2" data-invalid={shown?.lastMile ? "true" : undefined}>
								<p className="font-medium text-slate-900 text-sm">Last mile — inland</p>
								{/* Two ways to say it, one of them in force.

								    An amount is right for a run quoted as a job: a
								    truck to Port Harcourt costs what it costs. But a
								    lane that carries a 35 kg parcel and a 245 kg pallet
								    to the same door is not doing the same job twice,
								    and one amount could not say so — the only
								    alternative was a per-kilo rate, which says the
								    opposite. Brackets say what is actually true. */}
								<div className="mt-2 inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
									{(
										[
											["flat", "One amount"],
											["brackets", "By weight"],
										] as const
									).map(([mode, label]) => (
										<button
											key={mode}
											type="button"
											aria-pressed={form.lastMileMode === mode}
											onClick={() =>
												setForm((prev) => ({
													...prev,
													lastMileMode: mode,
													/* Switching to weight starts from the amount
													   already agreed, as one 0–245 kg row, rather
													   than an empty table. */
													lastMileBrackets:
														mode === "brackets" && !prev.lastMileBrackets.length
															? [{ ...newBracket("0"), max: String(REFERENCE_KG), price: prev.lastMile.trim(), rate: "", eta: "" }]
															: prev.lastMileBrackets,
												}))
											}
											className={
												form.lastMileMode === mode
													? "rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white"
													: "rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
											}
										>
											{label}
										</button>
									))}
								</div>

								{form.lastMileMode === "flat" ? (
									<div className="mt-3 max-w-xs">
										<Input
											label="Amount (₦)"
											type="number"
											inputMode="decimal"
											step="any"
											min="0"
											placeholder="585000"
											value={form.lastMile}
											error={shown?.lastMile}
											helperText="The same at 10 kg and at 245 kg. Empty uses your domestic routes."
											onChange={(ev) => setForm((prev) => ({ ...prev, lastMile: ev.target.value }))}
										/>
									</div>
								) : (
									<div className="mt-3 space-y-3">
										{shown?.lastMile && (
											<p data-invalid="true" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-sm">
												{shown.lastMile}
											</p>
										)}
										{form.lastMileBrackets.map((b, i) => (
											<div key={b.key} role="group" aria-label={`Last mile range ${i + 1}`} className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-5">
												<Input label="Min (kg)" type="number" inputMode="decimal" step="any" min="0" placeholder="0" value={b.min} onChange={(ev) => updateLastMileBracket(b.key, "min", ev.target.value)} />
												<Input label="Max (kg)" type="number" inputMode="decimal" step="any" min="0" placeholder="35" value={b.max} onChange={(ev) => updateLastMileBracket(b.key, "max", ev.target.value)} />
												<Input label="Price (₦)" type="number" inputMode="decimal" step="any" min="0" placeholder="120000" value={b.price} onChange={(ev) => updateLastMileBracket(b.key, "price", ev.target.value)} />
												<Input label="ETA" placeholder="2-3" value={b.eta} onChange={(ev) => updateLastMileBracket(b.key, "eta", ev.target.value)} />
												<div className="flex items-end">
													<button
														type="button"
														onClick={() => setForm((prev) => ({ ...prev, lastMileBrackets: prev.lastMileBrackets.filter((r) => r.key !== b.key) }))}
														aria-label={`Remove last mile range ${i + 1}`}
														className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
													>
														<Trash2 className="h-4 w-4" aria-hidden />
													</button>
												</div>
											</div>
										))}
										<button
											type="button"
											onClick={() =>
												setForm((prev) => {
													const last = prev.lastMileBrackets[prev.lastMileBrackets.length - 1];
													return { ...prev, lastMileBrackets: [...prev.lastMileBrackets, { ...newBracket(last?.max.trim() ? last.max : "0"), max: "", price: "", eta: "" }] };
												})
											}
											className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium text-slate-700 text-sm hover:bg-slate-50"
										>
											<Plus className="h-4 w-4" aria-hidden /> Add weight range
										</button>
									</div>
								)}
							</div>
						)}
						<div data-invalid={shown?.handlingPercent ? "true" : undefined}>
							<Input
								label="Handling charge (%)"
								type="number"
								inputMode="decimal"
								step="any"
								min="0"
								max="100"
								placeholder="10"
								value={form.handlingPercent}
								error={shown?.handlingPercent}
								helperText="Empty uses the server-wide charge. 0 charges nothing on this lane."
								onChange={(ev) => setForm((prev) => ({ ...prev, handlingPercent: ev.target.value }))}
							/>
						</div>
					</div>
				</Section>

				<Section title="Preferred driver" description="Optional. Shipments on this route are assigned to this driver automatically.">
					<Select
						label="Preferred driver"
						placeholder="No preferred driver"
						value={form.preferred_driver_id}
						onChange={(e) => {
							const value = e.target.value;
							setForm((prev) => ({ ...prev, preferred_driver_id: value }));
						}}
						options={driverOptions}
						helperText={driversError ? "We couldn't load the driver list. You can still save — the current choice is kept." : undefined}
					/>
				</Section>

				<Section title="Weight brackets" description="Price and delivery time for each weight range. Brackets can share an edge (0–5 kg, 5–10 kg) but must not overlap.">
					{/* The brackets are the lane rate, written out per weight
					    range. They used to be a second price that disagreed
					    with it — EUR 10.09/kg at the top, NGN 8,807.25/kg down
					    here — and nothing said the first overrode the second,
					    so correcting the bracket changed a number the lane
					    does not use. Now either one moves the other. */}
					{form.ratePerKg.trim() && nairaPerUnit > 0 && (
						<p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 text-sm">
							Priced at{" "}
							<span className="font-semibold tabular-nums">
								{form.rateCurrency} {form.ratePerKg.trim()}/kg
							</span>
							{form.rateCurrency !== "NGN" && (
								<>
									{" = "}
									<span className="font-semibold tabular-nums">
										₦{(parseFloat(form.ratePerKg) * nairaPerUnit || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg
									</span>
								</>
							)}
							. Change it here or above — the two stay in step.
						</p>
					)}
					{/* Which brackets no longer say what the rate says.

					    They are only reached when the currency cannot be
					    converted — which is exactly the day nobody is
					    watching — so a bracket left at the old price is a
					    figure the lane will quietly charge. Named here, with
					    one button to bring them back into line. */}
					{staleBrackets.length > 0 && (
						<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
							<span>
								{staleBrackets.length === 1 ? `Bracket ${staleBrackets[0] + 1} does not` : `Brackets ${staleBrackets.map((i) => i + 1).join(", ")} do not`} match{" "}
								{form.rateCurrency} {form.ratePerKg.trim()}/kg. They are what this lane charges on a day the rate cannot be fetched.
							</span>
							<button
								type="button"
								onClick={() => setForm((prev) => ({ ...prev, brackets: bracketsAtRate(prev.brackets, prev.ratePerKg, nairaPerUnit) }))}
								className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 hover:bg-amber-100"
							>
								Restate at this rate
							</button>
						</div>
					)}
					{shown?.brackets && (
						<p data-invalid="true" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
							{shown.brackets}
						</p>
					)}
					<ol className="space-y-3">
						{form.brackets.map((b, i) => {
							const e = shown?.bracket[i] ?? {};
							const invalid = Object.values(e).some(Boolean);
							return (
								<li
									key={b.key}
									role="group"
									aria-label={`Bracket ${i + 1}`}
									data-invalid={invalid ? "true" : undefined}
									className={invalid ? "rounded-2xl border border-rose-300 bg-rose-50/40 p-3 sm:p-4" : "rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4"}
								>
									<div className="mb-3 flex items-center justify-between gap-3">
										<p className="text-sm font-semibold text-slate-900">Bracket {i + 1}</p>
										<div className="flex items-center gap-1">
											<button
												type="button"
												onClick={() => removeBracket(b.key)}
												aria-label={`Remove bracket ${i + 1}`}
												className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600"
											>
												<Trash2 className="h-4 w-4" aria-hidden />
											</button>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
										<Input label="Min (kg)" required type="number" inputMode="decimal" step="any" min="0" placeholder="0" value={b.min} error={e.min} onChange={(ev) => updateBracket(b.key, "min", ev.target.value)} />
										<Input label="Max (kg)" required type="number" inputMode="decimal" step="any" min="0" placeholder="10" value={b.max} error={e.max} onChange={(ev) => updateBracket(b.key, "max", ev.target.value)} />
										{/* Either box fills the other. The badge that used to sit
										    in the corner showed this same figure and could not be
										    typed into, which is the whole of what is new here. */}
										<Input label="Rate (₦/kg)" type="number" inputMode="decimal" step="any" min="0" placeholder="1200" value={b.rate} onChange={(ev) => updateBracket(b.key, "rate", ev.target.value)} />
										<Input label="Price (₦)" required type="number" inputMode="decimal" step="any" min="0" placeholder="5000" value={b.price} error={e.price} onChange={(ev) => updateBracket(b.key, "price", ev.target.value)} />
										<Input
											label="ETA"
											required
											placeholder="2-3"
											value={b.eta}
											error={e.eta}
											onChange={(ev) => updateBracket(b.key, "eta", ev.target.value)}
											trailing={<span className="pr-2.5 text-sm text-slate-500">days</span>}
										/>
									</div>
									{e.overlap && <p className="mt-2 text-sm font-medium text-rose-700">{e.overlap}</p>}
								</li>
							);
						})}
					</ol>
					<Button type="button" variant="secondary" onClick={addBracket} className="w-full sm:w-auto">
						<Plus className="h-4 w-4" aria-hidden /> Add bracket
					</Button>
				</Section>

				{/* What a shipment on this lane will actually be billed.

				    Every figure above is optional and several of them can be
				    set at once, so which one a customer pays was a question
				    only the pricing code could answer — and the honest
				    reaction to that is not trusting any of it. The same
				    precedence the server uses is worked out here and shown:
				    a per-kilo rate beats the brackets, the brackets are what
				    gets charged when the currency cannot be converted, and
				    the inland leg is its own line. See pricing.ts, which
				    names the server function behind each branch. */}
				<Section title="What this lane will charge" description="Worked out the way the server works it out, so this is the figure a shipment gets quoted.">
					<div className="flex flex-wrap items-end gap-3">
						<div className="w-36">
							<Input
								label="At this weight"
								type="number"
								inputMode="decimal"
								step="any"
								min="0"
								value={previewKg}
								onChange={(ev) => setPreviewKg(ev.target.value)}
								trailing={<span className="pr-2.5 text-slate-500 text-sm">kg</span>}
							/>
						</div>
					</div>

					<dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
						<div className="flex items-baseline justify-between gap-4 px-4 py-3">
							<dt className="text-slate-600 text-sm">
								Freight
								<span className="mt-0.5 block text-slate-400 text-xs">
									{preview.freight.from === "rate" && `From the rate above: ${form.rateCurrency} ${form.ratePerKg.trim()}/kg × ${preview.weight} kg.`}
									{preview.freight.from === "bracket" &&
										(form.ratePerKg.trim()
											? `From bracket ${preview.freight.bracketLabel} — the rate above cannot be converted, so the bracket is what gets charged.`
											: `From bracket ${preview.freight.bracketLabel}.`)}
									{preview.freight.from === "none" && "No price covers this weight yet."}
								</span>
							</dt>
							<dd className="shrink-0 font-semibold text-slate-900 tabular-nums">{naira(preview.freight.base)}</dd>
						</div>

						<div className="flex items-baseline justify-between gap-4 px-4 py-3">
							<dt className="text-slate-600 text-sm">
								Obana's charge
								<span className="mt-0.5 block text-slate-400 text-xs">
									{preview.handlingPercent}% of the freight{form.handlingPercent.trim() ? "" : ", the server-wide charge"}.
								</span>
							</dt>
							<dd className="shrink-0 font-semibold text-slate-900 tabular-nums">{naira(preview.handling)}</dd>
						</div>

						{preview.lastMile.from !== "none" && (
							<div className="flex items-baseline justify-between gap-4 px-4 py-3">
								<dt className="text-slate-600 text-sm">
									Last mile — inland
									<span className="mt-0.5 block text-slate-400 text-xs">
										{preview.lastMile.from === "brackets" && `From the ${preview.lastMile.label} range on this lane.`}
										{preview.lastMile.from === "flat" && "The amount set on this lane, whatever it weighs."}
										{preview.lastMile.from === "domestic" && "Not set here, so your domestic routes price it at booking."}
									</span>
								</dt>
								<dd className="shrink-0 font-semibold text-slate-900 tabular-nums">
									{preview.lastMile.from === "domestic" ? <span className="text-slate-400 text-sm">from your routes</span> : naira(preview.lastMile.base)}
								</dd>
							</div>
						)}

						<div className="flex items-baseline justify-between gap-4 bg-slate-50 px-4 py-3">
							<dt className="font-semibold text-slate-900 text-sm">
								Total
								{preview.lastMile.from === "domestic" && <span className="mt-0.5 block font-normal text-slate-400 text-xs">Before the inland leg your domestic routes add.</span>}
							</dt>
							<dd className="shrink-0 font-semibold text-lg text-slate-900 tabular-nums">{naira(preview.total)}</dd>
						</div>
					</dl>
				</Section>
				</div>
			</div>
		</Sheet>
	);
}
