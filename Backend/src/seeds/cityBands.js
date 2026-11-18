'use strict';

/**
 * Within one state, how far the parcel actually goes.
 *
 * The route table prices a lane by the two STATES it joins, because that is
 * what laneTemplates matches on. So one Lagos row covers Ikeja → Ikeja and
 * Ikeja → Badagry alike, and a run across the street was quoted the same as a
 * run to the border of the state — about sixty kilometres and an hour and a
 * half apart.
 *
 * Rather than a row per town pair, which is a table nobody could maintain and
 * a matcher that does not exist, the lane keeps ONE price and this adjusts it
 * for the distance actually travelled. An admin still sets the lane's price in
 * Routes & pricing, and it still means what it meant: the ordinary run across
 * the city. A short hop is discounted from it and a cross-state haul is a
 * multiple of it.
 *
 * Three bands, because three is what a dispatch rider prices and anything
 * finer is a precision we do not have without a geocoder:
 *
 *   local   the same town, or next to it      × 0.65
 *   city    the ordinary run across the city  × 1     (the lane's own price)
 *   metro   right across the state            × 1.5
 *
 * Against a Lagos Standard base of ₦3,000 that is ₦2,145, ₦3,300 and ₦4,950
 * quoted — which brackets the ₦1,500–5,000 a Lagos courier charges, with the
 * short run at the bottom of it where it belongs.
 *
 * Nothing here needs a map to work. An unknown town pair falls to `city`, the
 * middle band, which is exactly what the lane charges today — so a state this
 * file has never heard of behaves as it always has.
 */

const BAND_FACTOR = { local: 0.65, city: 1, metro: 1.5 };

const norm = (v) =>
    String(v ?? '')
        .trim()
        .toLowerCase()
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        /* "Lekki Phase 1", "Ikeja GRA" and "Victoria Island, Lagos" are all
           the place before the qualifier as far as a price is concerned. */
        .replace(/\b(gra|phase \d+|extension|ext)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

/**
 * Where a town sits, as a rough grid: x runs west to east, y runs away from
 * the water. Distance is |dx| + |dy|, which is how traffic actually moves
 * through a city — along the roads, not across the lagoon.
 *
 * Coordinates are deliberately coarse. They are not coordinates of anything;
 * they exist to put two towns near or far from each other, and a map that
 * pretended to more would be a map somebody had to keep accurate.
 */
const METROS = {
    lagos: {
        // West
        badagry: [0, 0], ojo: [1, 0], agbara: [0, 1], okokomaiko: [1, 0], iba: [1, 1],
        festac: [2, 0], amuwo: [2, 0], 'amuwo odofin': [2, 0], 'satellite town': [2, 0],
        'mile 2': [2, 1], orile: [3, 1], apapa: [3, 0], ajegunle: [3, 1],
        // Mainland west and north
        ikotun: [2, 2], egbeda: [2, 2], ipaja: [2, 3], 'iyana ipaja': [2, 3],
        alimosho: [2, 2], 'abule egba': [3, 3], agege: [3, 3], ogba: [3, 2],
        // Ikeja and around
        ikeja: [3, 2], alausa: [3, 2], oregun: [4, 2], opebi: [3, 2], allen: [3, 2],
        agidingbi: [3, 2], omole: [3, 3], magodo: [4, 3], ojodu: [3, 3],
        berger: [3, 3], 'ojodu berger': [3, 3], maryland: [4, 2], ojota: [4, 2],
        // Mainland central
        mushin: [3, 1], oshodi: [3, 1], isolo: [2, 1], ilupeju: [4, 1],
        yaba: [4, 1], surulere: [4, 1], 'ebute metta': [4, 1], shomolu: [4, 2],
        bariga: [5, 2], gbagada: [5, 2], anthony: [4, 2],
        // Island
        'lagos island': [5, 0], island: [5, 0], obalende: [5, 0], marina: [5, 0],
        ikoyi: [5, 0], 'victoria island': [5, 0], vi: [5, 0], oniru: [6, 0],
        // Lekki corridor
        lekki: [7, 0], osapa: [7, 0], agungi: [7, 0], chevron: [7, 0],
        ajah: [8, 0], sangotedo: [8, 0], 'ibeju lekki': [9, 0], 'ibeju': [9, 0],
        // North and east
        ikorodu: [5, 3], agric: [5, 3], ijede: [6, 3], epe: [9, 2], eredo: [9, 2],
    },
    'abuja federal capital territory': {
        wuse: [2, 2], garki: [2, 1], maitama: [2, 3], asokoro: [3, 2],
        'central business district': [2, 2], cbd: [2, 2], 'area 1': [2, 1],
        utako: [1, 3], jabi: [1, 3], wuye: [1, 2], gudu: [2, 1], durumi: [2, 1],
        gwarinpa: [0, 4], kubwa: [0, 5], dawaki: [0, 4], lifecamp: [1, 4],
        'life camp': [1, 4], katampe: [1, 3], mpape: [2, 4],
        lugbe: [3, 0], airport: [4, 0], kuje: [5, 0],
        nyanya: [4, 2], karu: [5, 2], mararaba: [5, 2], kurudu: [4, 1],
        gwagwalada: [6, 0], bwari: [1, 6], 'zuba': [0, 5],
    },
};

/** Which metro map, if any, covers this state. */
const metroFor = (state) => {
    const s = norm(state).replace(/ state$/, '');
    if (METROS[s]) return METROS[s];
    // The capital travels under several names; they all mean the same map.
    if (['fct', 'abuja', 'federal capital territory', 'abuja fct'].includes(s)) {
        return METROS['abuja federal capital territory'];
    }
    return null;
};

/**
 * How far apart two towns in the same state are, as a band.
 *
 * The same town is always `local`, whatever this file knows about the state —
 * which is what makes Ibadan → Ibadan and Kano → Kano right for free. Beyond
 * that it needs both towns on a map, and falls to `city` when it has not got
 * them: the middle band is the lane's own price, so not knowing costs nobody
 * anything.
 */
function cityBand(state, originCity, destinationCity) {
    const from = norm(originCity);
    const to = norm(destinationCity);
    if (!from || !to) return 'city';
    if (from === to) return 'local';

    const metro = metroFor(state);
    if (!metro) return 'city';
    const a = metro[from];
    const b = metro[to];
    if (!a || !b) return 'city';

    const distance = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
    if (distance === 0) return 'local';
    if (distance <= 3) return 'city';
    return 'metro';
}

/** What to multiply the lane's price by for this band. */
const bandFactor = (band) => BAND_FACTOR[band] ?? 1;

/**
 * The price for a town pair, from the lane's own price.
 *
 * Rounded up to the nearest ₦50 — a quote reading "₦2,145" invites the
 * question of where the ₦45 came from, and the answer ("a multiplier") is not
 * one a customer should ever have to hear.
 */
function bandedPrice(basePrice, band) {
    const scaled = Number(basePrice) * bandFactor(band);
    return Math.ceil(scaled / 50) * 50;
}

module.exports = { BAND_FACTOR, METROS, cityBand, bandFactor, bandedPrice, metroFor };
