'use strict';

/**
 * What a Nigerian delivery costs, and how long it takes.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * The seeded table priced a lane by the two STATES it joins, and only that.
 * So "Lagos → Lagos" was one number whether the parcel went from Ikeja to the
 * next street or from Ikeja to Badagry, and that number — ₦8,800 live, after
 * the +₦3,000 uplift and some hand edits — was two to five times what anyone
 * in Lagos actually charges to move a parcel across the city. A merchant
 * checking out saw a city run priced like an interstate haul and left.
 *
 * At the other end the long lanes had drifted ABOVE the market: Lagos → Kano
 * Standard quoted ₦21,450 against a market of ₦14,000–20,000 for the same
 * weight. Expensive in the city, expensive up country, and in between a set
 * of services whose prices no longer lined up with their speeds at all.
 *
 * ── What the market actually charges ───────────────────────────────────────
 *
 * Checked November 2026 against published rate guidance for the couriers a
 * Nigerian merchant compares us with — GIG Logistics, Kwik, Fez, Sendbox,
 * Jumia Logistics and DHL Nigeria — plus general industry guides. Figures are
 * for the weight band this table prices (a parcel up to 10 kg, so the "5 kg+"
 * tier in most published tables):
 *
 *   Within one state   GIGL 5 kg+ from ₦7,500; bike dispatch across Lagos
 *                      ₦1,000–3,000 standard and ₦2,000–5,000 express;
 *                      most same-city runs ₦1,500–5,000.
 *   Lagos → Abuja      ₦12,000–18,000      Lagos → Port Harcourt ₦13,000–18,000
 *   Lagos → Kano       ₦14,000–20,000      Lagos → Enugu         ₦13,500–18,000
 *   Abuja → PH         ₦13,000–17,000      Lagos → Ibadan        ₦3,000–9,500
 *
 *   Times: same city 24–48 h, interstate on a major route 2–4 business days,
 *   remote 3–5 business days.
 *
 * The figures below sit at or just under the bottom of each band. That is a
 * deliberate position, not an accident of rounding: Obana is a marketplace
 * rate rather than a branded counter service, and the price is the reason a
 * merchant uses it rather than walking to a GIGL office.
 *
 * Every figure here is the BASE. priceTemplate adds the lane's service charge
 * (ROUTE_MARKUP_PERCENT, 10 by default) on top, and that is what the customer
 * is quoted — so read ₦10,000 below as ₦11,000 on the checkout.
 *
 * ── Two rules this table may never break ───────────────────────────────────
 *
 * Within one lane and one transport mode:
 *   1. Express is the fastest and Economy the slowest.
 *   2. Express costs the most and Economy the least.
 *
 * Both were broken in production — a Lagos lane sold Standard at ₦12,100 for
 * one day against Express at ₦8,800 for nought-to-one, so the slower service
 * cost ₦3,300 more and nobody would ever have picked it. pricing2026.test.js
 * asserts both across every tier, so the table cannot be edited back into
 * that state without a test saying so.
 */

/**
 * How far apart two geopolitical zones are. Unordered — a pair reads either
 * way round. Copied from the seed that built the table rather than imported,
 * because that migration has run and must keep describing what it did.
 */
const ZONE_GAP = {
    'SW|SS': 1, 'SW|NC': 1, 'SS|SE': 1, 'SE|NC': 1, 'SS|NC': 1, 'NC|NW': 1, 'NC|NE': 1, 'NW|NE': 1,
    'SW|SE': 2,
    'SW|NW': 3, 'SW|NE': 3, 'SS|NW': 3, 'SS|NE': 3, 'SE|NW': 3, 'SE|NE': 3,
};

const zoneGap = (a, b) =>
    a === b ? 0 : ZONE_GAP[`${a}|${b}`] ?? ZONE_GAP[`${b}|${a}`] ?? 3;

/**
 * The table. `same` is both ends in one state; 0–3 are zone gaps.
 *
 * eta is written the way the brackets store it — a range of days, which
 * deliveryTimeRange turns into dates and the storefront turns into words.
 */
