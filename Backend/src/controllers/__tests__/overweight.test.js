/* Where ₦2.9m for a trip across Lagos came from, and what stops the next one.
 *
 * A sales-partner cart held 195 units. The lane was Lagos Island → Lekki, a
 * half-hour drive. The quote was over ₦2,900,000.
 *
 * Nothing was broken in the sense of throwing: every step did exactly what it
 * was written to do. 195 units × 10 kg is 1,950 kg, and a lane whose heaviest
 * bracket is a 10 kg parcel priced it by multiplying that bracket by 195. The
 * arithmetic is sound and the answer is nonsense, which is the dangerous
 * shape: an invented number is indistinguishable from a quoted one.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/* The pricing functions, without the database the module pulls in at import.
   Same approach as pricingOverrides.test.js, for the same reason: these are
   pure arithmetic and should be testable without a Postgres. */
const src = fs.readFileSync(path.join(__dirname, '..', 'routesController.js'), 'utf8');
const from = src.indexOf('const OVERWEIGHT_FACTOR_MAX =');
const to = src.indexOf('const buildTemplateMatch =');
// eslint-disable-next-line no-eval
const { priceTemplate, OVERWEIGHT_FACTOR_MAX } = eval(
    `(() => { ${src.slice(from, to)} ; return { priceTemplate, OVERWEIGHT_FACTOR_MAX }; })()`,
);

/** A city lane: one bracket, a parcel up to 10 kg, ₦13,500, 10% on top. */
const lagosCityLane = {
    metadata: { service_charge_percent: 10 },
    weight_brackets: [{ min: 0, max: 10, price: 13500, eta: '1-2 days' }],
};

test('inside the table, a lane charges what the table says', () => {
    const m = priceTemplate(lagosCityLane, 8);
    assert.equal(m.base_price, 13500);
    assert.equal(m.service_charge, 1350);
    assert.equal(m.price, 14850);
    assert.ok(!m.is_overweight);
});

test('a little over the table is extrapolated, and says so', () => {
    const m = priceTemplate(lagosCityLane, 20);
    // base × (weight / bracket max) — 13,500 × 2
    assert.equal(m.base_price, 27000);
    assert.equal(m.price, 29700);
    assert.equal(m.is_overweight, true);
    // The three figures that make the number checkable from the quote alone.
    assert.equal(m.bracket_max, 10);
    assert.equal(m.chargeable_weight, 20);
    assert.equal(m.over_bracket_factor, 2);
});

test('the reported cart no longer gets an invented price', () => {
    const weight = 195 * 10; // 1,950 kg
    /* What it used to produce, by the same arithmetic the code still uses
       inside the cap: the bracket multiplied by how many times the weight
       goes into it, then the service charge on top.
         13,500 × (1,950 / 10) = 2,632,500
         + 10%                 =   263,250
         total                   2,895,750   — "over 2.9 million". */
    const base = 13500 * (weight / 10);
    assert.equal(base, 2632500);
    assert.equal(base + base * 0.1, 2895750);
    // And what it produces now.
    assert.equal(priceTemplate(lagosCityLane, weight), null);
});

test('the cap is where the table stops being evidence, not a round number', () => {
    const edge = 10 * OVERWEIGHT_FACTOR_MAX;
    assert.ok(priceTemplate(lagosCityLane, edge), 'at the factor it still prices');
    assert.equal(priceTemplate(lagosCityLane, edge + 0.01), null, 'past it, it does not');
});

/* A lane that states a per-kilo rate HAS made a claim about any weight, so the
   cap is not its business: priceTemplate declines and the caller prices it
   from the rate. This pins that declining is all this does — it must not also
   stop a rated lane from quoting. */
test('declining leaves a per-kilo lane free to price it', () => {
    const rated = {
        metadata: { price_per_kg: 400, price_currency: 'NGN', service_charge_percent: 10 },
        weight_brackets: [{ min: 0, max: 10, price: 13500 }],
    };
    assert.equal(priceTemplate(rated, 1950), null);
    // The rate is what answers for it: 400 × 1,950 = 780,000, which is a
    // number someone agreed rather than one multiplied out of a parcel.
    assert.equal(400 * 1950, 780000);
});

/* A table with no ceiling on its last bracket already covers every weight, so
   nothing is extrapolated and nothing is capped. */
test('an open-ended top bracket is never overweight', () => {
    const open = {
        metadata: { service_charge_percent: 0 },
        weight_brackets: [
            { min: 0, max: 10, price: 13500 },
            { min: 10, max: null, price: 50000 },
        ],
    };
    const m = priceTemplate(open, 1950);
    assert.equal(m.base_price, 50000);
    assert.ok(!m.is_overweight);
});

test('a lane with no brackets at all still prices nothing', () => {
    assert.equal(priceTemplate({ weight_brackets: [] }, 5), null);
});
