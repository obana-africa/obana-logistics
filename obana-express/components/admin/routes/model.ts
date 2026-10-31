// Route template types, display helpers, validation and the API payload for the admin Routes & pricing screen.
import type { Tone } from "@/lib/shipments";

export type Place = {
	city: string;
	state: string;
	country: string;
	countryCode: string;
	stateCode: string;
	/** This end serves the whole country, not only the state named. */
	anyState?: boolean;
};

export interface RawBracket {
	min?: number | string | null;
	max?: number | string | null;
	price?: number | string | null;
	eta?: string | null;
	unit_price?: number | string | null;
}

export interface RouteMetadata {
	origin_state?: string;
	origin_country?: string;
	origin_country_code?: string;
	origin_state_code?: string;
	destination_state?: string;
	destination_country?: string;
	destination_country_code?: string;
	destination_state_code?: string;
	/* This end covers the whole country, not just the state named above.
	   Pricing already honours these — endFit in routesController reads them —
	   but nothing could set them, so "we deliver anywhere in Nigeria" was
	   true of the quote engine and not of any route anyone could create. */
	origin_any_state?: boolean;
	destination_any_state?: boolean;
	/* Where freight on this lane lands before the last mile.
	
	   A cross-border route covers a whole country at one price, so Italy to
	   Lagos and Italy to Port Harcourt quote the same figure and the run to
	   Port Harcourt is not charged. Naming the arrival city turns that run
	   into its own priced leg, from the domestic routes that already price it.
	
	   Left blank, the lane behaves exactly as it always has: one freight line,
	   no last mile. */
	arrival_city?: string;
	arrival_state?: string;
	/* What a kilo costs on this lane, in its own currency. Given, it decides
	   the freight and the weight brackets below become the fallback — which is
	   how Italy → Lagos is priced at EUR 10.09/kg rather than by bracket. */
	price_per_kg?: number | string | null;
	price_currency?: string | null;
	/* The inland leg as an amount, because it is quoted as a job and not by
	   the kilo. Takes precedence over last_mile_per_kg and over whatever the
	   domestic routes would have charged. */
	last_mile_flat?: number | string | null;
	last_mile_per_kg?: number | string | null;
	/** Obana's charge on this lane. Blank means the server-wide setting. */
	service_charge_percent?: number | string | null;
}

export interface DriverSummary {
	id: number | string;
	driver_code?: string | null;
	vehicle_type?: string | null;
	user?: { email?: string | null } | null;
}

export interface RouteTemplate {
	id: number | string;
	origin_city: string;
	destination_city: string;
	transport_mode: string;
	service_level: string;
	weight_brackets?: RawBracket[] | null;
	metadata?: RouteMetadata | null;
	preferred_driver_id?: number | string | null;
	preferred_driver?: DriverSummary | null;
}

export const TRANSPORT_MODES = [
	{ value: "road", label: "Road" },
	{ value: "air", label: "Air" },
	{ value: "sea", label: "Sea" },
];

export const SERVICE_LEVELS = [
	{ value: "Standard", label: "Standard" },
	{ value: "Express", label: "Express" },
	{ value: "Economy", label: "Economy" },
	{ value: "International Express", label: "International Express" },
];

export const RATE_CURRENCIES = [
	{ value: "NGN", label: "₦ NGN" },
	{ value: "EUR", label: "€ EUR" },
	{ value: "USD", label: "$ USD" },
	{ value: "GBP", label: "£ GBP" },
	{ value: "CNY", label: "¥ CNY" },
];

const MODE_TONE: Record<string, Tone> = { road: "neutral", air: "info", sea: "progress" };
const SERVICE_TONE: Record<string, Tone> = { Standard: "neutral", Express: "warning", Economy: "success", "International Express": "progress" };

export const modeTone = (mode?: string | null): Tone => MODE_TONE[(mode ?? "").toLowerCase()] ?? "neutral";
export const modeLabel = (mode?: string | null) => TRANSPORT_MODES.find((o) => o.value === (mode ?? "").toLowerCase())?.label ?? (mode || "—");
export const serviceTone = (level?: string | null): Tone => SERVICE_TONE[level ?? ""] ?? "neutral";

const toNumber = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : typeof v === "number" ? v : Number(String(v).trim()));

export const routeTitle = (r: Pick<RouteTemplate, "origin_city" | "destination_city">) => `${r.origin_city || "—"} → ${r.destination_city || "—"}`;

/** "Within Nigeria" or "Nigeria → Ghana". */
export function routeCountries(r: RouteTemplate) {
	const from = r.metadata?.origin_country;
	const to = r.metadata?.destination_country;
	if (!from && !to) return "";
	if (from === to) return `Within ${from}`;
	return `${from || "—"} → ${to || "—"}`;
}