const TIERS = {
    /* Within one state: a city run, and the whole reason for this rewrite.
     *
     * One rate for the state rather than a rate per town. Pricing Ikeja → Ikeja
     * differently from Ikeja → Badagry needs the quote engine to match on the
     * CITY, which it does not — laneTemplates reads state and country only —
     * and pricing every town pair would need a table nobody could maintain.
     * One honest city rate beats a precise one that does not exist. */
    same: [
        { mode: 'road', level: 'Economy', price: 2200, eta: '2-3' },
        { mode: 'road', level: 'Standard', price: 3000, eta: '1-2' },
        { mode: 'road', level: 'Express', price: 4500, eta: '0-1' },
    ],
    /* Within a zone: Lagos → Ibadan, Kano → Katsina. 100–250 km. */
    0: [
        { mode: 'road', level: 'Economy', price: 4200, eta: '3-5' },
        { mode: 'road', level: 'Standard', price: 5500, eta: '2-3' },
        { mode: 'road', level: 'Express', price: 7500, eta: '1-2' },
    ],
    /* Neighbouring zones: Lagos → Benin, Lagos → Abuja, Abuja → Port
       Harcourt. 400–800 km, and most of the interstate traffic. */
    1: [
        { mode: 'road', level: 'Economy', price: 7500, eta: '4-6' },
        { mode: 'road', level: 'Standard', price: 10000, eta: '2-4' },
        { mode: 'road', level: 'Express', price: 13500, eta: '1-2' },
        /* Lagos → Abuja by air is a real product and the table already holds
           rows for it. Without a price here those rows would be skipped and
           left drifting at whatever they were last set to, which is how the
           inversions got in. Faster and dearer than the road Express beside
           it, which is the only arrangement that makes sense to a buyer. */
        { mode: 'air', level: 'Express', price: 19000, eta: '0-1' },
    ],
    /* Across the south: Lagos → Enugu. */
    2: [
        { mode: 'road', level: 'Economy', price: 8500, eta: '5-7' },
        { mode: 'road', level: 'Standard', price: 11000, eta: '3-5' },
        { mode: 'road', level: 'Express', price: 14500, eta: '2-3' },
        { mode: 'air', level: 'Express', price: 21000, eta: '1-2' },
    ],
    /* South to the far north: Lagos → Kano, Lagos → Maiduguri. 1,000 km and
       up, and the only distance where air is worth what it costs — so air
       Express is here, faster and dearer than the road Express beside it. */
    3: [
        { mode: 'road', level: 'Economy', price: 10000, eta: '5-8' },
        { mode: 'road', level: 'Standard', price: 13000, eta: '3-5' },
        { mode: 'road', level: 'Express', price: 17500, eta: '2-3' },
        { mode: 'air', level: 'Express', price: 26000, eta: '1-2' },
    ],
};

/**
 * How a price grows with weight.
 *
 * Every Nigerian courier prices in weight bands, not per kilo — GIGL quotes
 * 0–2 kg, 3–5 kg and 5 kg+ as three figures, and a 1 kg and a 2 kg parcel on
 * the same route cost the same. The table above is the 5–10 kg figure, which
 * is the one the market research was done against, and these scale it.
 *
 *   0–1 kg   × 0.45     an envelope or a shirt
 *   1–2 kg   × 0.55
 *   2–5 kg   × 0.75
 *   5–10 kg  × 1        the benchmarked rate
 *   10–20 kg × 1.6
 *   20–50 kg × 3
 *
 * Above the top band priceTemplate extrapolates pro rata, which gives roughly
 * the per-kilo rate a courier charges for a heavy job and needs no band of
 * its own.
 *
 * Against a Lagos Standard of ₦3,000 that is ₦1,500 / ₦1,650 / ₦2,250 /
 * ₦3,000 / ₦4,800 / ₦9,000 before the service charge — a small parcel across
 * Lagos quoted ₦1,650, where it belongs, instead of ₦12,100.
 */
const WEIGHT_LADDER = [
    { min: 0, max: 1, factor: 0.45 },
    { min: 1, max: 2, factor: 0.55 },
    { min: 2, max: 5, factor: 0.75 },
    { min: 5, max: 10, factor: 1 },
    { min: 10, max: 20, factor: 1.6 },
    { min: 20, max: 50, factor: 3 },
];

