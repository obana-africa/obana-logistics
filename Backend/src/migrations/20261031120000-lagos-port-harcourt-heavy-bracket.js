'use strict';

/**
 * The last mile is priced by the route that runs it, and that route stopped
 * at 50 kg.
 *
 * Italy to Port Harcourt is two journeys: the crossing, and the run from
 * Lagos. The run is quoted from the Lagos to Port Harcourt route, which is
 * right — it is the same truck anyone else books. But its heaviest bracket
 * ended at 50 kg, and above that the price is extrapolated from the top
 * bracket: a 245 kg job came out at ₦51,000 + 195 × ₦51,000/50 = ₦249,900,
 * which is not a price anybody agreed.
 *
 * 20261028150000 worked around that by giving the Italy lane its own last
 * mile rate, ₦550,000/131 = ₦4,198.47 a kilo. That was ₦550,000 for the 131 kg
 * job it was written for, but as a rate it scales: the same lane quoted
 * ₦1,028,626 at 245 kg. A rate was the wrong shape for it — the truck costs
 * what it costs whatever is on it — and it also meant the Italy lane, not the
 * domestic route, decided what a Lagos to Port Harcourt run was worth.
 *
 * So the rate goes, and the domestic route carries the agreed figure for a
 * heavy job: ₦585,000 from 50 kg to 250 kg. The Italy lane keeps its ₦10.09
 * a kilo for the crossing and its own handling charge, and the last mile
 * comes from Lagos to Port Harcourt, as it does for everyone else.
 *
 * Handling is then charged once on the two together — 5% of ₦3,711,787 +
 * ₦585,000 — because it is charged on the job and not on each leg.
 *
 * Reversible: down() puts the per-kilo last mile back and drops the bracket.
 */

const HEAVY = { min: 50, max: 250, price: 585000, eta: '2-4 days', unit_price: 11700 };
const HANDLING_PERCENT = 5;

/** The route that actually prices the run: Lagos to Port Harcourt by road, Standard. */
const LAST_MILE_LANE = `
    lower(COALESCE(metadata->>'origin_state', '')) = 'lagos'
    AND lower(COALESCE(metadata->>'destination_state', '')) IN ('rivers', 'rivers state')
    AND lower(transport_mode) = 'road'
    AND lower(service_level) = 'standard'
    AND lower(COALESCE(metadata->>'destination_country', 'nigeria')) = 'nigeria'`;

const ITALY_LANE = `
    lower(COALESCE(metadata->>'origin_country_code', metadata->>'origin_country', '')) IN ('it', 'italy')
    AND lower(COALESCE(metadata->>'destination_country_code', metadata->>'destination_country', '')) IN ('ng', 'nigeria')`;

module.exports = {
    async up(queryInterface) {
        const [lanes] = await queryInterface.sequelize.query(
            `SELECT id, origin_city, destination_city, weight_brackets FROM route_templates WHERE ${LAST_MILE_LANE}`,
        );

        if (!lanes.length) {
            console.warn('[ph-heavy] no Lagos to Port Harcourt road/Standard route; the last mile is unchanged');
        }

        for (const lane of lanes) {
            const brackets = Array.isArray(lane.weight_brackets) ? [...lane.weight_brackets] : [];
            /* Replace rather than append, so running this twice does not leave
               two brackets covering the same weights — which the route form
               reports as an overlap and refuses to save. */
            const kept = brackets.filter((b) => !(Number(b.min) === HEAVY.min && Number(b.max) === HEAVY.max));
            kept.push(HEAVY);
            kept.sort((a, b) => Number(a.min ?? 0) - Number(b.min ?? 0));

            await queryInterface.sequelize.query(
                'UPDATE route_templates SET weight_brackets = :brackets, updated_at = NOW() WHERE id = :id',
                { replacements: { brackets: JSON.stringify(kept), id: lane.id } },
            );
            console.log(`[ph-heavy] #${lane.id} ${lane.origin_city} → ${lane.destination_city}: 50–250 kg = ₦585,000`);
        }

        /* The Italy lane stops pricing a Nigerian road run. Its own crossing
           rate stays; only the borrowed last mile goes. */
        const [italy] = await queryInterface.sequelize.query(
            `UPDATE route_templates
                SET metadata = (metadata - 'last_mile_per_kg')
                               || jsonb_build_object('service_charge_percent', ${HANDLING_PERCENT}),
                    updated_at = NOW()
              WHERE ${ITALY_LANE}
          RETURNING id`,
        );
        console.log(
            `[ph-heavy] ${italy.length} Italy to Nigeria template(s): last mile now comes from the domestic route, ` +
                `handling ${HANDLING_PERCENT}%`,
        );
    },

    async down(queryInterface) {
        const [lanes] = await queryInterface.sequelize.query(
            `SELECT id, weight_brackets FROM route_templates WHERE ${LAST_MILE_LANE}`,
        );
        for (const lane of lanes) {
            const brackets = (Array.isArray(lane.weight_brackets) ? lane.weight_brackets : []).filter(
                (b) => !(Number(b.min) === HEAVY.min && Number(b.max) === HEAVY.max),
            );
            await queryInterface.sequelize.query(
                'UPDATE route_templates SET weight_brackets = :brackets, updated_at = NOW() WHERE id = :id',
                { replacements: { brackets: JSON.stringify(brackets), id: lane.id } },
            );
        }

        /* ₦550,000 over 131 kg, exactly as 20261028150000 left it. */
        const restored = Math.round((550000 / 131) * 100) / 100;
        await queryInterface.sequelize.query(
            `UPDATE route_templates
                SET metadata = (metadata - 'service_charge_percent')
                               || jsonb_build_object('last_mile_per_kg', ${restored}),
                    updated_at = NOW()
              WHERE ${ITALY_LANE}`,
        );
    },
};
