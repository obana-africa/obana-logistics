/* Where ₦2.9m for a trip across Lagos came from, and what stops the next one.
 *
 * A sales-partner cart held 195 units of a 1 kg item. The lane was Lagos
 * Island → Lekki, a half-hour drive. The quote was ₦2,895,751.
 *
 * Nothing threw. The arithmetic was right and the answer was nonsense, which
 * is the dangerous shape: an invented number is indistinguishable from a
 * quoted one all the way to the customer.
 *
 * The weight was NOT the problem, and neither was its unit — the marketplace
 * records kg and the checkout sends kg. The problem was the lane: its
 * heaviest bracket is ONE KILO at ₦13,500, so pro rata charged ₦13,500/kg.
 * The seeded ladder for the same corridor tops out at 20–50 kg for ₦9,000 —
 * ₦180/kg — and prices the same 195 kg at ₦38,610.
 *
 * So these pin the distinction: a table with a real heavy bracket may be
 * stretched a long way, and a parcel-only table may not be stretched at all.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/* The pricing functions, without the database the module pulls in at import.
   Same approach as pricingOverrides.test.js, for the same reason: these are
   pure arithmetic and should be testable without a Postgres. */
const src = fs.readFileSync(path.join(__dirname, '..', 'routesController.js'), 'utf8');
const from = src.indexOf('const MIN_EXTRAPOLATION_KG =');
const to = src.indexOf('const buildTemplateMatch =');
// eslint-disable-next-line no-eval
const { priceTemplate, MIN_EXTRAPOLATION_KG, OVERWEIGHT_FACTOR_MAX } = eval(
    `(() => { ${src.slice(from, to)} ; return { priceTemplate, MIN_EXTRAPOLATION_KG, OVERWEIGHT_FACTOR_MAX }; })()`,
);

/** The seeded Lagos Standard ladder: ₦3,000 × the weight factors. */
const lagosLadder = {
    metadata: { service_charge_percent: 10 },
    weight_brackets: [
        { min: 0, max: 1, price: 1350 },
        { min: 1, max: 2, price: 1650 },
        { min: 2, max: 5, price: 2250 },
        { min: 5, max: 10, price: 3000 },
        { min: 10, max: 20, price: 4800 },
        { min: 20, max: 50, price: 9000, eta: '1-2 days' },
    ],
};

/** The lane that produced the report: one bracket, one kilo, a parcel price. */
const parcelOnlyLane = {
    metadata: { service_charge_percent: 10 },
    weight_brackets: [{ min: 0, max: 1, price: 13500, eta: '1-2 days' }],
};

test('inside the table, a lane charges what the table says', () => {
    const m = priceTemplate(lagosLadder, 8);
    assert.equal(m.base_price, 3000);
    assert.equal(m.price, 3300);
    assert.ok(!m.is_overweight);
});

/* The heart of it. A real heavy bracket implies a real rate, so stretching it
   gives a courier's answer and must not be refused. */
test('a real consignment on a real table is priced, not refused', () => {
    for (const [weight, expected] of [
        [97.5, 19305],
        [200, 39600],
        [300, 59400],
        [1000, 198000],
    ]) {
        const m = priceTemplate(lagosLadder, weight);
        assert.ok(m, `${weight}kg should still be priced`);
        assert.equal(m.price, expected, `${weight}kg`);
        assert.equal(m.implied_rate_per_kg, 180);
    }
});

test('the reported cart: a parcel-only table may not be stretched at all', () => {
    /* What it produced, by the arithmetic that is still used where it applies:
         13,500 × (195 / 1) = 2,632,500
         + 10%              =   263,250
                              2,895,750  — the figure on the quote. */
    const base = 13500 * (195 / 1);
    assert.equal(base, 2632500);
    assert.equal(base + base * 0.1, 2895750);

    // And now: nothing, because a one-kilo bracket is not evidence about 195 kg.
    assert.equal(priceTemplate(parcelOnlyLane, 195), null);
    // Not even a little over. The table ends where the parcel ends.
    assert.equal(priceTemplate(parcelOnlyLane, 1.5), null);
    // Inside its one bracket it still works, so the lane is not broken.
    assert.equal(priceTemplate(parcelOnlyLane, 0.9).price, 14850);
});

test('the same cart on the properly laddered lane costs what it should', () => {
    const m = priceTemplate(lagosLadder, 195);
    assert.equal(m.price, 38610);
    assert.equal(m.over_bracket_factor, 3.9);
    assert.equal(m.chargeable_weight, 195);
    assert.equal(m.bracket_max, 50);
});

/* The guard is on the bracket, not the weight — so the boundary that matters
   is how heavy the top bracket is, not how heavy the parcel is. */
test('ten kilos is where a table starts saying something about consignments', () => {
    const at = (max) => ({
        metadata: { service_charge_percent: 0 },
        weight_brackets: [{ min: 0, max, price: 3000 }],
    });
    assert.equal(priceTemplate(at(MIN_EXTRAPOLATION_KG - 0.01), 50), null);
    assert.ok(priceTemplate(at(MIN_EXTRAPOLATION_KG), 50));
});

test('past the factor even a good table stops answering', () => {
    const edge = 50 * OVERWEIGHT_FACTOR_MAX;
    assert.ok(priceTemplate(lagosLadder, edge), 'at the factor it still prices');
    assert.equal(priceTemplate(lagosLadder, edge + 0.01), null, 'past it, it does not');
});

/* A lane that states a per-kilo rate HAS made a claim about any weight, so
   none of this is its business: priceTemplate declines and the caller prices
   it from the rate. This pins that declining is ALL this does. */
test('declining leaves a per-kilo lane free to price it', () => {
    const rated = {
        metadata: { price_per_kg: 400, price_currency: 'NGN', service_charge_percent: 10 },
        weight_brackets: [{ min: 0, max: 1, price: 13500 }],
    };
    assert.equal(priceTemplate(rated, 195), null);
    // 400 × 195 = 78,000 — a number someone agreed, not one multiplied out.
    assert.equal(400 * 195, 78000);
});

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