/**
 * A bracket at or above this weight was agreed for a job, not taken off a
 * price list. Lagos → Port Harcourt carries ₦585,000 from 50 kg; nothing here
 * may touch it.
 */
const NEGOTIATED_FROM_KG = 50;

/**
 * What a job is worth doing for at all.
 *
 * The ladder and the city band both multiply downward, and they met at the
 * bottom: a 0.2 kg parcel from Ikeja to Ikeja came out at ₦990 quoted.
 * Nobody rides to a shop, waits, collects and delivers for that, so the
 * number was not a price — it was a booking that would quietly fail, or a
 * rider out of pocket.
 *
 * Every courier in this market publishes a floor rather than refusing small
 * jobs: Fez starts "from ₦1,000", Kwik's short Lagos runs sit around
 * ₦800–1,500, Yenagoa rates "start from ₦2,000", and GIGL's smallest
 * intra-city band is ₦3,000. A floor is also the kinder answer — a customer
 * buying one shirt is told what delivery costs, not told the shop cannot
 * send it.
 *
 * Per service, not one figure, because a single floor would flatten the
 * three into the same number on exactly the smallest jobs — and "Express
 * costs more than Standard" has to hold at the bottom of the table as well
 * as the top.
 *
 * Set so the cheapest thing anybody can be quoted, anywhere, is ₦2,200 —
 * ₦2,000 plus the service charge. The first pass put it at ₦1,320 and a
 * partner's checkout showed a ₦990 pickup, which is the number that proved
 * the point: at that price the job does not get done, it gets accepted and
 * then quietly dropped, and the customer is the one who finds out. ₦2,000 is
 * also where the one courier that publishes a floor publicly sets theirs.
 */
const MINIMUM_BASE = { Economy: 2000, Standard: 2500, Express: 3500 };

const norm = (v) => String(v ?? '').trim().toLowerCase();

/** The price, or the floor for this service, whichever is higher. */
function atLeastMinimum(price, level) {
    const key = Object.keys(MINIMUM_BASE).find((k) => norm(k) === norm(level));
    const floor = key ? MINIMUM_BASE[key] : 0;
    return Math.max(Number(price) || 0, floor);
}

/** Round to something a customer can read. */
const tidy = (n) => Math.ceil(n / 50) * 50;

/**
 * The full set of weight brackets for one service on one lane.
 *
 * Replaces whatever parcel brackets a route is carrying rather than adjusting
 * them. Adjusting is what left a Lagos lane with one 0–90 kg bracket at
 * ₦11,000 — a shirt and a fridge the same price, and a reprice that skipped
 * the row entirely because it was looking for a bracket ending at 10.
 */
function ladderFor(lane, mode, level) {
    const rate = rateFor(lane, mode, level);
    if (!rate) return null;
    return WEIGHT_LADDER.map((band) => {
        const price = atLeastMinimum(tidy(rate.price * band.factor), level);
        return {
            min: band.min,
            max: band.max,
            price,
            eta: `${rate.eta} days`,
            unit_price: Number((price / (band.max - band.min)).toFixed(2)),
        };
    });
}

/** Which tier a lane falls in. `null` zones mean "not a Nigerian lane". */
function tierFor({ sameState, originZone, destinationZone }) {
    if (sameState) return 'same';
    if (!originZone || !destinationZone) return null;
    return zoneGap(originZone, destinationZone);
}

/** The services and prices for a lane, or null if it is not one of ours. */
function servicesFor(lane) {
    const tier = tierFor(lane);
    return tier === null ? null : TIERS[tier];
}

/**
 * The price and eta for one service on one lane, or null when this tier does
 * not sell that service — gap 3 has no road Express at air's price, and
 * `same` has no air at all.
 */
function rateFor(lane, mode, level) {
    const services = servicesFor(lane);
    if (!services) return null;
    return (
        services.find((s) => norm(s.mode) === norm(mode) && norm(s.level) === norm(level)) ?? null
    );
}

module.exports = {
    TIERS,
    ZONE_GAP,
    WEIGHT_LADDER,
    NEGOTIATED_FROM_KG,
    MINIMUM_BASE,
    atLeastMinimum,
    zoneGap,
    tierFor,
    servicesFor,
    rateFor,
    ladderFor,
};
