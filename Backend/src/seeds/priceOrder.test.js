// Run: node src/seeds/priceOrder.test.js
// No database and no test runner — the reordering is a pure function, and it
// is the part of the migration that can actually be wrong. The figures below
// are the ones the live API was returning when this was written.

const assert = require('assert');
const { laneKeyOf, orderLaneBySpeed, orderTableBySpeed } = require('./priceOrder');

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

const LAGOS = {
    origin_state: 'Lagos',
    origin_country_code: 'NG',
    destination_state: 'Lagos',
    destination_country_code: 'NG',
};

const route = (id, service_level, price, eta, extra = {}) => ({
    id,
    transport_mode: 'road',
    service_level,
    metadata: { ...LAGOS, ...(extra.metadata || {}) },
    weight_brackets: [{ min: 0, max: 10, price, eta, unit_price: Number((price / 10).toFixed(2)) }],
    ...extra,
});

/* ── the lane that was reported ─────────────────────────────────────── */

it('puts the dearer price on the faster service', () => {
    // What theoutletng.thaja.africa/checkout was showing: Express at ₦8,000
    // and Standard at ₦11,000, so the slower option cost more.
    const { edits } = orderLaneBySpeed([
        route(1, 'Express', 8000, '0-1 days'),
        route(2, 'Standard', 11000, '1 days'),
    ]);
    const by = new Map(edits.map((e) => [e.id, e.brackets[0]]));
    assert.strictEqual(by.get(1).price, 11000, 'Express takes the higher price');
    assert.strictEqual(by.get(2).price, 8000, 'Standard takes the lower');
    assert.strictEqual(by.get(1).eta, '0-1 days', 'speed stays with the service');
    assert.strictEqual(by.get(2).eta, '1 days');
});

it('moves price per kg with the price', () => {
    const { edits } = orderLaneBySpeed([
        route(1, 'Express', 8000, '0-1 days'),
        route(2, 'Standard', 11000, '1 days'),
    ]);
    const by = new Map(edits.map((e) => [e.id, e.brackets[0]]));
    assert.strictEqual(by.get(1).unit_price, 1100);
    assert.strictEqual(by.get(2).unit_price, 800);
});

it('leaves a lane that is already right alone', () => {
    // Lagos to Ibadan, which was correct: Economy cheapest, Express dearest.
    const { edits } = orderLaneBySpeed([
        route(1, 'Express', 10500, '1-2 days'),
        route(2, 'Standard', 8500, '1-3 days'),
        route(3, 'Economy', 7500, '3-5 days'),
    ]);
    assert.deepStrictEqual(edits, [], 'no write at all, so updated_at stays put');
});

it('orders three services, not just a pair', () => {
    const { edits } = orderLaneBySpeed([
        route(1, 'Express', 7500, '1-2 days'),
        route(2, 'Standard', 10500, '1-3 days'),
        route(3, 'Economy', 8500, '3-5 days'),
    ]);
    const by = new Map(edits.map((e) => [e.id, e.brackets[0].price]));
    assert.strictEqual(by.get(1), 10500);
    assert.strictEqual(by.get(2), 8500);
    assert.strictEqual(by.get(3), 7500);
});

it('does not mutate the rows it was given', () => {
    const rows = [route(1, 'Express', 8000, '0-1 days'), route(2, 'Standard', 11000, '1 days')];
    orderLaneBySpeed(rows);
    assert.strictEqual(rows[0].weight_brackets[0].price, 8000);
});

it('is settled after one run', () => {
    const rows = [route(1, 'Express', 8000, '0-1 days'), route(2, 'Standard', 11000, '1 days')];
    const first = orderLaneBySpeed(rows);
    const applied = rows.map((r) => {
        const edit = first.edits.find((e) => e.id === r.id);
        return edit ? { ...r, weight_brackets: edit.brackets } : r;
    });
    assert.deepStrictEqual(orderLaneBySpeed(applied).edits, [], 'running it twice changes nothing');
});

/* ── what it refuses to touch ───────────────────────────────────────── */

it('leaves a band whose figures are too far apart', () => {
    // Lagos to Port Harcourt by road: ₦15,000 against ₦585,000 in the same
    // band is not a swapped pair, it is a figure in the wrong place.
    const { edits, skipped } = orderLaneBySpeed([
        route(1, 'Express', 585000, '1-3 days'),
        route(2, 'Standard', 15000, '2-3 days'),
    ]);
    assert.deepStrictEqual(edits, []);
    assert.strictEqual(skipped.length, 1, 'and says so, rather than going quiet');
});

it('does not rank air against road', () => {
    // Lagos to Abuja sells air Express at ₦15,000 and road Express at
    // ₦21,500. Air being cheaper is a different journey, not an error.
    const air = { ...route(1, 'Express', 15000, '1-2 days'), transport_mode: 'air' };
    const road = route(2, 'Express', 21500, '1-3 days');
    assert.notStrictEqual(laneKeyOf(air), laneKeyOf(road));
    const { edits } = orderTableBySpeed([air, road]);
    assert.deepStrictEqual(edits, []);
});

it('leaves a service level it does not rank', () => {
    const { edits } = orderLaneBySpeed([
        route(1, 'Express', 8000, '0-1 days'),
        route(2, 'Courier Partner', 20000, '1 days'),
    ]);
    assert.deepStrictEqual(edits, [], 'one ranked service is not a comparison');
});

it('ignores a band only one service prices', () => {
    // The heavy bracket exists on Standard alone, so there is nothing to
    // compare it with and it must not be dragged into the parcel band.
    const express = route(1, 'Express', 11000, '0-1 days');
    const standard = route(2, 'Standard', 8000, '1 days');
    standard.weight_brackets.push({ min: 50, max: 250, price: 585000, eta: '2-4 days' });
    const { edits } = orderLaneBySpeed([express, standard]);
    assert.deepStrictEqual(edits, [], 'parcel band already correct, heavy band untouched');
});

/* ── lanes are kept apart ───────────────────────────────────────────── */

it('does not mix two different lanes', () => {
    const toAbuja = route(3, 'Standard', 23000, '2-3 days', {
        metadata: { destination_state: 'FCT' },
    });
    const { lanes } = orderTableBySpeed([route(1, 'Express', 8000, '0-1 days'), toAbuja]);
    assert.strictEqual(lanes, 2);
});

let failed = 0;
for (const [name, fn] of cases) {
    try {
        fn();
        console.log(`  ok   ${name}`);
    } catch (error) {
        failed += 1;
        console.log(`  FAIL ${name}\n       ${error.message}`);
    }
}
console.log(`\n${cases.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
