'use strict';

/**
 * Add ₦3,000 to every route's price.
 *
 * route_templates holds Obana's own lanes and nothing else — partner carrier
 * rates are fetched live from the partner API at quote time and are not in
 * this table — so every row here is ours to reprice.
 *
 * The amount goes on each weight bracket rather than once per route. A
 * bracket's price is the whole charge for a parcel inside its band, not a
 * step added to the band below, so adding it per bracket is what makes every
 * shipment on the route cost ₦3,000 more whatever it weighs.
 *
 * What a customer is actually quoted moves by more than ₦3,000: priceTemplate
 * applies ROUTE_MARKUP_PERCENT (10 by default) to the total, so a ₦3,000
 * uplift reaches them as ₦3,300. That is how every other price change on this
 * table has behaved, and the number admins see in Routes & pricing is the one
 * raised here.
 *
 * updated_at is deliberately left alone. Two things read it as "an admin
 * decided this price": the dedupe migration keeps the edited row of a
 * duplicated lane, and removeUneditedRoutes only withdraws seeded routes
 * nobody has touched. Bumping it on every row would make the whole table look
 * hand-priced and quietly disarm both.
 *
 * down() takes the ₦3,000 back off. It cannot know whether a price was
 * changed in between, so it subtracts from whatever is there now; a price
 * below ₦3,000 floors at zero rather than going negative.
 */

const { upliftBrackets } = require('../seeds/routeUplift');

const UPLIFT_NGN = 3000;
const CHUNK = 200;

const move = async (queryInterface, amount, label) => {
    const [rows] = await queryInterface.sequelize.query(
        "SELECT id, weight_brackets FROM route_templates WHERE jsonb_typeof(weight_brackets) = 'array' AND jsonb_array_length(weight_brackets) > 0",
    );

    const edits = [];
    for (const row of rows) {
        const { brackets, changed } = upliftBrackets(row.weight_brackets, amount);
        if (changed) edits.push({ id: row.id, brackets });
    }

    if (!edits.length) {
        console.log(`${label}: nothing to change (${rows.length} routes read).`);
        return;
    }

    /* One transaction: a half-repriced table is worse than an unrepriced one. */
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

    console.log(`${label}: repriced ${edits.length} of ${rows.length} routes by ${amount >= 0 ? '+' : ''}₦${amount}.`);
};

module.exports = {
    up: (queryInterface) => move(queryInterface, UPLIFT_NGN, 'raise-route-prices'),
    down: (queryInterface) => move(queryInterface, -UPLIFT_NGN, 'raise-route-prices (undo)'),
};
