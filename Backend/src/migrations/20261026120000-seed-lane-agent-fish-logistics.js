'use strict';

/**
 * Fish Logistics — the vendor handling China → Nigeria for Obana.
 *
 * Written the same way as the Italy → Nigeria agent: three rows, not one. The
 * login in `users`, the role and name in `user_attributes` (keyed by slug
 * through `attributes`, the way createUserAttributes does it), and the agent
 * record itself. A migration rather than a seeder because only migrations run
 * on deploy — `prestart` is `migrate:up`.
 *
 * The lane goes in `assigned_zone` as "CN>NG", which is all that is needed for
 * "any shipment from China to Nigeria gets this agent": shipment creation
 * builds the lane from the two addresses' country codes and looks for an
 * active agent holding it. No code change, and the next corridor or a change
 * of vendor on this one is a row an admin edits.
 *
 * Existing China → Nigeria shipments still in flight are moved over too. One
 * that has already been delivered is history and is left alone, and one with a
 * driver on it is somebody's live assignment, so it is left alone as well.
 *
 * No password is set: a hash in a migration is a shared secret in the git
 * history. The account exists and its holder sets their own through the reset
 * flow. Nothing about assignment needs the login to work.
 *
 * Idempotent, and it re-points an existing record rather than making a second
 * one: the agent_code is the identity.
 */

const AGENT_CODE = 'OBANA-AGT-FISH-LOGISTICS';
const LANE = 'CN>NG';
const NAME = { first: 'Fish', last: 'Logistics' };

/* The warehouse, as the vendor gave it. `agents` has country/state/city and no
   street line, so the full address is kept as a user attribute — which is also
   where the names live. Nothing renders it yet; it is here so it is not lost. */
const ADDRESS =
    'Air Cargo Warehouse - Shop A2015-A2017 Yung Fu building, No 218 Guang Yaun Xi Rd, Yue Diu District, Guangzhou';

/* Overridable so the real address and number can be set on the service without
   a code change. The default address is a placeholder and will not receive mail. */
const EMAIL = (process.env.AGENT_FISH_EMAIL || 'fish.logistics@obana.africa').toLowerCase();
const PHONE = process.env.AGENT_FISH_PHONE || '+8613728035524';