/** The kilos a bracket covers — its width, or its max where the width is unusable. */
export function bracketWidth(b: { min: string; max: string }): number | null {
	const min = parseFloat(b.min);
	const max = parseFloat(b.max);
	const width = Number.isNaN(max - min) || max - min <= 0 ? (max > 0 ? max : null) : max - min;
	return width && width > 0 ? width : null;
}

/** Price per kg — the same formula the route form has always used. */
export function calculateUnitPrice(b: { min: string; max: string; price: string }): number | null {
	const price = parseFloat(b.price);
	if (Number.isNaN(price) || price <= 0) return null;
	const width = bracketWidth(b);
	if (!width) return null;
	return Number((price / width).toFixed(2));
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function bracketUnitPrice(b: RawBracket) {
	const stored = toNumber(b.unit_price);
	if (Number.isFinite(stored) && stored > 0) return stored;
	return calculateUnitPrice({ min: str(b.min), max: str(b.max), price: str(b.price) });
}

export function sortedBrackets(r: RouteTemplate): RawBracket[] {
	const list = Array.isArray(r.weight_brackets) ? [...r.weight_brackets] : [];
	return list.sort((a, b) => (toNumber(a.min) || 0) - (toNumber(b.min) || 0));
}

export function lowestPrice(r: RouteTemplate): number | null {
	const prices = (Array.isArray(r.weight_brackets) ? r.weight_brackets : []).map((b) => toNumber(b.price)).filter((n) => Number.isFinite(n));
	return prices.length ? Math.min(...prices) : null;
}

export const formatKg = (v: unknown) => {
	const n = toNumber(v);
	return Number.isFinite(n) ? n.toLocaleString("en-NG", { maximumFractionDigits: 2 }) : "?";
};

/** ₦/kg with kobo precision (formatMoney rounds to whole naira, which hides small per-kg rates). */
export const formatPerKg = (value: number | null) =>
	value === null ? "—" : `${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)}/kg`;

export const driverLabel = (d: DriverSummary) => [d.driver_code || `Driver #${d.id}`, d.vehicle_type, d.user?.email].filter(Boolean).join(" · ");

// ─── Form ────────────────────────────────────────────────────────────────────

export interface BracketDraft {
	key: number;
	min: string;
	max: string;
	price: string;
	/** ₦ per kg. The same money as `price`, read the other way round. */
	rate: string;
	/** Days only, e.g. "3" or "2-3" — saved as "<value> days". */
	eta: string;
}

export interface RouteForm {
	origin: Place;
	destination: Place;
	/** Cross-border lanes only: where the goods land before the last mile. */
	arrivalCity: string;
	arrivalState: string;
	transport_mode: string;
	service_level: string;
	/** "" means no preferred driver. */
	preferred_driver_id: string;
	/** What a kilo costs on this lane. Blank falls back to the brackets. */
	ratePerKg: string;
	rateCurrency: string;
	/** Cross-border lanes only: the inland leg as an amount, in naira. */
	lastMile: string;
	/** Blank means the server-wide charge. "0" means charge nothing here. */
	handlingPercent: string;
	brackets: BracketDraft[];
}

let keySeq = 0;
export const newBracket = (min = ""): BracketDraft => ({ key: ++keySeq, min, max: "", price: "", rate: "", eta: "" });

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * A bracket priced either way round.
 *
 * The rate and the price are one number read two ways, and which one a person
 * has to hand depends on how the lane was sold: a carrier quotes ₦2,925 a kilo,
 * a customer agrees ₦585,000 for the job. Only the price could be typed, so the
 * rate — the figure on the badge, and the one people actually compare between
 * carriers — had to be worked out by hand and re-entered as a total.
 *
 * Typing either fills the other. Moving the weights keeps the price and
 * recalculates the rate, because the price is what was agreed.
 */
/**
 * The brackets restated at a lane rate.
 *
 * A lane priced per kilo overrides its brackets in the quote engine, so a
 * form that leaves the old bracket prices on screen is showing a number the
 * lane will not charge — EUR 10.09/kg beside a bracket reading NGN 8,807.25/kg,
 * the two contradicting each other with nothing to say which wins. Changing
 * the rate rewrites them, so what is on screen is what the lane charges.
 *
 * `nairaPerUnit` converts the lane's currency to the naira the brackets are
 * kept in; it is 1 for a lane already priced in naira.
 */
export function bracketsAtRate(brackets: BracketDraft[], ratePerKg: string, nairaPerUnit: number): BracketDraft[] {
	const rate = parseFloat(ratePerKg);
	if (!ratePerKg.trim() || !Number.isFinite(rate) || rate <= 0 || !(nairaPerUnit > 0)) return brackets;
	const perKgNaira = round2(rate * nairaPerUnit);
	return brackets.map((b) => {
		const width = bracketWidth(b);
		if (!width) return b;
		return { ...b, rate: String(perKgNaira), price: String(round2(perKgNaira * width)) };
	});
}

/** A bracket's ₦/kg expressed back in the lane's own currency. */
export function laneRateFromBracket(bracketRateNaira: string, nairaPerUnit: number): string | null {
	const naira = parseFloat(bracketRateNaira);
	if (!bracketRateNaira.trim() || !Number.isFinite(naira) || naira <= 0 || !(nairaPerUnit > 0)) return null;
	return String(round2(naira / nairaPerUnit));
}

export function syncBracket(b: BracketDraft, field: keyof Omit<BracketDraft, "key">, value: string): BracketDraft {
	const next = { ...b, [field]: value };
	if (field === "eta") return next;
	const width = bracketWidth(next);

	if (field === "rate") {
		const rate = parseFloat(value);
		next.price = value.trim() && Number.isFinite(rate) && rate > 0 && width ? String(round2(rate * width)) : "";
		return next;
	}

	const price = parseFloat(next.price);
	next.rate = next.price.trim() && Number.isFinite(price) && price > 0 && width ? String(round2(price / width)) : "";
	return next;
}

const emptyPlace: Place = { city: "", state: "", country: "", countryCode: "", stateCode: "" };

export const etaValue = (eta?: string | null) => (eta ?? "").replace(/\s*days?\s*$/i, "").trim();

export function formFromRoute(route: RouteTemplate | null): RouteForm {
	if (!route) {
		return { origin: emptyPlace, destination: emptyPlace, arrivalCity: "", arrivalState: "", transport_mode: "road", service_level: "Standard", preferred_driver_id: "", ratePerKg: "", rateCurrency: "NGN", lastMile: "", handlingPercent: "", brackets: [newBracket("0")] };
	}
	return {
		origin: {
			city: route.origin_city,
			anyState: Boolean(route.metadata?.origin_any_state),
			state: route.metadata?.origin_state || "",
			country: route.metadata?.origin_country || "",
			countryCode: route.metadata?.origin_country_code || "",
			stateCode: route.metadata?.origin_state_code || "",
		},
		destination: {
			city: route.destination_city,
			anyState: Boolean(route.metadata?.destination_any_state),
			state: route.metadata?.destination_state || "",
			country: route.metadata?.destination_country || "",
			countryCode: route.metadata?.destination_country_code || "",
			stateCode: route.metadata?.destination_state_code || "",
		},
		arrivalCity: route.metadata?.arrival_city || "",
		arrivalState: route.metadata?.arrival_state || "",
		transport_mode: route.transport_mode,
		service_level: route.service_level,
		preferred_driver_id: route.preferred_driver_id !== null && route.preferred_driver_id !== undefined ? String(route.preferred_driver_id) : "",
		ratePerKg: str(route.metadata?.price_per_kg),
		rateCurrency: (route.metadata?.price_currency || "NGN").toUpperCase(),
		/* A lane still carrying the old per-kilo last mile shows what that
		   works out to, rather than an empty box that would wipe it on save. */
		lastMile: str(route.metadata?.last_mile_flat),
		handlingPercent: str(route.metadata?.service_charge_percent),
		brackets: Array.isArray(route.weight_brackets)
			? route.weight_brackets.map((b) => {
					const draft = { key: ++keySeq, min: str(b.min), max: str(b.max), price: str(b.price), rate: "", eta: etaValue(b.eta) };
					const rate = calculateUnitPrice(draft);
					return { ...draft, rate: rate === null ? "" : String(rate) };
				})
			: [],
	};
}

export type BracketErrors = { min?: string; max?: string; price?: string; eta?: string; overlap?: string };

export interface FormErrors {
	origin?: string;
	destination?: string;
	transport_mode?: string;
	service_level?: string;
	ratePerKg?: string;
	lastMile?: string;
	handlingPercent?: string;
	brackets?: string;
	bracket: BracketErrors[];
	count: number;
}

const ETA_PATTERN = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/;

export function validateRoute(form: RouteForm): FormErrors {
	const errors: FormErrors = { bracket: form.brackets.map(() => ({})), count: 0 };
	if (!form.origin.city.trim()) errors.origin = "Choose the origin city.";
	if (!form.destination.city.trim()) errors.destination = "Choose the destination city.";
	if (!form.transport_mode) errors.transport_mode = "Choose a transport mode.";
	if (!form.service_level) errors.service_level = "Choose a service level.";
	if (!form.brackets.length) errors.brackets = "Add at least one weight bracket.";

	/* Each of these is optional — blank is "as it has always been" — but a
	   number typed here reaches a customer's invoice, so a nonsense one is
	   caught at the form rather than quoted. */
	const rate = toNumber(form.ratePerKg);
	if (form.ratePerKg.trim() && (!Number.isFinite(rate) || rate <= 0)) errors.ratePerKg = "Must be more than 0";
	const lastMile = toNumber(form.lastMile);
	if (form.lastMile.trim() && (!Number.isFinite(lastMile) || lastMile <= 0)) errors.lastMile = "Must be more than 0";
	const handling = toNumber(form.handlingPercent);
	if (form.handlingPercent.trim() && (!Number.isFinite(handling) || handling < 0 || handling > 100)) errors.handlingPercent = "0 to 100";

	form.brackets.forEach((b, i) => {
		const e = errors.bracket[i];
		const min = toNumber(b.min);
		const max = toNumber(b.max);
		const price = toNumber(b.price);
		if (!b.min.trim()) e.min = "Required";
		else if (!Number.isFinite(min) || min < 0) e.min = "Enter 0 or more";
		if (!b.max.trim()) e.max = "Required";
		else if (!Number.isFinite(max)) e.max = "Enter a number";
		else if (Number.isFinite(min) && max <= min) e.max = "Must be more than min";
		if (!b.price.trim()) e.price = "Required";
		else if (!Number.isFinite(price) || price <= 0) e.price = "Must be more than 0";
		const eta = b.eta.trim();
		const match = ETA_PATTERN.exec(eta);
		if (!eta) e.eta = "Required";
		else if (!match) e.eta = "Days, e.g. 3 or 2-3";
		else if (match[2] && Number(match[2]) < Number(match[1])) e.eta = "Range must go up";
	});

	// Brackets may share an edge (0–5, 5–10) but must not overlap.
	const ranges = form.brackets
		.map((b, i) => ({ i, min: toNumber(b.min), max: toNumber(b.max) }))
		.filter((r) => Number.isFinite(r.min) && Number.isFinite(r.max) && r.max > r.min);
	const clashes: number[][] = form.brackets.map(() => []);
	for (let a = 0; a < ranges.length; a++) {
		for (let b = a + 1; b < ranges.length; b++) {
			if (ranges[a].min < ranges[b].max && ranges[b].min < ranges[a].max) {
				clashes[ranges[a].i].push(ranges[b].i + 1);
				clashes[ranges[b].i].push(ranges[a].i + 1);
			}
		}
	}
	clashes.forEach((list, i) => {
		if (list.length) errors.bracket[i].overlap = `Overlaps bracket ${list.join(" and ")}`;
	});

	errors.count =
		[errors.origin, errors.destination, errors.transport_mode, errors.service_level, errors.ratePerKg, errors.lastMile, errors.handlingPercent, errors.brackets].filter(Boolean).length +
		errors.bracket.reduce((n, e) => n + Object.values(e).filter(Boolean).length, 0);
	return errors;
}

export function buildPayload(form: RouteForm) {
	return {
		origin_city: form.origin.city,
		destination_city: form.destination.city,
		transport_mode: form.transport_mode,
		service_level: form.service_level,
		weight_brackets: form.brackets.map((b) => ({
			min: parseFloat(b.min),
			max: parseFloat(b.max),
			price: parseFloat(b.price),
			eta: `${b.eta.trim()} days`,
			unit_price: calculateUnitPrice(b),
		})),
		metadata: {
			origin_state: form.origin.state,
			origin_country: form.origin.country,
			origin_country_code: form.origin.countryCode,
			origin_state_code: form.origin.stateCode,
			destination_state: form.destination.state,
			destination_country: form.destination.country,
			destination_country_code: form.destination.countryCode,
			destination_state_code: form.destination.stateCode,
			origin_any_state: form.origin.anyState || undefined,
			destination_any_state: form.destination.anyState || undefined,
			/* Blank means no last mile, so an empty box leaves the lane as it
			   was rather than writing an empty string nobody can match on. */
			arrival_city: form.arrivalCity.trim() || undefined,
			arrival_state: form.arrivalState.trim() || undefined,
			/* null, not undefined, so emptying a box clears the figure. The
			   server merges metadata over what the lane already has, and
			   JSON.stringify drops undefined — so an undefined here would mean
			   a price could be set and then never taken off again. */
			price_per_kg: form.ratePerKg.trim() ? parseFloat(form.ratePerKg) : null,
			price_currency: form.ratePerKg.trim() ? form.rateCurrency : null,
			last_mile_flat: form.lastMile.trim() ? parseFloat(form.lastMile) : null,
			/* An amount supersedes the old per-kilo last mile: leaving both set
			   would make which one applies depend on reading the pricing code. */
			last_mile_per_kg: form.lastMile.trim() ? null : undefined,
			service_charge_percent: form.handlingPercent.trim() ? parseFloat(form.handlingPercent) : null,
		},
		preferred_driver_id: form.preferred_driver_id || null,
	};
}

export type RoutePayload = ReturnType<typeof buildPayload>;
