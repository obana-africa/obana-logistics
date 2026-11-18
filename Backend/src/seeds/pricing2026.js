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
    const norm = (v) => String(v ?? '').trim().toLowerCase();
    return (
        services.find((s) => norm(s.mode) === norm(mode) && norm(s.level) === norm(level)) ?? null
    );
}

module.exports = { TIERS, ZONE_GAP, zoneGap, tierFor, servicesFor, rateFor };
