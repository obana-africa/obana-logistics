// Route template types, display helpers, validation and the API payload for the admin Routes & pricing screen.
import type { Tone } from "@/lib/shipments";

export type Place = { city: string; state: string; country: string; countryCode: string; stateCode: string };

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

/** Price per kg — the same formula the route form has always used (bracket width, or max when the width is unusable). */
export function calculateUnitPrice(b: { min: string; max: string; price: string }): number | null {
	const min = parseFloat(b.min);
	const max = parseFloat(b.max);
	const price = parseFloat(b.price);
	if (Number.isNaN(price) || price <= 0) return null;
	const width = Number.isNaN(max - min) || max - min <= 0 ? (max > 0 ? max : null) : max - min;
	if (!width || width <= 0) return null;
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
	/** Days only, e.g. "3" or "2-3" — saved as "<value> days". */
	eta: string;
}

export interface RouteForm {
	origin: Place;
	destination: Place;
	transport_mode: string;
	service_level: string;
	/** "" means no preferred driver. */
	preferred_driver_id: string;
	brackets: BracketDraft[];
}

let keySeq = 0;
export const newBracket = (min = ""): BracketDraft => ({ key: ++keySeq, min, max: "", price: "", eta: "" });

const emptyPlace: Place = { city: "", state: "", country: "", countryCode: "", stateCode: "" };

export const etaValue = (eta?: string | null) => (eta ?? "").replace(/\s*days?\s*$/i, "").trim();

export function formFromRoute(route: RouteTemplate | null): RouteForm {
	if (!route) {
		return { origin: emptyPlace, destination: emptyPlace, transport_mode: "road", service_level: "Standard", preferred_driver_id: "", brackets: [newBracket("0")] };
	}
	return {
		origin: {
			city: route.origin_city,
			state: route.metadata?.origin_state || "",
			country: route.metadata?.origin_country || "",
			countryCode: route.metadata?.origin_country_code || "",
			stateCode: route.metadata?.origin_state_code || "",
		},
		destination: {
			city: route.destination_city,
			state: route.metadata?.destination_state || "",
			country: route.metadata?.destination_country || "",
			countryCode: route.metadata?.destination_country_code || "",
			stateCode: route.metadata?.destination_state_code || "",
		},
		transport_mode: route.transport_mode,
		service_level: route.service_level,
		preferred_driver_id: route.preferred_driver_id !== null && route.preferred_driver_id !== undefined ? String(route.preferred_driver_id) : "",
		brackets: Array.isArray(route.weight_brackets)
			? route.weight_brackets.map((b) => ({ key: ++keySeq, min: str(b.min), max: str(b.max), price: str(b.price), eta: etaValue(b.eta) }))
			: [],
	};
}

export type BracketErrors = { min?: string; max?: string; price?: string; eta?: string; overlap?: string };

export interface FormErrors {
	origin?: string;
	destination?: string;
	transport_mode?: string;
	service_level?: string;
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
		[errors.origin, errors.destination, errors.transport_mode, errors.service_level, errors.brackets].filter(Boolean).length +
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
		},
		preferred_driver_id: form.preferred_driver_id || null,
	};
}

export type RoutePayload = ReturnType<typeof buildPayload>;
