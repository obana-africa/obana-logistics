'use strict';

/**
 * Every Nigerian state to every other, in both directions.
 *
 * The earlier seed priced Lagos to everywhere, which is most of the traffic and
 * none of the edge. A vendor in Aba selling to a customer in Ughelli asked for
 * Abia → Delta, got nothing, and the checkout reported "no routes available" —
 * which reads as an outage and is really a gap in this table.
 *
 * One row per unordered pair, flagged bidirectional, plus each state's own
 * intra-state lane (Aba → Umuahia is still a delivery). Writing each direction
 * as its own row would double the table and reproduce exactly the duplication
 * the pass before this one exists to remove.
 *
 * Prices are NGN for a parcel up to 10 kg, heavier charged pro rata (see
 * priceTemplate). They follow the six geopolitical zones, which is how Nigerian
 * couriers actually price: intra-state is a city run, intra-zone is a short
 * hop, and Lagos → Maiduguri crosses the country. The figures continue the
 * scale the Lagos seed already set (GIGL Lagos → Abuja ≈ ₦14,500 for 10 kg in
 * September 2026) rather than inventing a second scale beside it.
 *
 * Only lanes that do not already exist are inserted, so every price an admin
 * has set — and every Lagos lane from the earlier seed — is left exactly as it
 * is. Undo removes only what nobody has edited since.
 */

const { svc, routeRows, insertMissingRoutes, removeUneditedRoutes } = require('../seeds/routeSeed');

const SEED = 'nigeria-interstate-2026-09';

// [state (as the location picker names it), state code, main city, geopolitical zone]
const NIGERIA = [
    ['Lagos', 'LA', 'Lagos', 'SW'],
    ['Ogun', 'OG', 'Abeokuta', 'SW'],
    ['Oyo', 'OY', 'Ibadan', 'SW'],
    ['Osun', 'OS', 'Osogbo', 'SW'],
    ['Ondo', 'ON', 'Akure', 'SW'],
    ['Ekiti', 'EK', 'Ado-Ekiti', 'SW'],

    ['Edo', 'ED', 'Benin City', 'SS'],
    ['Delta', 'DE', 'Asaba', 'SS'],
    ['Rivers', 'RI', 'Port Harcourt', 'SS'],
    ['Bayelsa', 'BY', 'Yenagoa', 'SS'],
    ['Akwa Ibom', 'AK', 'Uyo', 'SS'],
    ['Cross River', 'CR', 'Calabar', 'SS'],

    ['Anambra', 'AN', 'Awka', 'SE'],
    ['Enugu', 'EN', 'Enugu', 'SE'],
    ['Imo', 'IM', 'Owerri', 'SE'],
    ['Abia', 'AB', 'Umuahia', 'SE'],
    ['Ebonyi', 'EB', 'Abakaliki', 'SE'],

    ['Kwara', 'KW', 'Ilorin', 'NC'],
    ['Kogi', 'KO', 'Lokoja', 'NC'],
    ['Abuja Federal Capital Territory', 'FC', 'Abuja', 'NC'],
    ['Niger', 'NI', 'Minna', 'NC'],
    ['Nasarawa', 'NA', 'Lafia', 'NC'],
    ['Benue', 'BE', 'Makurdi', 'NC'],
    ['Plateau', 'PL', 'Jos', 'NC'],

    ['Kaduna', 'KD', 'Kaduna', 'NW'],
    ['Kano', 'KN', 'Kano', 'NW'],
    ['Katsina', 'KT', 'Katsina', 'NW'],
    ['Jigawa', 'JI', 'Dutse', 'NW'],
    ['Sokoto', 'SO', 'Sokoto', 'NW'],
    ['Zamfara', 'ZA', 'Gusau', 'NW'],
    ['Kebbi', 'KE', 'Birnin Kebbi', 'NW'],

    ['Bauchi', 'BA', 'Bauchi', 'NE'],
    ['Gombe', 'GO', 'Gombe', 'NE'],
    ['Adamawa', 'AD', 'Yola', 'NE'],
    ['Taraba', 'TA', 'Jalingo', 'NE'],
    ['Yobe', 'YO', 'Damaturu', 'NE'],
    ['Borno', 'BO', 'Maiduguri', 'NE'],
];

/**
 * How far apart two zones are: 0 same zone, 1 neighbouring, 2 across the
 * south, 3 south to the far north. Unordered — a pair is looked up either way.
 */
const ZONE_GAP = {
    'SW|SS': 1, 'SW|NC': 1, 'SS|SE': 1, 'SE|NC': 1, 'SS|NC': 1, 'NC|NW': 1, 'NC|NE': 1, 'NW|NE': 1,
    'SW|SE': 2,
    'SW|NW': 3, 'SW|NE': 3, 'SS|NW': 3, 'SS|NE': 3, 'SE|NW': 3, 'SE|NE': 3,
};

const gap = (a, b) => (a === b ? 0 : ZONE_GAP[`${a}|${b}`] ?? ZONE_GAP[`${b}|${a}`] ?? 3);

/** Services by how far the parcel travels. Air only where road is a long haul. */
const TIER = {
    // Within one state: a city run.
    same: [svc('road', 'Standard', 6500, '1-2'), svc('road', 'Express', 9000, '0-1')],
    // Within a zone: Aba to Owerri, Kano to Katsina.
    0: [svc('road', 'Standard', 9500, '1-3'), svc('road', 'Express', 13000, '1-2'), svc('road', 'Economy', 7500, '3-5')],
    // Neighbouring zones: Lagos to Benin, Abuja to Jos.
    1: [svc('road', 'Standard', 14000, '2-4'), svc('road', 'Express', 18500, '1-3'), svc('road', 'Economy', 11000, '4-7')],
    // Across the south: Lagos to Enugu.
    2: [svc('road', 'Standard', 16000, '2-5'), svc('road', 'Express', 21000, '1-3'), svc('road', 'Economy', 12500, '5-8')],
    // South to the far north: Lagos to Maiduguri. Air earns its place here.
    3: [svc('road', 'Standard', 19500, '3-6'), svc('road', 'Economy', 15500, '5-9'), svc('air', 'Express', 31000, '1-3')],
};

const place = ([state, stateCode, city]) => ({ city, state, stateCode, country: 'Nigeria', countryCode: 'NG' });

/**
 * One row per pair, serving both directions.
 *
 * insertMissingRoutes skips a lane that already exists, which on its own would
 * leave an old one-way Lagos → Ogun row blocking this row and Ogun → Lagos
 * still uncovered. The pass before this one closes that: it has already made
 * every existing lane bidirectional, so a lane that is skipped here is a lane
 * that already works in both directions.
 */
const buildRoutes = () => {
    const routes = [];
    for (let i = 0; i < NIGERIA.length; i += 1) {
        // j starts at i so each state also gets its own intra-state lane.
        for (let j = i; j < NIGERIA.length; j += 1) {
            const from = NIGERIA[i];
            const to = NIGERIA[j];
            const services = i === j ? TIER.same : TIER[gap(from[3], to[3])];
            routes.push(
                ...routeRows({
                    from: place(from),
                    to: place(to),
                    services,
                    seed: SEED,
                    extra: i === j ? {} : { bidirectional: true },
                })
            );
        }
    }
    return routes;
};

module.exports = {
    async up(queryInterface) {
        const routes = buildRoutes();
        await insertMissingRoutes(queryInterface, routes, 'nigeria-interstate');
    },

    async down(queryInterface) {
        await removeUneditedRoutes(queryInterface, SEED);
    },
};
