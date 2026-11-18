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

const band = (edit, max) => edit.brackets.find((b) => Number(b.max) === max);

it('a Lagos city run drops to a city price, and grows with weight', () => {
    // What the checkout was showing: one 0–90 kg bracket at ₦11,000, so a
    // shirt and a fridge cost the same ₦12,100.
    const edit = repriceRoute(
        route({ level: 'Standard', brackets: [{ min: 0, max: 90, price: 11000, eta: '1 days' }] })
    );
    // 0.45 of ₦3,000 is ₦1,350, lifted to the Standard floor of ₦1,500:
    // below that nobody rides to the shop, waits and delivers.
    // 0.45 of ₦3,000 is ₦1,350, lifted to the Standard floor of ₦2,500:
    // below that nobody rides to the shop, waits and delivers.
    assert.strictEqual(band(edit, 1).price, 2500, 'the lightest band sits on the floor');
    assert.strictEqual(band(edit, 10).price, 3000, 'the benchmarked band is above it');
    assert.strictEqual(band(edit, 50).price, 9000);
    assert.strictEqual(band(edit, 1).eta, '1-2 days');
    for (const b of edit.brackets) {
        assert.ok(b.unit_price > 0, 'price per kg must be set on every band');
    }
});

it('no band ever costs less than the one below it', () => {
    /* The bottom bands sit level on a cheap lane, because the floor lifts
       them all to the same number. A heavier parcel costing LESS than a
       lighter one is the thing that must never happen. */
    const edit = repriceRoute(route({ level: 'Standard' }));
    const ordered = [...edit.brackets].sort((a, b) => a.max - b.max);
    for (let i = 1; i < ordered.length; i += 1) {
        assert.ok(
            ordered[i].price >= ordered[i - 1].price,
            `${ordered[i].min}-${ordered[i].max}kg (₦${ordered[i].price}) dips below the band under it`
        );
    }
    assert.ok(ordered[ordered.length - 1].price > ordered[0].price);
});

it('Standard stays under Express at every weight', () => {
    // The checkout that prompted this offered Express ₦4,950 against
    // Standard ₦12,100, because one row had been repriced and the other had
    // not. Band by band, that must be impossible.
    const standard = repriceRoute(route({ level: 'Standard' }));
    const express = repriceRoute(route({ level: 'Express' }));
    for (const b of standard.brackets) {
        const e = band(express, Number(b.max));
        assert.ok(e.price > b.price, `${b.min}-${b.max}kg: Express ₦${e.price} must be above Standard ₦${b.price}`);
    }
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
    const heavy = edit.brackets.find((b) => Number(b.min) === 50);
    assert.ok(heavy, 'the heavy bracket must survive');
    assert.strictEqual(heavy.price, 585000);
    assert.strictEqual(heavy.max, 250);
    assert.ok(
        edit.brackets.some((b) => Number(b.max) === 10 && b.price !== 15000),
        'the parcel bands are replaced'
    );
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

it('accepts every spelling the quote engine accepts', () => {
    /* A row the ENGINE matches as Lagos but this file does not is a row that
       keeps its old price while every lane around it moves, and says nothing
       about it. Found by running the migration against "Lagos State", which
       it skipped. */
    for (const name of ['Lagos State', 'lagos state', 'LAGOS  STATE']) {
        assert.strictEqual(zoneOf(name), 'SW', name);
    }
    assert.strictEqual(zoneOf('Rivers State'), 'SS');
    assert.strictEqual(zoneOf('Cross-River'), 'SS');
    assert.strictEqual(zoneOf('Nassarawa'), 'NC');
    assert.strictEqual(zoneOf('Abuja FCT'), 'NC');
});

it('reprices a lane spelled with "State" on the end', () => {
    const edit = repriceRoute({
        id: 9,
        transport_mode: 'road',
        service_level: 'Standard',
        metadata: {
            origin_state: 'Lagos State',
            origin_country_code: 'NG',
            destination_state: 'Lagos State',
            destination_country_code: 'NG',
        },
        weight_brackets: [{ min: 0, max: 10, price: 11000, eta: '1 days' }],
    });
    assert.ok(edit, 'a row spelled "Lagos State" must still be repriced');
    assert.strictEqual(edit.brackets.find((b) => Number(b.max) === 10).price, 3000);
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
