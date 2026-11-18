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

/* ── The weight ladder ──────────────────────────────────────────────────── */

const { ladderFor } = require('./pricing2026');

it('a ladder climbs, and never dips', () => {
    /* Not strictly increasing, because the floor flattens the bottom on a
       cheap lane: within one city the 0–1, 1–2 and 2–5 kg bands all come out
       at the Standard minimum, which is the floor doing its job. What may
       never happen is a heavier parcel costing LESS than a lighter one. */
    for (const lane of [{ sameState: true }, { originZone: 'SW', destinationZone: 'NC' }]) {
        for (const level of ['Economy', 'Standard', 'Express']) {
            const ladder = ladderFor(lane, 'road', level);
            for (let i = 1; i < ladder.length; i += 1) {
                assert.ok(
                    ladder[i].price >= ladder[i - 1].price,
                    `${level} ${ladder[i].min}-${ladder[i].max}kg (₦${ladder[i].price}) dips below the band under it`
                );
            }
            const top = ladder[ladder.length - 1].price;
            const bottom = ladder[0].price;
            assert.ok(top > bottom, `${level}: a 50 kg job must cost more than a 1 kg one`);
        }
    }
});

it('the bands meet with no gap and no overlap', () => {
    // A gap is how an 8 kg parcel ended up priced as a 250 kg truck:
    // priceTemplate picks on max alone, so a weight between two bands falls
    // into the one above.
    const ladder = ladderFor({ sameState: true }, 'road', 'Standard');
    assert.strictEqual(Number(ladder[0].min), 0, 'the ladder must start at nothing');
    for (let i = 1; i < ladder.length; i += 1) {
        assert.strictEqual(
            Number(ladder[i].min),
            Number(ladder[i - 1].max),
            `${ladder[i - 1].max}kg to ${ladder[i].min}kg is a gap`
        );
    }
});

it('the benchmarked band is the one the market was checked against', () => {
    // The tier price IS the 5–10 kg figure; everything else scales from it.
    const ladder = ladderFor({ originZone: 'SW', destinationZone: 'NC' }, 'road', 'Standard');
    const five = ladder.find((b) => Number(b.max) === 10);
    assert.strictEqual(five.price, 10000, 'the 5–10 kg band must be the benchmarked rate');
});

it('a small parcel is priced like a small parcel, but never below the floor', () => {
    // Two pulls in opposite directions. A shirt across Lagos must not be
    // quoted a ten-kilo price; it must also not be quoted ₦990, which is
    // what a partner's checkout was showing and is not a price anybody does
    // the job for.
    const ladder = ladderFor({ sameState: true }, 'road', 'Standard');
    const lightest = ladder.find((b) => Number(b.max) === 1);
    const heaviest = ladder.find((b) => Number(b.max) === 50);
    assert.ok(quoted(lightest.price) >= 2000, `₦${quoted(lightest.price)} is below what the job is worth`);
    assert.ok(quoted(lightest.price) < quoted(heaviest.price), 'a shirt is not a 50 kg job');
});

it('every band of a faster service costs more than the same band of a slower one', () => {
    for (const lane of [{ sameState: true }, { originZone: 'SW', destinationZone: 'NC' }]) {
        const standard = ladderFor(lane, 'road', 'Standard');
        const express = ladderFor(lane, 'road', 'Express');
        for (let i = 0; i < standard.length; i += 1) {
            assert.ok(
                express[i].price > standard[i].price,
                `${standard[i].min}-${standard[i].max}kg: Express must stay above Standard`
            );
        }
    }
});

it('every band carries the service eta, not a mixture', () => {
    const ladder = ladderFor({ sameState: true }, 'road', 'Express');
    const etas = new Set(ladder.map((b) => b.eta));
    assert.strictEqual(etas.size, 1, 'a service promises one speed, whatever the parcel weighs');
    assert.strictEqual([...etas][0], '0-1 days');
});

/* ── Coverage, and the floor ────────────────────────────────────────────── */

const { atLeastMinimum, MINIMUM_BASE } = require('./pricing2026');

it('every tier sells all three service levels by road', () => {
    // The seed gave intra-state lanes no Economy and the far-north lanes no
    // road Express, so a shopper crossing one city had no cheap option and
    // one going north had no fast one short of a flight.
    for (const [tier, services] of Object.entries(TIERS)) {
        for (const level of ['Economy', 'Standard', 'Express']) {
            assert.ok(
                services.some((x) => x.mode === 'road' && x.level === level),
                `tier ${tier} does not sell road ${level}`
            );
        }
    }
});

