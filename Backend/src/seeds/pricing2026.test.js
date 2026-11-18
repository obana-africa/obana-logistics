// Run: node src/seeds/pricing2026.test.js
// No database and no test runner — the table is data and a few pure lookups,
// and this is the part that can be wrong in a way nobody notices until a
// customer is quoted it.

const assert = require('assert');
const { TIERS, zoneGap, tierFor, rateFor } = require('./pricing2026');

const cases = [];
const it = (name, fn) => cases.push([name, fn]);

/** The quoted price: the base plus the 10% service charge priceTemplate adds. */
const quoted = (base) => Math.ceil(base * 1.1);

/** The upper bound of an eta like "2-4", which is what a promise is judged on. */
const slowest = (eta) => Number(String(eta).split('-').pop());
const fastest = (eta) => Number(String(eta).split('-')[0]);

const SPEED = { Express: 0, Standard: 1, Economy: 2 };

/* ── The two rules that may never break ─────────────────────────────────── */

it('within a lane and a mode, Express costs the most and Economy the least', () => {
    for (const [tier, services] of Object.entries(TIERS)) {
        const byMode = {};
        for (const s of services) (byMode[s.mode] ??= []).push(s);
        for (const [mode, group] of Object.entries(byMode)) {
            const ranked = [...group].sort((a, b) => SPEED[a.level] - SPEED[b.level]);
            for (let i = 1; i < ranked.length; i += 1) {
                assert.ok(
                    ranked[i - 1].price > ranked[i].price,
                    `tier ${tier} ${mode}: ${ranked[i - 1].level} (₦${ranked[i - 1].price}) must cost more than ${ranked[i].level} (₦${ranked[i].price})`
                );
            }
        }
    }
});

it('within a lane and a mode, Express is the fastest and Economy the slowest', () => {
    for (const [tier, services] of Object.entries(TIERS)) {
        const byMode = {};
        for (const s of services) (byMode[s.mode] ??= []).push(s);
        for (const [mode, group] of Object.entries(byMode)) {
            const ranked = [...group].sort((a, b) => SPEED[a.level] - SPEED[b.level]);
            for (let i = 1; i < ranked.length; i += 1) {
                assert.ok(
                    slowest(ranked[i - 1].eta) < slowest(ranked[i].eta),
                    `tier ${tier} ${mode}: ${ranked[i - 1].level} (${ranked[i - 1].eta}) must be faster than ${ranked[i].level} (${ranked[i].eta})`
                );
            }
        }
    }
});

it('no two services on a lane and mode share an eta', () => {
    // Two options reading the same on the checkout is the bug that started
    // all of this: Express and Standard both said "Within 24 hours".
    for (const [tier, services] of Object.entries(TIERS)) {
        const seen = new Map();
        for (const s of services) {
            const key = `${s.mode}|${s.eta}`;
            assert.ok(!seen.has(key), `tier ${tier}: ${s.level} and ${seen.get(key)} both say "${s.eta}" by ${s.mode}`);
            seen.set(key, s.level);
        }
    }
});

it('wherever air is sold it is faster and dearer than the road Express', () => {
    for (const [tier, services] of Object.entries(TIERS)) {
        const air = services.find((s) => s.mode === 'air');
        if (!air) continue;
        const road = services.find((s) => s.mode === 'road' && s.level === 'Express');
        assert.ok(road, `tier ${tier} sells air with no road Express to judge it against`);
        assert.ok(air.price > road.price, `tier ${tier}: air (₦${air.price}) must cost more than road (₦${road.price})`);
        assert.ok(
            slowest(air.eta) < slowest(road.eta) || fastest(air.eta) < fastest(road.eta),
            `tier ${tier}: air (${air.eta}) must be faster than road (${road.eta})`
        );
    }
});

/* ── Against what the market actually charges (November 2026) ───────────── */
//
// Each range is the published guidance for a parcel in this weight band. The
// assertion is that we are AT OR UNDER the top of it and not absurdly under
// the bottom — a marketplace rate that undercuts, not one that looks broken.

const within = (base, [low, high], label) => {
    const q = quoted(base);
    assert.ok(q <= high, `${label}: ₦${q} is above the market (₦${low}–${high})`);
    assert.ok(q >= low * 0.6, `${label}: ₦${q} is implausibly far below the market (₦${low}–${high})`);
};

