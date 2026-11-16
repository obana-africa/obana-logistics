'use strict';

/**
 * Stop offering a slower delivery at a higher price.
 *
 * TheOutlet.NG's checkout was showing, for a 1 kg parcel inside Lagos:
 *
 *     Obana Logistics · Express    0-1 days    ₦8,800
 *     Obana Logistics · Standard   1 day      ₦12,100
 *
 * Standard was slower and ₦3,300 dearer, so there was no reason on earth to
 * pick it. The seed had this lane the right way round — Standard ₦6,500,
 * Express ₦9,000 — so the two figures were entered against the wrong services
 * at some point in Routes & pricing, and the same thing has happened on other
 * lanes since: Lagos to Abuja by road was selling Standard at ₦23,000 against
 * Express at ₦21,500.
 *
 * This does not reprice anything. Within one lane, by one transport mode, in
 * one weight band, it deals the prices already there out again so the fastest
 * service holds the highest of them. The lane keeps exactly the money it had;
 * only which service carries which figure changes. ETAs are not touched, so
 * each service keeps its own promise and the customer sees a faster option
 * costing more, which is the shape the whole page assumes.
 *
 * Air is never ranked against road. Lagos to Abuja sells air Express at
 * ₦15,000 and road Express at ₦21,500, and air being the cheaper of the two
 * is a different journey rather than a mistake.
 *
 * A band whose figures are more than a factor of three apart is reported and
 * left alone. ₦15,000 against ₦585,000 is not a swapped pair — it is one
 * figure that does not belong in that band — and reordering it would move a
 * wrong number instead of fixing it. Those lanes need a person.
 *
 * updated_at is deliberately left alone, for the reason the ₦3,000 uplift
 * gives: the dedupe migration and removeUneditedRoutes both read it as "an
 * admin decided this", and touching every row would disarm them.
 *
 * down() is a no-op, and that is the honest answer. The only thing it could
 * restore is the inversion, which nobody wants back, and the migration keeps
 * no record of which way round each pair used to be. Running up() again is
 * safe: a lane already in order produces no write at all.
 */

const { orderTableBySpeed } = require('../seeds/priceOrder');

const CHUNK = 200;

module.exports = {
    async up(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(
            `SELECT id, transport_mode, service_level, metadata, weight_brackets
               FROM route_templates
              WHERE jsonb_typeof(weight_brackets) = 'array'
                AND jsonb_array_length(weight_brackets) > 0`,
        );

        const { edits, skipped, lanes } = orderTableBySpeed(rows);

        for (const s of skipped) {
            console.log(`price-follows-speed: left ${s.lane} band ${s.band} alone — ${s.reason}`);
        }

        if (!edits.length) {
            console.log(`price-follows-speed: nothing to change (${rows.length} routes, ${lanes} lanes).`);
            return;
        }

        /* One transaction: a lane with one half of a pair moved is worse than
           a lane with neither. */
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (let i = 0; i < edits.length; i += CHUNK) {
                const slice = edits.slice(i, i + CHUNK);
                const values = slice.map((_, n) => `(:id${n}::int, :brackets${n}::jsonb)`).join(', ');
                const replacements = {};
                slice.forEach((edit, n) => {
                    replacements[`id${n}`] = edit.id;
                    replacements[`brackets${n}`] = JSON.stringify(edit.brackets);
                });

                await queryInterface.sequelize.query(
                    `UPDATE route_templates AS t
                        SET weight_brackets = v.brackets
                       FROM (VALUES ${values}) AS v(id, brackets)
                      WHERE t.id = v.id`,
                    { replacements, transaction },
                );
            }
        });

        console.log(
            `price-follows-speed: reordered ${edits.length} of ${rows.length} routes across ${lanes} lanes` +
                (skipped.length ? `, ${skipped.length} band(s) left for review.` : '.'),
        );
    },

    async down() {
        console.log('price-follows-speed: nothing to undo — the only thing to restore is the inversion.');
    },
};
