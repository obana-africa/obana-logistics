'use strict';

/**
 * Write the per-journey floor into the prices.
 *
 * 20261118190000 put ONE flat ₦2,000 floor under every lane in the table.
 * That is right for a rider crossing Lagos and wrong for a 300 km haul: a
 * 0.2 kg parcel from Ikeja to Ado-Ekiti came out at ₦2,200, which is less
 * than GIGL charges to cross a single city, and every journey cost the same
 * for anything under a kilo.
 *
 * The floor is now what the JOB is worth, per tier — ₦2,000 within a state,
 * up to ₦5,500 south to the far north — and this writes that into the rows.
 * Same sweep, same 2026 table; only the bottom of each ladder moves, and a
 * route already carrying the right figures produces no write.
 */

const { repriceTable } = require('../seeds/repriceNigeria');

const CHUNK = 200;

module.exports = {
    async up(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(
            `SELECT id, transport_mode, service_level, metadata, weight_brackets
               FROM route_templates
              WHERE jsonb_typeof(weight_brackets) = 'array'
                AND jsonb_array_length(weight_brackets) > 0`
        );

        const { edits } = repriceTable(rows);
        if (!edits.length) {
            console.log(`apply-per-tier-minimum: every route already carries the floor (${rows.length} read).`);
            return;
        }

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
                    { replacements, transaction }
                );
            }
        });

        console.log(`apply-per-tier-minimum: lifted ${edits.length} of ${rows.length} routes onto the floor.`);
    },

    async down() {
        console.log('apply-per-tier-minimum: nothing to undo — see 20261118120000.');
    },
};