it('nothing is ever quoted below what the job is worth', () => {
    // A local run is 0.65 of the lane, and the lightest band 0.45 of that
    // again — which took Ikeja to Ikeja down to ₦990 quoted. Nobody rides to
    // a shop, waits, collects and delivers for that.
    for (const [tier, floors] of Object.entries(MINIMUM_BASE)) {
        for (const level of Object.keys(floors)) {
            assert.strictEqual(atLeastMinimum(1, level, tier), floors[level]);
            assert.strictEqual(atLeastMinimum(0, level, tier), floors[level]);
        }
    }
});

it('the floor never moves a price that is already above it', () => {
    assert.strictEqual(atLeastMinimum(90000, 'Standard', 'same'), 90000);
});

it('the floor keeps the services in order rather than flattening them', () => {
    // One floor for all three would make Economy, Standard and Express the
    // same number on exactly the smallest jobs.
    for (const tier of Object.keys(MINIMUM_BASE)) {
        assert.ok(
            atLeastMinimum(1, 'Express', tier) > atLeastMinimum(1, 'Standard', tier),
            `tier ${tier}: Express must stay above Standard at the floor`
        );
        assert.ok(
            atLeastMinimum(1, 'Standard', tier) > atLeastMinimum(1, 'Economy', tier),
            `tier ${tier}: Standard must stay above Economy at the floor`
        );
    }
});

it('the lightest band matches what couriers charge for the same journey', () => {
    /* GIGL publishes 0–2 kg rates per route; our lightest band is what a
       0.2 kg parcel pays. The first attempt put ONE flat floor under every
       lane, and a 0.2 kg parcel from Ikeja to Ado-Ekiti came out at ₦2,200 —
       less than GIGL charges to cross a single city. */
    const light = (lane, level) => quoted(ladderFor(lane, 'road', level)[0].price);
    const checks = [
        ['Lagos → Abuja', { originZone: 'SW', destinationZone: 'NC' }, [6000, 9000]],
        ['Lagos → Kano', { originZone: 'SW', destinationZone: 'NW' }, [7000, 11000]],
        ['Lagos → Enugu', { originZone: 'SW', destinationZone: 'SE' }, [7000, 10500]],
    ];
    for (const [label, lane, [low, high]] of checks) {
        const price = light(lane, 'Standard');
        assert.ok(price <= high, `${label}: ₦${price} is above the market (₦${low}–${high})`);
        assert.ok(price >= low * 0.85, `${label}: ₦${price} is far under the market (₦${low}–${high})`);
    }
});

it('a light parcel costs more the further it goes', () => {
    /* The bug this exists to stop: a flat floor made every journey the same
       price for anything under a kilo, so 300 km cost what crossing Ikeja
       costs. */
    const order = [
        { sameState: true },
        { originZone: 'SW', destinationZone: 'SW' },
        { originZone: 'SW', destinationZone: 'NC' },
        { originZone: 'SW', destinationZone: 'SE' },
        { originZone: 'SW', destinationZone: 'NW' },
    ];
    for (const level of ['Economy', 'Standard', 'Express']) {
        const prices = order.map((lane) => ladderFor(lane, 'road', level)[0].price);
        for (let i = 1; i < prices.length; i += 1) {
            assert.ok(
                prices[i] > prices[i - 1],
                `${level}: a 0.2 kg parcel on tier ${i} (₦${prices[i]}) must cost more than tier ${i - 1} (₦${prices[i - 1]})`
            );
        }
    }
});

it('nothing anywhere can be quoted under ₦2,000', () => {
    // The hard rule. Yenagoa is the one courier that publishes a floor
    // openly and sets it at ₦2,000; GIGL's smallest intra-city band is
    // ₦3,000. A ₦990 pickup is not a cheap delivery, it is a delivery that
    // gets accepted and then quietly dropped.
    const cheapest = quoted(MINIMUM_BASE.same.Economy);
    assert.ok(cheapest >= 2000, `₦${cheapest} is below the floor`);
    assert.ok(cheapest <= 3300, `₦${cheapest} is above the market's own floor`);
});

it('the floor survives a local run, which is where it was breaking', () => {
    // A local band takes 0.65 of the price AFTER the ladder has taken 0.45
    // of it, and the two together put Ikeja → Ikeja at ₦990. Whatever those
    // multipliers do, the answer may not land under the floor.
    const { bandedPrice } = require('./cityBands');
    for (const level of ['Economy', 'Standard', 'Express']) {
        const lightest = ladderFor({ sameState: true }, 'road', level)[0];
        for (const band of ['local', 'city', 'metro']) {
            const price = atLeastMinimum(bandedPrice(lightest.price, band), level, 'same');
            assert.ok(
                quoted(price) >= 2000,
                `${level} on a ${band} run quotes ₦${quoted(price)}`
            );
        }
    }
});

it('an unknown service level has no floor to apply', () => {
    // A partner level or something hand-typed: left exactly as it came.
    assert.strictEqual(atLeastMinimum(50, 'Courier Partner', 'same'), 50);
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
