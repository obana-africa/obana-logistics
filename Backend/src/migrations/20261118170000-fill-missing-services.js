'use strict';

/**
 * The services a lane should sell and does not.
 *
 * The seed that built the table gave each tier a different set, and two of
 * them have holes that nobody notices until a customer looks for the option
 * that is not there:
 *
 *   · Every intra-state lane — all 37 of them — has Standard and Express and
 *     no Economy. A shopper sending a parcel across one city has no cheap
 *     option at all, on the shortest and most common journey there is.
 *   · Every lane from the south to the far north has road Standard, road
 *     Economy and AIR Express, and no road Express. Someone who wants it
 *     faster than Standard without paying for a flight has nothing to pick.
 *
 * The reprice could not fix this: it changes the price of rows that exist and
 * has no business inventing rows. This does exactly that and nothing else.
 *
 * Each new row is built FROM a row already on that lane — same origin and
 * destination city, same metadata, including whichever spelling of the state
 * and whether the lane is bidirectional. Copying beats constructing: a lane
 * stored as "Lagos State" keeps that spelling, and the new row matches the
 * quote engine exactly as its siblings do. Only the mode, the service level
 * and the weight brackets are ours.
 *
 * Prices come from the same 2026 table and the same weight ladder as every
 * other repriced row, so an Economy city run is cheaper and slower than the
 * Standard beside it on the day it appears.
 *
 * Idempotent: a service already on a lane is never added twice, so running
 * this again inserts nothing.
 */

const { laneOf } = require('../seeds/repriceNigeria');
const { ladderFor, servicesFor } = require('../seeds/pricing2026');

const norm = (v) => String(v ?? '').trim().toLowerCase();

module.exports = {
    async up(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(
            `SELECT id, origin_city, destination_city, transport_mode, service_level, metadata
               FROM route_templates`
        );

        /* Group by the lane, as the row itself spells it. */
        const lanes = new Map();
        for (const row of rows) {
            const lane = laneOf(row);
            if (!lane) continue;
            const key = `${lane.from}>${lane.to}`;
            if (!lanes.has(key)) lanes.set(key, { lane, rows: [] });
            lanes.get(key).rows.push(row);
        }

        const now = new Date();
        const toAdd = [];
        for (const { lane, rows: onLane } of lanes.values()) {
            const wanted = servicesFor(lane) ?? [];
            const present = new Set(
                onLane.map((r) => `${norm(r.transport_mode)}|${norm(r.service_level)}`)
            );
            /* The row to copy. The oldest on the lane, so a new service
               inherits the lane as it was set up rather than as somebody last
               edited one corner of it. */
            const template = onLane.reduce((a, b) => (a.id <= b.id ? a : b));

            for (const service of wanted) {
                const key = `${norm(service.mode)}|${norm(service.level)}`;
                if (present.has(key)) continue;
                const brackets = ladderFor(lane, service.mode, service.level);
                if (!brackets) continue;
                toAdd.push({
                    origin_city: template.origin_city,
                    destination_city: template.destination_city,
                    transport_mode: service.mode,
                    service_level: service.level,
                    weight_brackets: JSON.stringify(brackets),
                    metadata: JSON.stringify({
                        ...(template.metadata || {}),
                        /* Its own mark, so removeUneditedRoutes and the
                           dedupe pass can tell where it came from. */
                        seed: 'fill-missing-services-2026-11',
                    }),
                    created_at: now,
                    updated_at: now,
                });
            }
        }

        if (!toAdd.length) {
            console.log(
                `fill-missing-services: every lane already sells every service its tier offers (${lanes.size} lanes read).`
            );
            return;
        }

        await queryInterface.bulkInsert('route_templates', toAdd);
        const byService = toAdd.reduce((acc, r) => {
            const k = `${r.transport_mode} ${r.service_level}`;
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
        }, {});
        console.log(
            `fill-missing-services: added ${toAdd.length} routes across ${lanes.size} lanes — ` +
                Object.entries(byService)
                    .map(([k, n]) => `${n} × ${k}`)
                    .join(', ')
        );
    },

    async down(queryInterface) {
        /* Only the ones this added, and only where nobody has priced them
           since — an admin edit bumps updated_at, and a price somebody set by
           hand is not ours to delete. */
        await queryInterface.sequelize.query(
            `DELETE FROM route_templates
              WHERE metadata->>'seed' = 'fill-missing-services-2026-11'
                AND updated_at = created_at`
        );
    },
};
