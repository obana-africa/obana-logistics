// Run: npx tsx components/admin/routes/pricing.test.ts
// The precedence these assert is the server's, in routesController:
// perKiloPrice beats priceTemplate, and lastMileFor prefers what the lane
// states over what the domestic routes would charge.

import assert from "node:assert/strict";
import { bracketsDisagreeing, freightAt, lastMileAt, previewQuote, resolveRate } from "./pricing";
import { newBracket, type RouteForm } from "./model";

const cases: [string, () => void][] = [];
const it = (name: string, fn: () => void) => cases.push([name, fn]);

const bracket = (min: string, max: string, price: string, eta = "3-5") => ({ ...newBracket(min), max, price, eta });

const form = (over: Partial<RouteForm> = {}): RouteForm => ({
	origin: { city: "Milan", state: "", country: "Italy", countryCode: "IT", stateCode: "" },
	destination: { city: "Lagos", state: "Lagos", country: "Nigeria", countryCode: "NG", stateCode: "" },
	arrivalCity: "",
	arrivalState: "",
	transport_mode: "air",
	service_level: "International Express",
	preferred_driver_id: "",
	ratePerKg: "",
	rateCurrency: "NGN",
	lastMile: "",
	lastMilePerKg: "",
	lastMileMode: "flat",
	lastMileBrackets: [],
	handlingPercent: "",
	brackets: [bracket("0", "245", "2157776.9")],
	...over,
});

/* ── The conversion rate ─────────────────────────────────────────────────── */

it("a naira lane needs no rate at all", () => {
	assert.deepEqual(resolveRate("NGN", null, ""), { nairaPerUnit: 1, origin: "ngn", asOf: null });
});

it("the live rate is used when there is one", () => {
	const r = resolveRate("EUR", { nairaPerUnit: 1479.29, asOf: "2026-11-20" }, "");
	assert.equal(r.nairaPerUnit, 1479.29);
	assert.equal(r.origin, "live");
});

it("a rate typed by hand beats the feed", () => {
	assert.equal(resolveRate("EUR", { nairaPerUnit: 1479.29 }, "1500").nairaPerUnit, 1500);
});

it("a failed fetch is not the end of it — a typed rate still converts", () => {
	const r = resolveRate("EUR", null, "1500");
	assert.equal(r.nairaPerUnit, 1500);
	assert.equal(r.origin, "manual");
});

it("nothing live and nothing typed converts nothing, rather than guessing", () => {
	assert.equal(resolveRate("EUR", null, "").nairaPerUnit, 0);
});

/* ── Freight ─────────────────────────────────────────────────────────────── */

it("a per-kilo rate outranks the brackets, as on the server", () => {
	const f = freightAt(form({ ratePerKg: "12", rateCurrency: "EUR" }), 1479.29, 245);
	assert.equal(f.from, "rate");
	assert.equal(f.base, 4349112.6); // 12 × 1479.29 × 245
});

it("without a convertible rate the bracket is what gets charged", () => {
	const f = freightAt(form({ ratePerKg: "12", rateCurrency: "EUR" }), 0, 245);
	assert.equal(f.from, "bracket");
	assert.equal(f.base, 2157776.9);
});

it("the bracket covering the weight is the one used", () => {
	const f = freightAt(form({ brackets: [bracket("0", "50", "180000"), bracket("50", "245", "585000")] }), 1, 100);
	assert.equal(f.base, 585000);
});

it("over the heaviest bracket the price scales, the way priceTemplate scales it", () => {
	const f = freightAt(form({ brackets: [bracket("0", "100", "100000")] }), 1, 200);
	assert.equal(f.base, 200000);
});

it("a lane with no usable price quotes nothing rather than zero-looking money", () => {
	assert.equal(freightAt(form({ brackets: [] }), 1, 245).from, "none");
});

/* ── The inland leg ──────────────────────────────────────────────────────── */

it("no arrival named means no second leg, exactly as before", () => {
	assert.equal(lastMileAt(form({ lastMile: "585000" }), 245).from, "none");
});

