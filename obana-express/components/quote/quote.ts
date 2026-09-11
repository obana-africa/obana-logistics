// Helpers for the public quote page: places, currencies, money formatting and the links it hands off to.

import type { PublicQuoteRequest } from "@/lib/api";
import { formatMoney } from "@/lib/shipments";

export type Place = { city: string; state: string; country: string; countryCode: string; stateCode: string };

export const emptyPlace = (countryCode: string, country: string): Place => ({ city: "", state: "", stateCode: "", country, countryCode });

// Europe → Africa is the core lane, so a new quote starts there.
export const DEFAULT_ORIGIN = emptyPlace("GB", "United Kingdom");
export const DEFAULT_DESTINATION = emptyPlace("NG", "Nigeria");

export const MIN_KG = 0.1;
export const MAX_KG = 1000;
export const WEIGHT_CHIPS = [0.5, 2, 5, 10, 25];

// Countries paying in euro (eurozone members plus the microstates that use it).
const EURO = new Set(["AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES", "AD", "MC", "SM", "VA", "ME", "XK"]);
const LOCAL: Record<string, string> = { GB: "GBP", US: "USD", NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR" };

/** The currency a sender in this country most likely thinks in. */
export function currencyFor(countryCode: string) {
	const code = countryCode.toUpperCase();
	if (EURO.has(code)) return "EUR";
	return LOCAL[code] ?? "USD";
}

export const CURRENCIES = [
	{ value: "GBP", label: "GBP · British pound" },
	{ value: "EUR", label: "EUR · Euro" },
	{ value: "USD", label: "USD · US dollar" },
	{ value: "NGN", label: "NGN · Nigerian naira" },
	{ value: "GHS", label: "GHS · Ghanaian cedi" },
	{ value: "KES", label: "KES · Kenyan shilling" },
	{ value: "ZAR", label: "ZAR · South African rand" },
	{ value: "CAD", label: "CAD · Canadian dollar" },
	{ value: "CHF", label: "CHF · Swiss franc" },
	{ value: "SEK", label: "SEK · Swedish krona" },
	{ value: "NOK", label: "NOK · Norwegian krone" },
	{ value: "DKK", label: "DKK · Danish krone" },
	{ value: "PLN", label: "PLN · Polish złoty" },
	{ value: "XOF", label: "XOF · West African CFA franc" },
	{ value: "XAF", label: "XAF · Central African CFA franc" },
];
const CURRENCY_CODES = new Set(CURRENCIES.map((c) => c.value));

/** Money in any ISO currency. Naira in whole units (as everywhere in the app), others with their usual decimals. */
export function formatPrice(amount: number, currency: string) {
	if (currency === "NGN") return formatMoney(amount, "NGN");
	try {
		return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(amount);
	} catch {
		return `${currency} ${amount.toLocaleString()}`;
	}
}

export function countryName(code: string) {
	try {
		return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
	} catch {
		return code;
	}
}

export const placeLabel = (p: Place) => [p.city, p.country].filter(Boolean).join(", ");

/** What the landing page (or a shared link) can pass: ?from=GB&to=NG&kg=5&currency=EUR&value=150000. Unknown params are ignored. */
export type Prefill = { origin?: Place; destination?: Place; weight?: string; declared?: string; currency?: string };

export function parsePrefill(search: string): Prefill {
	const q = new URLSearchParams(search);
	const out: Prefill = {};
	const country = (key: string) => {
		const code = (q.get(key) ?? "").trim().toUpperCase();
		return /^[A-Z]{2}$/.test(code) ? emptyPlace(code, countryName(code)) : undefined;
	};
	out.origin = country("from");
	out.destination = country("to");
	const kg = parseFloat(q.get("kg") ?? q.get("weight") ?? "");
	if (kg >= MIN_KG && kg <= MAX_KG) out.weight = String(kg);
	const value = parseFloat(q.get("value") ?? "");
	if (value > 0) out.declared = String(value);
	const currency = (q.get("currency") ?? "").toUpperCase();
	if (CURRENCY_CODES.has(currency)) out.currency = currency;
	return out;
}

const toApi = (p: Place) => ({ country: p.country, country_code: p.countryCode, state: p.state, state_code: p.stateCode, city: p.city.trim() });

export function buildRequest(origin: Place, destination: Place, weight: string, declared: string, currency: string): PublicQuoteRequest {
	const body: PublicQuoteRequest = { origin: toApi(origin), destination: toApi(destination), weight_kg: Number(parseFloat(weight).toFixed(2)) };
	const value = parseFloat(declared);
	if (value > 0) body.declared_value = value;
	body.display_currency = currency;
	return body;
}

/** New-shipment form, prefilled with the quoted route and weight. */
export function bookingPath(body: PublicQuoteRequest) {
	const q = new URLSearchParams();
	for (const [side, p] of [["pickup", body.origin], ["delivery", body.destination]] as const) {
		q.set(`${side}_country`, p.country);
		q.set(`${side}_country_code`, p.country_code);
		q.set(`${side}_state`, p.state);
		q.set(`${side}_state_code`, p.state_code);
		q.set(`${side}_city`, p.city);
	}
	q.set("weight", String(body.weight_kg));
	return `/dashboard/customer/shipments/new?${q.toString()}`;
}

export const withNext = (path: "/auth/signup" | "/auth/login", next: string) => `${path}?next=${encodeURIComponent(next)}`;

/**
 * Where to go after sign-in: only a path on this site ("/…"), never "//evil.com", "/\evil.com",
 * a full URL or anything with control characters. Returns null when it isn't safe.
 */
export function safeNextPath(next: string | null | undefined) {
	if (!next || !next.startsWith("/") || next.startsWith("//") || /[\s\\]/.test(next)) return null;
	if (Array.from(next).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return null;
	if (typeof window !== "undefined") {
		try {
			if (new URL(next, window.location.origin).origin !== window.location.origin) return null;
		} catch {
			return null;
		}
	}
	return next;
}
