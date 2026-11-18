// Run: node src/seeds/repriceNigeria.test.js
// No database. What a migration does to live prices is the one thing worth
// proving before it runs.

const assert = require('assert');
const { laneOf, zoneOf, repriceRoute, repriceTable } = require('./repriceNigeria');

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

const route = (over = {}) => ({
    id: over.id ?? 1,
    transport_mode: over.mode ?? 'road',
    service_level: over.level ?? 'Standard',
    metadata: {
        origin_state: over.from ?? 'Lagos',
        origin_country_code: over.fromCountry ?? 'NG',
        destination_state: over.to ?? 'Lagos',
        destination_country_code: over.toCountry ?? 'NG',
        ...(over.metadata ?? {}),
    },
    weight_brackets: over.brackets ?? [
        { min: 0, max: 10, price: 11000, eta: '1 days', unit_price: 1100 },
    ],
});

/* ── The lane that was reported ─────────────────────────────────────────── */

it('a Lagos city run drops to a city price', () => {
    // What the checkout was showing: Standard ₦11,000 base (₦12,100 quoted).
    const edit = repriceRoute(route({ level: 'Standard' }));
    assert.strictEqual(edit.brackets[0].price, 3000);
    assert.strictEqual(edit.brackets[0].eta, '1-2 days');
    assert.strictEqual(edit.brackets[0].unit_price, 300, 'price per kg must follow the price');
});

it('and its Express ends up ABOVE its Standard', () => {
    const standard = repriceRoute(route({ level: 'Standard' }));
    const express = repriceRoute(route({ level: 'Express', brackets: [{ min: 0, max: 10, price: 8000, eta: '0-1 days' }] }));
    assert.ok(
        express.brackets[0].price > standard.brackets[0].price,
        'the faster service must cost more — this is the inversion that was live'
    );
});

/* ── What it does not touch ─────────────────────────────────────────────── */

it('leaves an international lane alone', () => {
    assert.strictEqual(laneOf(route({ fromCountry: 'IT' })), null);
    assert.strictEqual(repriceRoute(route({ fromCountry: 'IT' })), null);
});

it('leaves a state it does not recognise alone', () => {
    // Better an unpriced lane than one priced as a guess.
    assert.strictEqual(laneOf(route({ to: 'Atlantis' })), null);
});

it('leaves a negotiated heavy bracket alone', () => {
    // Lagos → Port Harcourt carries ₦585,000 from 50 kg, agreed for one job.
    // This is a price list for parcels; that figure is not in it.
    const edit = repriceRoute(
        route({
            to: 'Rivers',
            brackets: [
                { min: 0, max: 10, price: 15000, eta: '2-3 days' },
                { min: 50, max: 250, price: 585000, eta: '2-4 days' },
            ],
        })
    );
    assert.strictEqual(edit.brackets[1].price, 585000, 'the heavy bracket must survive');
    assert.notStrictEqual(edit.brackets[0].price, 15000, 'the parcel band is repriced');
});

it('does not mutate the row it was given', () => {
    const r = route();
    repriceRoute(r);
    assert.strictEqual(r.weight_brackets[0].price, 11000);
});

it('is settled after one run', () => {
    const r = route();
    const first = repriceRoute(r);
    const applied = { ...r, weight_brackets: first.brackets };
    assert.strictEqual(repriceRoute(applied), null, 'running it twice must change nothing');
});

/* ── Reading the state off a row ────────────────────────────────────────── */

it('knows the capital by every name it is written under', () => {
    for (const name of ['Abuja Federal Capital Territory', 'FCT', 'Abuja', 'federal capital territory']) {
        assert.strictEqual(zoneOf(name), 'NC', `${name} should be NC`);
    }
});

it('is not fooled by case or spacing', () => {
    assert.strictEqual(zoneOf('  lagos '), 'SW');
    assert.strictEqual(zoneOf('Akwa-Ibom'), 'SS');
});

it('covers every state the seed created', () => {
    // 36 states and the FCT. A missing one is a lane that silently keeps an
    // old price while its neighbours move.
    const { STATE_ZONE } = require('./repriceNigeria');
    assert.strictEqual(Object.keys(STATE_ZONE).length, 37);
});

/* ── The whole table ────────────────────────────────────────────────────── */

it('reprices what it covers and reports what it does not', () => {
    const { edits, skipped } = repriceTable([
        route({ id: 1, level: 'Standard' }),
        route({ id: 2, to: 'Kano', level: 'Express' }),
        route({ id: 3, fromCountry: 'IT' }),
        route({ id: 4, level: 'Standard', mode: 'air' }), // no air on a city run
    ]);
    assert.deepStrictEqual(edits.map((e) => e.id), [1, 2]);
    assert.deepStrictEqual(skipped.map((s) => s.id), [3, 4]);
});

it('prices a long haul higher than a city run', () => {
    const { edits } = repriceTable([
        route({ id: 1, level: 'Standard' }),
        route({ id: 2, to: 'Kano', level: 'Standard' }),
    ]);
    const [city, kano] = edits;
    assert.ok(kano.brackets[0].price > city.brackets[0].price);
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