it('Lagos to Abuja sits inside the market', () => {
    // Neighbouring zones (SW → NC). Market ₦12,000–18,000.
    within(rateFor({ originZone: 'SW', destinationZone: 'NC' }, 'road', 'Standard').price, [12000, 18000], 'Lagos → Abuja Standard');
    within(rateFor({ originZone: 'SW', destinationZone: 'NC' }, 'road', 'Express').price, [12000, 18000], 'Lagos → Abuja Express');
});

it('Lagos to Port Harcourt sits inside the market', () => {
    // SW → SS. Market ₦13,000–18,000.
    within(rateFor({ originZone: 'SW', destinationZone: 'SS' }, 'road', 'Standard').price, [13000, 18000], 'Lagos → PH Standard');
});

it('Lagos to Kano sits inside the market', () => {
    // SW → NW, the long haul. Market ₦14,000–20,000.
    within(rateFor({ originZone: 'SW', destinationZone: 'NW' }, 'road', 'Standard').price, [14000, 20000], 'Lagos → Kano Standard');
});

it('Lagos to Enugu sits inside the market', () => {
    // SW → SE, across the south. Market ₦13,500–18,000.
    within(rateFor({ originZone: 'SW', destinationZone: 'SE' }, 'road', 'Standard').price, [13500, 18000], 'Lagos → Enugu Standard');
});

it('Abuja to Port Harcourt sits inside the market', () => {
    // NC → SS. Market ₦13,000–17,000.
    within(rateFor({ originZone: 'NC', destinationZone: 'SS' }, 'road', 'Standard').price, [13000, 17000], 'Abuja → PH Standard');
});

it('Lagos to Ibadan sits inside the market', () => {
    // Same zone (SW → SW). Market ₦3,000–9,500.
    within(rateFor({ originZone: 'SW', destinationZone: 'SW' }, 'road', 'Standard').price, [3000, 9500], 'Lagos → Ibadan Standard');
});

it('a city run is priced like a city run, not like a haul', () => {
    // The complaint that started this: Ikeja → Ikeja quoted ₦8,800, against a
    // Lagos market of ₦1,000–3,000 standard and ₦2,000–5,000 express.
    const standard = quoted(rateFor({ sameState: true }, 'road', 'Standard').price);
    const express = quoted(rateFor({ sameState: true }, 'road', 'Express').price);
    assert.ok(standard <= 5000, `a city Standard at ₦${standard} is still priced like a haul`);
    assert.ok(express <= 6000, `a city Express at ₦${express} is still priced like a haul`);
    assert.ok(standard >= 1500, `a city Standard at ₦${standard} is below what a rider costs`);
});

it('a city run always costs less than leaving the state', () => {
    const city = rateFor({ sameState: true }, 'road', 'Standard').price;
    const nearest = rateFor({ originZone: 'SW', destinationZone: 'SW' }, 'road', 'Standard').price;
    assert.ok(city < nearest, 'crossing the city must not cost more than crossing the zone');
});

it('the further it goes, the more it costs', () => {
    const level = 'Standard';
    const prices = ['same', 0, 1, 2, 3].map((tier) =>
        (tier === 'same'
            ? rateFor({ sameState: true }, 'road', level)
            : TIERS[tier].find((s) => s.mode === 'road' && s.level === level)
        ).price
    );
    for (let i = 1; i < prices.length; i += 1) {
        assert.ok(prices[i] > prices[i - 1], `tier ${i} (₦${prices[i]}) must cost more than the one before (₦${prices[i - 1]})`);
    }
});

/* ── Lane classification ────────────────────────────────────────────────── */

it('reads a zone pair either way round', () => {
    assert.strictEqual(zoneGap('SW', 'NC'), 1);
    assert.strictEqual(zoneGap('NC', 'SW'), 1);
    assert.strictEqual(zoneGap('SW', 'SW'), 0);
    assert.strictEqual(zoneGap('SW', 'NE'), 3);
});

it('same state wins over whatever the zones say', () => {
    assert.strictEqual(tierFor({ sameState: true, originZone: 'SW', destinationZone: 'SW' }), 'same');
});

it('a lane with no zones is not ours to price', () => {
    // An international lane, or a state this table has never heard of. Left
    // alone rather than guessed at.
    assert.strictEqual(tierFor({ originZone: 'SW', destinationZone: null }), null);
    assert.strictEqual(rateFor({ originZone: null, destinationZone: null }, 'road', 'Standard'), null);
});

it('asks for a service a tier does not sell and gets null', () => {
    assert.strictEqual(rateFor({ sameState: true }, 'air', 'Express'), null);
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
