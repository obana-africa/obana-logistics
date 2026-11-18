'use strict';

/**
 * Every Nigerian lane, repriced against what couriers here actually charge.
 *
 * The table priced a lane by the two states it joins, so "Lagos → Lagos" was
 * one number whether the parcel went from Ikeja to the next street or from
 * Ikeja to Badagry — and that number, ₦8,800 quoted after the +₦3,000 uplift
 * and some hand edits, was two to five times what anyone in Lagos charges to
 * move a parcel across the city. At the other end the long lanes had drifted
 * above the market: Lagos → Kano Standard quoted ₦21,450 against ₦14,000–
 * 20,000. Expensive in the city, expensive up country, and in between a set
 * of services whose prices no longer matched their speeds.
 *
 * seeds/pricing2026.js carries the new figures and the November 2026 market
 * check they came from; seeds/repriceNigeria.js decides which lane a row is
 * and what its parcel bracket becomes. Both are tested without a database,
 * which is how the two rules this exists to restore are held: within a lane
 * and a mode, Express is the fastest AND the dearest.
 *
 * ── What it touches ────────────────────────────────────────────────────────
 *
 * The PARCEL bracket (up to 10 kg) of every Nigerian lane whose states this
 * table recognises. Nothing else:
 *
 *   · International lanes keep their prices. Italy → Nigeria is priced by an
 *     agreement and a per-kilo rate, not by a zone gap.
 *   · A negotiated heavy bracket survives. Lagos → Port Harcourt carries
 *     ₦585,000 from 50 kg, agreed for one job; this is a price list for
 *     parcels and that figure is not in it.
 *   · A state the table does not recognise is left alone and reported, rather
 *     than priced as a guess.
 *
 * ── What it overwrites, and why that is the point ──────────────────────────
 *
 * Prices an admin set by hand ARE replaced on the lanes it covers. That is
 * what repricing the table means, and it is the only way to clear the
 * inversions that hand edits introduced. Run scripts/preview-nigeria-prices.js
 * first: it prints every row that would move, old price to new, without
 * writing anything.
 *
 * updated_at is deliberately left alone, for the reason the ₦3,000 uplift
 * gives: the dedupe migration and removeUneditedRoutes both read it as "an
 * admin decided this", and stamping every row would disarm both.
 *
 * down() is a no-op and says so. It cannot know what each lane was priced at
 * before — the old figures were a seed, an uplift and a year of hand edits,
 * and no record of them is kept. Re-running up() is safe: a lane already at
 * the new price produces no write.
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
                `reprice-nigeria-2026: nothing to change (${rows.length} routes read, ${skipped.length} not covered).`
            );
            return;
        }

        /* One transaction: half a price list is worse than an old one. */
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
            `reprice-nigeria-2026: repriced ${edits.length} of ${rows.length} routes` +
                (skipped.length ? `, ${skipped.length} left alone (international, heavy-only or unrecognised).` : '.')
        );
    },

    async down() {
        console.log(
            'reprice-nigeria-2026: nothing to undo — the old prices were a seed, an uplift and a year of hand edits, and no record of them was kept.'
        );
    },
};
