/**
 * What this lane will actually charge.
 *
 * The route form held two prices that could disagree: a rate at the top
 * ("EUR 10.09/kg") and weight brackets at the bottom ("NGN 8,807.25/kg"),
 * with nothing on screen saying which one a shipment would be billed at. The
 * answer was in the server: `perKiloPrice` wins, and the brackets are only
 * reached when the lane has no rate, or when the rate's currency cannot be
 * converted that day. So the brackets are not a second price — they are the
 * fallback — and the two have to be kept in step or an FX outage silently
 * changes what a customer pays.
 *
 * This module is that rule, written once, so the form can show the figure
 * rather than leave an admin to guess it. Every function here is pure and
 * mirrors `routesController.matchTemplate`; the precedence comments name the
 * server function each branch corresponds to.
 */

import { bracketForWeight } from "./lastMileMatch";
import { bracketWidth, type BracketDraft, type RouteForm } from "./model";

const num = (v: unknown) => {
	const n = typeof v === "number" ? v : Number(String(v ?? "").trim().replace(/,/g, ""));
	return Number.isFinite(n) ? n : NaN;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ── The conversion rate ─────────────────────────────────────────────────── */

export type RateOrigin = "ngn" | "live" | "manual" | "none";

export type LaneRate = {
	/** Naira for one unit of the lane's currency. 0 when nothing can convert. */
	nairaPerUnit: number;
	origin: RateOrigin;
	asOf: string | null;
};

/**
 * The rate the form converts at.
 *
 * A lane in naira is always 1. Otherwise a live rate is used, and an admin
 * may override it — which is the whole point of this function: the form used
 * to go dead whenever the rate call failed, because every conversion was
 * gated on it. A rate that cannot be fetched is now a box to fill in, not a
 * form that quietly stops responding. Typed beats live, because a person
 * looking at today's bank rate knows something the feed does not.
 *
 * The rate is never saved on the lane. The server converts at quote time with
 * its own feed, so a rate typed here moves the brackets on screen and nothing
 * else — which is exactly what it is for.
 */
export function resolveRate(currency: string, live: { nairaPerUnit: number; asOf?: string | null } | null, manual: string): LaneRate {
	if ((currency || "NGN").toUpperCase() === "NGN") return { nairaPerUnit: 1, origin: "ngn", asOf: null };
	const typed = num(manual);
	if (manual.trim() && typed > 0) return { nairaPerUnit: typed, origin: "manual", asOf: null };
	const feed = num(live?.nairaPerUnit);
	if (feed > 0) return { nairaPerUnit: feed, origin: "live", asOf: live?.asOf ?? null };
	return { nairaPerUnit: 0, origin: "none", asOf: null };
}

/* ── The freight leg ─────────────────────────────────────────────────────── */

export type FreightSource = "rate" | "bracket" | "none";

export type FreightQuote = {
	/** Naira, before Obana's charge. */
	base: number;
	from: FreightSource;
	/** The bracket that priced it, when one did. */
	bracketLabel: string | null;
};

/**
 * The crossing, at this weight.
 *
 * Mirrors matchTemplate: a per-kilo rate that can be converted outranks the
 * brackets (`perKiloPrice`), and everything else falls to `priceTemplate`,
 * which charges the bracket covering the weight and extrapolates past the
 * heaviest one.
 */
export function freightAt(form: RouteForm, nairaPerUnit: number, weight: number): FreightQuote {
	const rate = num(form.ratePerKg);
	if (form.ratePerKg.trim() && rate > 0 && nairaPerUnit > 0 && weight > 0) {
		return { base: round2(rate * nairaPerUnit * weight), from: "rate", bracketLabel: null };
	}

	const rows = form.brackets.filter((b) => num(b.price) > 0 && Number.isFinite(num(b.min)));
	const hit = bracketForWeight(
		rows.map((b) => ({ min: num(b.min), max: num(b.max), price: num(b.price), eta: b.eta })),
		weight,
	);
	if (!hit) return { base: 0, from: "none", bracketLabel: null };

	const max = num(hit.max);
	const price = num(hit.price);
	/* Past the heaviest bracket the server scales it rather than refusing —
	   priceTemplate's is_overweight branch, reproduced so a 400 kg preview on
	   a lane that stops at 245 shows what it will really be billed. */
	const base = weight > max && max > 0 ? price + ((weight - max) * price) / max : price;
	return { base: round2(base), from: "bracket", bracketLabel: `${hit.min}–${hit.max} kg` };
}

/* ── The inland leg ──────────────────────────────────────────────────────── */

export type LastMileSource = "brackets" | "flat" | "perKg" | "domestic" | "none";

export type LastMileQuote = { base: number; from: LastMileSource; label: string | null };

/**
 * Door delivery after the goods land.
 *
 * Mirrors `lastMileFor`: an amount stated on the lane is used before any
 * rate, and a lane that states nothing falls back to the domestic routes.
 * Weight brackets are the most specific case and are checked first — a lane
 * that has them has said what each weight costs, which is more than either
 * of the others say.
 *
 * The form only ever saves the mode in force, so in practice exactly one of
 * the three can apply. Reading the mode here rather than the three fields
 * keeps this preview saying the same thing the save will write.
 *
 * Nothing at all when the lane has no arrival city: without one there is no
 * second leg to charge, which is how every lane behaved before any of this.
 */
export function lastMileAt(form: RouteForm, weight: number): LastMileQuote {
	if (!form.arrivalState.trim() && !form.arrivalCity.trim()) return { base: 0, from: "none", label: null };

	if (form.lastMileMode === "brackets") {
		const rows = form.lastMileBrackets.filter((b) => num(b.price) > 0 && Number.isFinite(num(b.min)));
		const hit = bracketForWeight(
			rows.map((b) => ({ min: num(b.min), max: num(b.max), price: num(b.price), eta: b.eta })),
			weight,
		);
		if (hit) {
			/* Past the end of the table the price is carried up at that
			   bracket's own rate per kilo, the same way the freight is and
			   the same way priceFromBrackets does it on the server. A table
			   that stopped reading the weight at its maximum charged a 45 kg
			   delivery the 25 kg price. */
			const price = num(hit.price);
			const max = num(hit.max);
			const over = Number.isFinite(max) && max > 0 && weight > max;
			const base = over ? price + ((weight - max) * price) / max : price;
			return { base: round2(base), from: "brackets", label: over ? `${hit.min}–${hit.max} kg, carried up` : `${hit.min}–${hit.max} kg` };
		}
		return { base: 0, from: "none", label: null };
	}

	if (form.lastMileMode === "perKg") {
		const rate = num(form.lastMilePerKg);
		if (form.lastMilePerKg.trim() && rate > 0 && weight > 0) return { base: round2(rate * weight), from: "perKg", label: null };
		return { base: 0, from: "domestic", label: null };
	}

	const flat = num(form.lastMile);
	if (form.lastMile.trim() && flat > 0) return { base: round2(flat), from: "flat", label: null };
	return { base: 0, from: "domestic", label: null };
}

/* ── The whole quote ─────────────────────────────────────────────────────── */

export type QuotePreview = {
	weight: number;
	freight: FreightQuote;
	lastMile: LastMileQuote;
	handlingPercent: number;
	/** Obana's charge, worked out on the freight — matchTemplate's split. */
	handling: number;
	total: number;
};

/**
 * Freight, Obana's charge on it, and the inland leg, adding to the total.
 *
 * The charge is taken on the freight alone because that is where the server
 * takes it: `match.service_charge` is a percentage of `base_price`, and the
 * last mile arrives as a leg of its own with its own price. Showing it any
 * other way would make the preview disagree with the invoice.
 */
export function previewQuote(form: RouteForm, nairaPerUnit: number, weight: number, defaultHandlingPercent: number): QuotePreview {
	const freight = freightAt(form, nairaPerUnit, weight);
	const lastMile = lastMileAt(form, weight);
	const typed = num(form.handlingPercent);
	const handlingPercent = form.handlingPercent.trim() && typed >= 0 ? typed : defaultHandlingPercent;
	const handling = round2((freight.base * handlingPercent) / 100);
	return { weight, freight, lastMile, handlingPercent, handling, total: round2(freight.base + handling + lastMile.base) };
}

/* ── Keeping the two in step ─────────────────────────────────────────────── */

/**
 * Whether the brackets still say what the rate says.
 *
 * They are the fallback, so they only matter on a day the currency cannot be
 * converted — which is precisely the day nobody is watching. A bracket that
 * drifted from the rate is a price the lane will charge when the feed is
 * down, so the form says which ones disagree rather than waiting for a
 * customer to find out.
 */
export function bracketsDisagreeing(form: RouteForm, nairaPerUnit: number): number[] {
	const rate = num(form.ratePerKg);
	if (!form.ratePerKg.trim() || !(rate > 0) || !(nairaPerUnit > 0)) return [];
	const perKg = round2(rate * nairaPerUnit);
	const out: number[] = [];
	form.brackets.forEach((b: BracketDraft, i) => {
		const width = bracketWidth(b);
		const price = num(b.price);
		if (!width || !(price > 0)) return;
		/* A naira either way is rounding, not disagreement. */
		if (Math.abs(price - perKg * width) > 1) out.push(i);
	});
	return out;
}
