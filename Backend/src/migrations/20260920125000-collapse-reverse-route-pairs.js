'use strict';

/**
 * One row per lane, serving both directions.
 *
 * Lagos → Tunis and Tunis → Lagos were two rows at ₦128,000 each. They are not
 * two routes, they are one route written twice, and keeping them apart means
 * the day someone reprices one leg the two quietly disagree — the admin list
 * shows both, and which a customer meets depends on which way they happen to
 * be shipping.
 *
 * laneTemplates already honours metadata.bidirectional, so a single row can
 * price A → B and B → A. This collapses each reverse pair onto one row and
 * sets that flag. It also sets the flag on lanes that only exist one way,
 * which is what closes the back-and-forth gap: Abia → Lagos priced but
 * Lagos → Abia missing was the same fault in a different direction.
 *
 * Deliberately conservative where money is involved: if the two directions
 * carry DIFFERENT prices, both rows are left exactly as they are. A difference
 * is either a real one (inbound customs, a return leg sold cheaper) or a
 * mistake, and neither is for a migration to decide. Those are reported so
 * someone can look.
 *
 * Runs after the exact-duplicate pass, so each direction is already one row.
 */

const norm = (v) =>
    String(v || '')
        .trim()
        .toLowerCase()
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/ state$/, '');

const side = (m, which) =>
    `${norm(m?.[`${which}_state`])}@${norm(m?.[`${which}_country_code`] || m?.[`${which}_country`])}`;

/** The lane regardless of direction, plus the service on it. */
const pairKey = (r) => {
    const m = r.metadata || {};
    const ends = [side(m, 'origin'), side(m, 'destination')].sort();
    return `${ends[0]}<>${ends[1]}|${norm(r.transport_mode)}|${norm(r.service_level)}`;
};

/** What a row actually charges, so two rows can be compared on price alone. */
const priceShape = (r) => {
    const brackets = Array.isArray(r.weight_brackets) ? r.weight_brackets : [];
    return JSON.stringify(
        brackets
            .map((b) => [Number(b.min ?? 0), Number(b.max ?? 0), Number(b.price ?? 0), String(b.eta ?? '')])
            .sort((a, b) => a[1] - b[1])
    );
};

const edited = (r) => new Date(r.updated_at).getTime() !== new Date(r.created_at).getTime();

module.exports = {
    async up(queryInterface) {
        const [rows] = await queryInterface.sequelize.query(
            'SELECT id, transport_mode, service_level, weight_brackets, metadata, created_at, updated_at FROM route_templates'
        );

        const groups = new Map();
        for (const r of rows) {
            const k = pairKey(r);
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(r);
        }

        const toDelete = [];
        const toFlag = [];
        const disagreeing = [];

        for (const group of groups.values()) {
            const prices = new Set(group.map(priceShape));

            if (group.length > 1 && prices.size > 1) {
                // The two directions are priced differently. Leave both alone.
                disagreeing.push(group);
                continue;
            }

            /* Keep an admin-edited row over a seeded one, then the oldest, so
               repeated runs settle on the same survivor. */
            const survivor = [...group].sort(
                (a, b) => Number(edited(b)) - Number(edited(a)) || new Date(b.updated_at) - new Date(a.updated_at) || a.id - b.id
            )[0];

            for (const r of group) if (r.id !== survivor.id) toDelete.push(r.id);
            if (!survivor.metadata?.bidirectional) toFlag.push(survivor.id);
        }

        if (toDelete.length) {
            await queryInterface.sequelize.query('DELETE FROM route_templates WHERE id IN (:ids)', {
                replacements: { ids: toDelete },
            });
        }

        if (toFlag.length) {
            /* jsonb_set writes the flag without disturbing the rest of the
               metadata, and updated_at is left alone so this does not look like
               an admin edit to the seed-removal logic. */
            await queryInterface.sequelize.query(
                `UPDATE route_templates
                    SET metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{bidirectional}', 'true'::jsonb, true)
                  WHERE id IN (:ids)`,
                { replacements: { ids: toFlag } }
            );
        }

        console.log(
            `collapse-reverse-route-pairs: ${rows.length} routes → removed ${toDelete.length} reverse duplicate(s), ` +
                `made ${toFlag.length} lane(s) bidirectional.`
        );
        for (const group of disagreeing) {
            const m = group[0].metadata || {};
            console.log(
                `  kept both directions (prices differ): ${m.origin_state} ↔ ${m.destination_state} ` +
                    `${group[0].transport_mode}/${group[0].service_level} — ids ${group.map((r) => r.id).join(', ')}`
            );
        }
    },

    async down(queryInterface) {
        // The removed rows were duplicates of the survivor and cannot be
        // meaningfully restored. Clearing the flag is the reversible half, and
        // it is what actually changes behaviour.
        await queryInterface.sequelize.query(
            `UPDATE route_templates SET metadata = metadata - 'bidirectional' WHERE metadata ? 'bidirectional'`
        );
        console.log('collapse-reverse-route-pairs: bidirectional flags cleared; merged rows are not restored.');
    },
};