module.exports = {
    async up(queryInterface) {
        const q = (sql, replacements) =>
            queryInterface.sequelize.query(sql, {
                replacements,
                type: queryInterface.sequelize.QueryTypes.SELECT,
            });

        const [existing] = await q('SELECT id, user_id FROM agents WHERE agent_code = :code LIMIT 1', { code: AGENT_CODE });

        /* The login. An address already in use belongs to somebody, so it is
           adopted rather than duplicated — users.email has no unique index. */
        let userId = existing?.user_id ?? null;
        if (!userId) {
            const [found] = await q('SELECT id FROM users WHERE lower(email) = :email ORDER BY id LIMIT 1', { email: EMAIL });
            userId = found?.id ?? null;
        }
        if (!userId) {
            const [created] = await q(
                `INSERT INTO users (email, phone, "createdAt", "updatedAt")
                 VALUES (:email, :phone, NOW(), NOW())
                 RETURNING id`,
                { email: EMAIL, phone: PHONE }
            );
            userId = created.id;
        }

        /* Role, name and the warehouse address, as attributes keyed by slug. */
        for (const [slug, value] of [
            ['role', 'agent'],
            ['first_name', NAME.first],
            ['last_name', NAME.last],
            ['address', ADDRESS],
        ]) {
            let [attribute] = await q('SELECT id FROM attributes WHERE slug = :slug LIMIT 1', { slug });
            if (!attribute) {
                [attribute] = await q(
                    `INSERT INTO attributes (name, slug, "createdAt", "updatedAt")
                     VALUES (:name, :slug, NOW(), NOW()) RETURNING id`,
                    { name: slug.replace(/_/g, ' '), slug }
                );
            }
            const [row] = await q(
                'SELECT id FROM user_attributes WHERE user_id = :userId AND attribute_id = :attributeId LIMIT 1',
                { userId, attributeId: attribute.id }
            );
            if (row) {
                await queryInterface.sequelize.query(
                    'UPDATE user_attributes SET value = :value, "updatedAt" = NOW() WHERE id = :id',
                    { replacements: { value, id: row.id } }
                );
            } else {
                await queryInterface.sequelize.query(
                    `INSERT INTO user_attributes (user_id, attribute_id, value, "createdAt", "updatedAt")
                     VALUES (:userId, :attributeId, :value, NOW(), NOW())`,
                    { replacements: { userId, attributeId: attribute.id, value } }
                );
            }
        }

        /* The agent. Verified and active, because this is a vendor Obana
           already works with — not a sign-up waiting to be checked. */
        const fields = {
            userId,
            code: AGENT_CODE,
            lane: LANE,
            country: 'China',
            state: 'Guangdong',
            city: 'Guangzhou',
        };
        if (existing) {
            await queryInterface.sequelize.query(
                `UPDATE agents SET user_id = :userId, assigned_zone = :lane, country = :country,
                        state = :state, city = :city, status = 'active',
                        verification_status = 'verified', "updatedAt" = NOW()
                 WHERE agent_code = :code`,
                { replacements: fields }
            );
        } else {
            await queryInterface.sequelize.query(
                `INSERT INTO agents (agent_code, user_id, assigned_zone, country, state, city,
                                     status, verification_status, "createdAt", "updatedAt")
                 VALUES (:code, :userId, :lane, :country, :state, :city,
                         'active', 'verified', NOW(), NOW())`,
                { replacements: fields }
            );
        }

        const [agent] = await q('SELECT id FROM agents WHERE agent_code = :code LIMIT 1', { code: AGENT_CODE });
        if (!agent) return;

        /* The shipments already on this lane.
         *
         * The country is matched on the address rows rather than on a stored
         * lane, because a shipment keeps no lane of its own — creation works
         * it out from the two addresses and then only the agent_id remains.
         * Two spellings are accepted, the name and the code, because both
         * reach the addresses table depending on where the booking came from.
         *
         * Only what is still moving, and only what nobody is already carrying:
         * a delivered shipment is a record of what happened, and one with a
         * driver on it is a live assignment that is not ours to re-point. */
        const moved = await queryInterface.sequelize.query(
            `UPDATE shippings s
                SET agent_id = :agentId, "updatedAt" = NOW()
              FROM addresses p, addresses d
             WHERE s.pickup_address_id = p.id
               AND s.delivery_address_id = d.id
               AND upper(trim(p.country)) IN ('CHINA', 'CN')
               AND upper(trim(d.country)) IN ('NIGERIA', 'NG')
               AND s.status NOT IN ('delivered', 'cancelled', 'failed')
               AND s.driver_id IS NULL
               AND (s.agent_id IS NULL OR s.agent_id <> :agentId)
         RETURNING s.shipment_reference`,
            { replacements: { agentId: agent.id }, type: queryInterface.sequelize.QueryTypes.SELECT }
        );

        const references = (moved || []).map((r) => r.shipment_reference);
        console.log(
            `[fish-logistics] lane ${LANE} -> agent ${AGENT_CODE} (id ${agent.id}); ` +
                `${references.length} in-flight shipment(s) moved over` +
                (references.length ? `: ${references.join(', ')}` : '')
        );
    },

    async down(queryInterface) {
        /* The agent goes; the user stays. Shipments reference agents.id, and a
           user may have been adopted rather than created here. The shipments
           are released rather than pointed back — what they held before this
           ran was the fallback agent, which the lane rule exists to replace. */
        await queryInterface.sequelize.query(
            `UPDATE shippings SET agent_id = NULL, "updatedAt" = NOW()
              WHERE agent_id IN (SELECT id FROM agents WHERE agent_code = :code)`,
            { replacements: { code: AGENT_CODE } }
        );
        await queryInterface.sequelize.query('DELETE FROM agents WHERE agent_code = :code', {
            replacements: { code: AGENT_CODE },
        });
    },
};
