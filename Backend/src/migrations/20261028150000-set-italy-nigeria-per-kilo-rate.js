'use strict';

/**
 * Italy to Nigeria, priced by the kilo in the currency it was agreed in.
 *
 * The lane was a flat ₦2,157,777 for anything up to 131 kg — a one-kilo
 * parcel cost what a hundred-and-thirty-one-kilo one did — and €10.09 a kilo
 * is what it is actually sold at. Held in euros because that is the agreement:
 * stored as naira it would drift every day the rate moved, and the figure on
 * our invoice would stop matching the forwarder's.
 *
 * The last mile gets its own rate rather than borrowing the domestic lane it
 * runs over. Door delivery after an arrival is not the journey somebody books
 * on its own, and pricing it from that lane would have repriced every direct
 * booking on it — a four-fold rise for customers not involved in this at all.
 *
 * Reversible: down() removes both and the lane returns to its brackets.
 */

const PER_KG_EUR = 10.09;
/* ₦550,000 for 131 kg, which is what the last mile is sold at. */
const LAST_MILE_PER_KG_NGN = Math.round((550000 / 131) * 100) / 100;

module.exports = {
    async up(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(
            `SELECT id, metadata FROM route_templates
              WHERE lower(COALESCE(metadata->>'origin_country_code', metadata->>'origin_country', '')) IN ('it', 'italy')
                AND lower(COALESCE(metadata->>'destination_country_code', metadata->>'destination_country', '')) IN ('ng', 'nigeria')`,
        );

        if (!rows.length) {
            console.warn('[italy-rate] no Italy to Nigeria route template found; nothing changed');
            return;
        }

        for (const row of rows) {
            const metadata = {
                ...(row.metadata ?? {}),
                price_per_kg: PER_KG_EUR,
                price_currency: 'EUR',
                last_mile_per_kg: LAST_MILE_PER_KG_NGN,
            };
            await queryInterface.sequelize.query(
                'UPDATE route_templates SET metadata = :metadata, updated_at = NOW() WHERE id = :id',
                { replacements: { metadata: JSON.stringify(metadata), id: row.id } },
            );
        }
        console.log(
            `[italy-rate] ${rows.length} Italy to Nigeria template(s) now price at EUR ${PER_KG_EUR}/kg, ` +
                `last mile NGN ${LAST_MILE_PER_KG_NGN}/kg`,
        );
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(
            `UPDATE route_templates
                SET metadata = metadata - 'price_per_kg' - 'price_currency' - 'last_mile_per_kg',
                    updated_at = NOW()
              WHERE metadata ? 'price_per_kg' OR metadata ? 'last_mile_per_kg'`,
        );
    },
};