it("an amount is charged whatever it weighs", () => {
	const l = lastMileAt(form({ arrivalState: "Rivers", lastMile: "585000" }), 10);
	assert.equal(l.base, 585000);
	assert.equal(l.from, "flat");
});

it("weight brackets price the inland leg by what it actually is", () => {
	const f = form({
		arrivalState: "Rivers",
		lastMileMode: "brackets",
		lastMileBrackets: [bracket("0", "35", "120000"), bracket("35", "245", "585000")],
	});
	assert.equal(lastMileAt(f, 30).base, 120000);
	assert.equal(lastMileAt(f, 200).base, 585000);
});

it("a per-kilo last mile scales with the load", () => {
	const l = lastMileAt(form({ arrivalState: "Rivers", lastMileMode: "perKg", lastMilePerKg: "2387.76" }), 245);
	assert.equal(l.from, "perKg");
	assert.equal(l.base, 585001.2);
});

it("only the mode in force prices the inland leg", () => {
	/* All three filled in, which the form no longer allows — the mode is
	   what decides, so a figure left over from another mode is ignored
	   rather than quietly winning. */
	const f = form({
		arrivalState: "Rivers",
		lastMile: "585000",
		lastMilePerKg: "2387.76",
		lastMileMode: "brackets",
		lastMileBrackets: [bracket("0", "245", "120000")],
	});
	assert.equal(lastMileAt(f, 245).from, "brackets");
	assert.equal(lastMileAt(f, 245).base, 120000);
});

it("stating neither falls back to the domestic routes, as it always has", () => {
	assert.equal(lastMileAt(form({ arrivalState: "Rivers" }), 245).from, "domestic");
});

/* ── The whole quote ─────────────────────────────────────────────────────── */

it("the parts add up to the total", () => {
	const q = previewQuote(form({ ratePerKg: "12", rateCurrency: "EUR", arrivalState: "Rivers", lastMile: "585000", handlingPercent: "10" }), 1479.29, 245, 10);
	assert.equal(q.freight.base, 4349112.6);
	assert.equal(q.handling, 434911.26);
	assert.equal(q.lastMile.base, 585000);
	/* Rounded to the kobo, not left as the raw float sum: a total that ends
	   .859999999 is the kind of number that makes a customer query an invoice. */
	assert.equal(q.total, 5369023.86);
});

it("the charge is taken on the freight, not on the inland leg", () => {
	const q = previewQuote(form({ arrivalState: "Rivers", lastMile: "1000000", handlingPercent: "10" }), 1, 245, 10);
	assert.equal(q.handling, Math.round(2157776.9 * 10) / 100);
});

it("an empty handling box uses the server-wide charge", () => {
	assert.equal(previewQuote(form(), 1, 245, 7.5).handlingPercent, 7.5);
});

it("a handling of 0 is honoured and is not read as empty", () => {
	assert.equal(previewQuote(form({ handlingPercent: "0" }), 1, 245, 10).handling, 0);
});

/* ── Rate and brackets in step ───────────────────────────────────────────── */

it("a bracket that matches the rate is not flagged", () => {
	// 12 EUR × 1479.29 × 245 = 4,349,112.6
	const f = form({ ratePerKg: "12", rateCurrency: "EUR", brackets: [bracket("0", "245", "4349112.6")] });
	assert.deepEqual(bracketsDisagreeing(f, 1479.29), []);
});

it("a bracket left behind at the old price is flagged", () => {
	const f = form({ ratePerKg: "12", rateCurrency: "EUR", brackets: [bracket("0", "245", "2157776.9")] });
	assert.deepEqual(bracketsDisagreeing(f, 1479.29), [0]);
});

it("nothing is flagged while there is no rate to compare against", () => {
	assert.deepEqual(bracketsDisagreeing(form({ ratePerKg: "12" }), 0), []);
});

let failed = 0;
for (const [name, fn] of cases) {
	try {
		fn();
		console.log(`  ok  ${name}`);
	} catch (e) {
		failed++;
		console.error(`FAIL  ${name}\n      ${(e as Error).message}`);
	}
}
console.log(failed ? `\n${failed} failing` : `\n${cases.length} passing`);
process.exit(failed ? 1 : 0);
