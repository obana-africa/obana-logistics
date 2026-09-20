'use strict';

/**
 * Collapse duplicate route templates to one row per lane.
 *
 * A lane is (origin state + country, destination state + country, transport
 * mode, service level) — the same key routesController matches on. Two rows
 * with that key are not two options, they are one option priced twice, and
 * which of them a customer is quoted depends on nothing more than row order.
 *
 * Which row survives, in order:
 *   1. one an admin has edited since it was seeded (updated_at <> created_at)
 *   2. of those, the most recently edited
 *   3. otherwise the lowest id, so repeated seeding keeps the original
 *
 * A hand-priced route therefore always beats a seeded one, which is the whole
 * point: seeds are a starting position, an admin's price is a decision.
 *
 * Irreversible by nature — down() cannot invent rows back, and re-creating
 * duplicates would undo the fix rather than the migration.
 */

// The same normalising as norm() in seeds/routeSeed.js and routesController:
// lower, trim, dashes and underscores to spaces, collapse spaces, drop a
// trailing " state", so "Lagos State" and "lagos" are one lane.
const NORM = (expr) => `
    regexp_replace(
        regexp_replace(
            regexp_replace(lower(btrim(coalesce(${expr}, ''))), '[-_]', ' ', 'g'),
        '\\s+', ' ', 'g'),
    '\\s+state$', '')`;

const LANE_KEY = `
    ${NORM("metadata->>'origin_state'")} || '@' ||
    ${NORM("coalesce(metadata->>'origin_country_code', metadata->>'origin_country')")} || '>' ||
    ${NORM("metadata->>'destination_state'")} || '@' ||
    ${NORM("coalesce(metadata->>'destination_country_code', metadata->>'destination_country')")} || '|' ||
    ${NORM('transport_mode')} || '|' ||
    ${NORM('service_level')}`;

module.exports = {
    async up(queryInterface) {
        const [[before]] = await queryInterface.sequelize.query('SELECT COUNT(*)::int AS n FROM route_templates');

        const [dupes] = await queryInterface.sequelize.query(`
            SELECT COUNT(*)::int AS lanes, (SUM(n) - COUNT(*))::int AS extra
            FROM (SELECT ${LANE_KEY} AS lane, COUNT(*)::int AS n FROM route_templates GROUP BY 1 HAVING COUNT(*) > 1) d
        `);
        const lanes = dupes[0]?.lanes ?? 0;
        const extra = dupes[0]?.extra ?? 0;

        if (!extra) {
            console.log(`dedupe-route-templates: ${before.n} routes, no duplicate lanes — nothing to do.`);
            return;
        }

        await queryInterface.sequelize.query(`
            DELETE FROM route_templates WHERE id IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (
                        PARTITION BY ${LANE_KEY}
                        ORDER BY (updated_at <> created_at) DESC, updated_at DESC, id ASC
                    ) AS rn
                    FROM route_templates
                ) ranked WHERE rn > 1
            )
        `);

        const [[after]] = await queryInterface.sequelize.query('SELECT COUNT(*)::int AS n FROM route_templates');
        console.log(
            `dedupe-route-templates: ${lanes} lane(s) had duplicates; removed ${extra} row(s). ` +
                `${before.n} → ${after.n} routes. Admin-edited rows were kept over seeded ones.`
        );
    },

    async down() {
        // Deliberately empty. The duplicates carried no information the kept
        // row does not, and putting them back would restore the bug.
        console.log('dedupe-route-templates: nothing to undo — duplicates are not restored.');
    },
};
