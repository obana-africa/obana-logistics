'use strict';

/**
 * The lanes the first pass walked past, and a real weight ladder for all of
 * them.
 *
 * 20261118120000 repriced the bracket it recognised as the parcel band — one
 * ending at 10 kg, as the seed wrote them. Two things got past it.
 *
 * It reduced a state name with plain lower-casing, while the quote engine's
 * normalizeState also drops a trailing "state", so a row stored as "Lagos
 * State" is matched as Lagos by the engine, quoted off that lane, and skipped
 * here in silence.
 *
 * And it looked for a bracket ending at 10 kg. The live Lagos Standard row
 * had been hand-edited into a single 0–90 kg bracket at ₦11,000, so it was
 * skipped too — while Express beside it repriced. That is the checkout
 * offering Express at ₦4,950 and Standard at ₦12,100: not two prices that
 * disagree, one row repriced and one row missed.
 *
 * Both are fixed in seeds/pricing2026 and seeds/repriceNigeria, which now
 * REPLACE a route's parcel brackets with a weight ladder rather than hunting
 * for one bracket to adjust — 0–1, 1–2, 2–5, 5–10, 10–20 and 20–50 kg, the
 * shape every Nigerian courier quotes in. A 1 kg parcel across Lagos is
 * ₦1,486 where it was ₦12,100; a 90 kg one is no longer the same price as a
 * shirt.
 *
 * Safe to run after the first one and safe to run twice: a lane already at
 * the 2026 price produces no write at all, so on a database where the first
 * pass caught everything this is a read and a log line.
 *
 * It exists as its own migration rather than as an edit to the first because
 * an environment that already ran 20261118120000 would never see the
 * correction otherwise — sequelize records a migration by name, not by what
 * it did.
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

        const { edits, skipped } = repriceTable(rows);

        if (!edits.length) {
            console.log(
                `reprice-nigeria-missed-lanes: nothing left to change (${rows.length} routes read, ${skipped.length} not covered).`
            );
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

        console.log(
            `reprice-nigeria-missed-lanes: repriced a further ${edits.length} of ${rows.length} routes.`
        );
    },

    async down() {
        console.log('reprice-nigeria-missed-lanes: nothing to undo — see 20261118120000.');
    },
};
