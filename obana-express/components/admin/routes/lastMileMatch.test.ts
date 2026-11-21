// Run: npx tsx components/admin/routes/lastMileMatch.test.ts
// No network, no database. This suggests the figure an admin accepts for the
// inland leg of an international shipment, so the routes below are shaped
// like the real ones.

import assert from "node:assert/strict";
import { bracketForWeight, findLastMileRoute } from "./lastMileMatch";
import type { RouteTemplate } from "./model";

const cases: [string, () => void][] = [];
const it = (name: string, fn: () => void) => cases.push([name, fn]);

const route = (
    id: number,
    origin: string,
    dest: string,
    brackets: { min: number; max: number | null; price: number; eta?: string }[],
    extra: Partial<RouteTemplate> = {},
): RouteTemplate =>
    ({
        id,
        origin_city: origin,
        destination_city: dest,
        transport_mode: "road",
        service_level: "Standard",
        weight_brackets: brackets,
        ...extra,
    }) as RouteTemplate;

const LAGOS_PH = route(1, "Lagos", "Port Harcourt", [
    { min: 0, max: 50, price: 180000, eta: "3-5" },
    { min: 50, max: 245, price: 585000, eta: "5-7" },
]);
const LAGOS_ABUJA = route(2, "Lagos", "Abuja", [{ min: 0, max: 245, price: 400000 }]);

/* ── Finding the lane ───────────────────────────────────────────────────── */

it("a route that already exists supplies the price", () => {
    const m = findLastMileRoute([LAGOS_PH, LAGOS_ABUJA], "Lagos", "Port Harcourt", 245);
    assert.equal(m?.price, 585000);
    assert.equal(m?.route.id, 1);
});

it("the bracket matches the weight, not just the first row", () => {
    assert.equal(findLastMileRoute([LAGOS_PH], "Lagos", "Port Harcourt", 10)?.price, 180000);
    assert.equal(findLastMileRoute([LAGOS_PH], "Lagos", "Port Harcourt", 245)?.price, 585000);
});

it("the per-kilo figure is the total over the weight", () => {
    const m = findLastMileRoute([LAGOS_PH], "Lagos", "Port Harcourt", 245);
    assert.ok(Math.abs((m?.perKg ?? 0) - 585000 / 245) < 0.001);
});

it("the ETA comes along, so the leg keeps its timeline", () => {
    assert.equal(findLastMileRoute([LAGOS_PH], "Lagos", "Port Harcourt", 245)?.eta, "5-7");
});

/* ── Spelling, which is what broke this before ──────────────────────────── */

it("case and spacing do not decide whether a lane is found", () => {
    assert.ok(findLastMileRoute([LAGOS_PH], "lagos", "port harcourt", 100));
    assert.ok(findLastMileRoute([LAGOS_PH], "  Lagos ", "Port  Harcourt", 100));
});

it("a state named in metadata matches as well as the city", () => {
    const r = route(3, "Lagos", "Eleme", [{ min: 0, max: 245, price: 300000 }], {
        metadata: { destination_state: "Rivers" } as RouteTemplate["metadata"],
    });
    assert.equal(findLastMileRoute([r], "Lagos", "Rivers", 100)?.price, 300000);
});

/* ── Refusing, rather than guessing ─────────────────────────────────────── */

it("no matching lane suggests nothing at all", () => {
    assert.equal(findLastMileRoute([LAGOS_PH], "Lagos", "Kano", 100), null);
    assert.equal(findLastMileRoute([LAGOS_PH], "Abuja", "Port Harcourt", 100), null);
    assert.equal(findLastMileRoute([], "Lagos", "Port Harcourt", 100), null);
});

it("a lane with no usable price is not a suggestion", () => {
    const empty = route(9, "Lagos", "Port Harcourt", []);
    assert.equal(findLastMileRoute([empty], "Lagos", "Port Harcourt", 100), null);
    const zero = route(10, "Lagos", "Port Harcourt", [{ min: 0, max: 50, price: 0 }]);
    assert.equal(findLastMileRoute([zero], "Lagos", "Port Harcourt", 10), null);
});

it("a blank state or city is not a match", () => {
    assert.equal(findLastMileRoute([LAGOS_PH], "", "Port Harcourt", 100), null);
    assert.equal(findLastMileRoute([LAGOS_PH], "Lagos", "", 100), null);
});

/* ── Choosing between several ───────────────────────────────────────────── */

it("the cheapest road lane wins when several serve the state", () => {
    const dear = route(4, "Lagos", "Port Harcourt", [{ min: 0, max: 245, price: 900000 }]);
    const m = findLastMileRoute([dear, LAGOS_PH], "Lagos", "Port Harcourt", 245);
    assert.equal(m?.price, 585000);
});

it("a named arrival city is preferred over another in the same state", () => {
    const eleme = route(5, "Lagos", "Eleme", [{ min: 0, max: 245, price: 120000 }], {
        metadata: { destination_state: "Rivers" } as RouteTemplate["metadata"],
    });
    const ph = route(6, "Lagos", "Port Harcourt", [{ min: 0, max: 245, price: 585000 }], {
        metadata: { destination_state: "Rivers" } as RouteTemplate["metadata"],
    });
    // Cheapest would be Eleme; naming the city overrides that.
    assert.equal(findLastMileRoute([eleme, ph], "Lagos", "Rivers", 245, "Port Harcourt")?.price, 585000);
});

it("air is not used for a last mile when a road lane exists", () => {
    const air = route(7, "Lagos", "Port Harcourt", [{ min: 0, max: 245, price: 100 }], {
        transport_mode: "air",
    });
    assert.equal(findLastMileRoute([air, LAGOS_PH], "Lagos", "Port Harcourt", 245)?.price, 585000);
});

/* ── Brackets at the edges ──────────────────────────────────────────────── */

it("brackets sharing an edge do not both claim the weight", () => {
    assert.equal(bracketForWeight(LAGOS_PH.weight_brackets, 50)?.price, 180000);
});

it("a weight past the last bracket still prices, on the heaviest", () => {
    assert.equal(bracketForWeight(LAGOS_PH.weight_brackets, 900)?.price, 585000);
});

/* The shape the app actually saves is `min`/`max` — see RawBracket and
   buildPayload. These fixtures used `min_weight`/`max_weight`, so the test
   suite agreed with itself and disagreed with the database: every lookup
   against a real route found no usable bracket and suggested nothing. Both
   spellings are read now, and both are pinned here. */
it("the saved bracket shape (min/max) is what gets priced", () => {
    const r = route(20, "Lagos", "Port Harcourt", [{ min: 0, max: 245, price: 585000, eta: "3-5" }]);
    const hit = findLastMileRoute([r], "Lagos", "Port Harcourt", 245);
    assert.equal(hit?.price, 585000);
});

it("the older min_weight/max_weight spelling still prices", () => {
    const legacy = { id: 21, origin_city: "Lagos", destination_city: "Port Harcourt", transport_mode: "road", service_level: "Standard", weight_brackets: [{ min_weight: 0, max_weight: 245, price: 300000 }], metadata: null } as unknown as RouteTemplate;
    const hit = findLastMileRoute([legacy], "Lagos", "Port Harcourt", 245);
    assert.equal(hit?.price, 300000);
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
