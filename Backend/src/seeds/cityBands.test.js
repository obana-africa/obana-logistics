// Run: node src/seeds/cityBands.test.js
// No database. This decides what a customer in Ikeja is charged, so the towns
// below are the real ones off real orders, not invented examples.

const assert = require('assert');
const { cityBand, bandedPrice, bandFactor } = require('./cityBands');

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

/* ── The order that started this ────────────────────────────────────────── */

it('Ikeja to Ikeja is a local run', () => {
    assert.strictEqual(cityBand('Lagos', 'Ikeja', 'Ikeja'), 'local');
});

it('Ikeja to Badagry is right across the state', () => {
    assert.strictEqual(cityBand('Lagos', 'Ikeja', 'Badagry'), 'metro');
});

it('and the two are no longer the same price', () => {
    // The whole complaint: both were ₦12,100.
    const base = 3000;
    const near = bandedPrice(base, cityBand('Lagos', 'Ikeja', 'Ikeja'));
    const far = bandedPrice(base, cityBand('Lagos', 'Ikeja', 'Badagry'));
    assert.ok(far > near * 2, `₦${near} and ₦${far} are still too close`);
});

/* ── Lagos, as people actually move through it ──────────────────────────── */

it('Ikeja to Maryland is the ordinary run across the city', () => {
    assert.strictEqual(cityBand('Lagos', 'Ikeja', 'Maryland'), 'city');
    assert.strictEqual(cityBand('Lagos', 'Ikeja', 'Yaba'), 'city');
});

it('Ikeja to Lekki crosses the city twice over', () => {
    assert.strictEqual(cityBand('Lagos', 'Ikeja', 'Lekki'), 'metro');
    assert.strictEqual(cityBand('Lagos', 'Ikeja', 'Ajah'), 'metro');
});

it('the island to the Lekki corridor is one run', () => {
    assert.strictEqual(cityBand('Lagos', 'Victoria Island', 'Lekki'), 'city');
    assert.strictEqual(cityBand('Lagos', 'Ikoyi', 'Lekki'), 'city');
});

it('Victoria Island to Badagry is as far as Lagos goes', () => {
    assert.strictEqual(cityBand('Lagos', 'Victoria Island', 'Badagry'), 'metro');
});

it('reads a town the way people write it', () => {
    // "Lekki Phase 1", "Ikeja GRA", odd spacing and case all mean the town.
    assert.strictEqual(cityBand('Lagos', 'Ikeja GRA', 'ikeja'), 'local');
    assert.strictEqual(cityBand('Lagos', 'Lekki Phase 1', 'LEKKI'), 'local');
    assert.strictEqual(cityBand('Lagos', ' Victoria  Island ', 'VI'), 'local');
    assert.strictEqual(cityBand('Lagos', 'Ojodu-Berger', 'ojodu berger'), 'local');
});

/* ── Everywhere else ────────────────────────────────────────────────────── */

it('the same town is local in a state with no map', () => {
    // Which is what makes Ibadan → Ibadan and Kano → Kano right for free.
    assert.strictEqual(cityBand('Oyo', 'Ibadan', 'Ibadan'), 'local');
    assert.strictEqual(cityBand('Kano', 'Kano', 'kano'), 'local');
    assert.strictEqual(cityBand('Rivers', 'Port Harcourt', 'Port Harcourt'), 'local');
});

it('two towns it does not know fall to the middle', () => {
    // The middle band IS the lane's own price, so not knowing costs nobody
    // anything — the quote is exactly what it is today.
    assert.strictEqual(cityBand('Oyo', 'Ibadan', 'Ogbomoso'), 'city');
    assert.strictEqual(bandFactor(cityBand('Oyo', 'Ibadan', 'Ogbomoso')), 1);
});

it('a missing town falls to the middle rather than guessing', () => {
    assert.strictEqual(cityBand('Lagos', 'Ikeja', ''), 'city');
    assert.strictEqual(cityBand('Lagos', '', 'Ikeja'), 'city');
    assert.strictEqual(cityBand('Lagos', 'Ikeja', null), 'city');
});

it('knows the capital by every name it travels under', () => {
    for (const state of ['Abuja Federal Capital Territory', 'FCT', 'Abuja']) {
        assert.strictEqual(cityBand(state, 'Wuse', 'Garki'), 'city', state);
        assert.strictEqual(cityBand(state, 'Wuse', 'Kubwa'), 'metro', state);
    }
});

/* ── What it does to a price ────────────────────────────────────────────── */

it('the middle band leaves the lane price alone', () => {
    assert.strictEqual(bandedPrice(3000, 'city'), 3000);
});

it('a local run is cheaper and a metro run dearer, always', () => {
    const base = 3000;
    assert.ok(bandedPrice(base, 'local') < base);
    assert.ok(bandedPrice(base, 'metro') > base);
});

it('rounds to something a person can read', () => {
    // "₦2,145" invites the question of where the ₦45 came from, and the
    // answer is not one a customer should have to hear.
    for (const base of [3000, 4500, 2200, 13333]) {
        for (const band of ['local', 'city', 'metro']) {
            const p = bandedPrice(base, band);
            assert.strictEqual(p % 50, 0, `₦${p} (${base}, ${band}) is not a round figure`);
        }
    }
});

it('a faster service stays dearer after banding', () => {
    // Banding must not reorder the services: it scales them all alike.
    for (const band of ['local', 'city', 'metro']) {
        const standard = bandedPrice(3000, band);
        const express = bandedPrice(4500, band);
        assert.ok(express > standard, `${band}: Express ₦${express} must stay above Standard ₦${standard}`);
    }
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
