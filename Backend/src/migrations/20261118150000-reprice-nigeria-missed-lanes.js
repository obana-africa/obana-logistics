'use strict';

/**
 * The lanes the first pass walked past.
 *
 * 20261118120000 reprices a route by looking its two states up in a table.
 * It reduced a name with plain lower-casing, while the quote engine's
 * normalizeState also drops a trailing "state" — so a row stored as "Lagos
 * State" is matched as Lagos by the engine, quoted off that lane, and was
 * silently skipped by the reprice. It kept its old price while every lane
 * around it moved, and said nothing about it.
 *
 * The reduction now mirrors the engine's exactly, in seeds/repriceNigeria.
 * This runs the same sweep again to catch what that fixes.
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
