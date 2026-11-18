'use strict';

/**
 * Write the floor into the prices themselves.
 *
 * The floor was added in two places: ladderFor, which decides what a route's
 * brackets say, and laneOptions, which lifts a banded intra-state price back
 * over it at quote time. Neither helped the rows already in the table.
 *
 * 20261118150000 wrote the weight ladder BEFORE the floor existed, so the
 * Lagos Standard 0–1 kg band went in at ₦1,350. Sequelize records a migration
 * by name, so correcting that file would never re-run it. And the quote-time
 * lift only covers the intra-state path — every other lane carries whatever
 * the ladder wrote.
 *
 * So: re-run the sweep, with a floor-aware ladder this time. A partner's
 * checkout was showing a ₦990 pickup, which is the number that proved the
 * point — at that price the job does not get done, it gets accepted and then
 * quietly dropped, and the customer is the one who finds out.
 *
 * Nothing else changes. repriceTable writes the same 2026 table it always
 * has, and a route already carrying those figures produces no write, so on a
 * lane where only the floor moves, only the floor moves.
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
            console.log(`apply-minimum-to-ladders: every route already carries the floor (${rows.length} read).`);
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

        console.log(`apply-minimum-to-ladders: lifted ${edits.length} of ${rows.length} routes onto the floor.`);
    },

    async down() {
        console.log('apply-minimum-to-ladders: nothing to undo — see 20261118120000.');
    },
};
