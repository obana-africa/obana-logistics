'use strict';

/**
 * Mahil Cargo Service — the vendor handling Italy → Nigeria for Obana.
 *
 * An agent is three rows, not one: the login in `users`, the role and name in
 * `user_attributes` (keyed by slug through the `attributes` table, the way
 * createUserAttributes does it), and the agent record itself. Written as a
 * migration rather than a seeder because only migrations run on deploy —
 * `prestart` is `migrate:up`, and `npm run seed` is nobody's habit.
 *
 * The lane lives in `assigned_zone` as "IT>NG" rather than in code. It is
 * already an editable field on an agent, so the next lane, or a change of
 * vendor on this one, is a row an admin edits instead of a deploy.
 *
 * No password is set. A hash in a migration is a shared secret in the git
 * history, and one printed to a deploy log is not much better — so the account
 * exists and its holder sets their own through the reset flow. Nothing about
 * assignment needs the login to work.
 *
 * Idempotent, and it re-points an existing record rather than making a second
 * one: the agent_code is the identity.
 */

const AGENT_CODE = 'OBANA-AGT-MAHIL-CARGO';
const LANE = 'IT>NG';
const NAME = { first: 'Mahil', last: 'Cargo Service' };

/* Overridable so the real address and number can be set on the service without
   a code change. The default is a placeholder and will not receive mail. */
const EMAIL = (process.env.AGENT_MAHIL_EMAIL || 'mahil.cargo.service@obana.africa').toLowerCase();
const PHONE = process.env.AGENT_MAHIL_PHONE || '+2348090335245';

module.exports = {
    async up(queryInterface) {
        const q = (sql, replacements) =>
            queryInterface.sequelize.query(sql, {
                replacements,
                type: queryInterface.sequelize.QueryTypes.SELECT,
            });

        const [existing] = await q('SELECT id, user_id FROM agents WHERE agent_code = :code LIMIT 1', { code: AGENT_CODE });

        /* The login. An address already in use belongs to somebody, so it is
           adopted rather than duplicated — users.email has no unique index and
           two rows with one address is the kind of thing nobody notices until a
           password reset goes to the wrong account. */
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

        /* Role and name, as attributes keyed by slug. */
        for (const [slug, value] of [['role', 'agent'], ['first_name', NAME.first], ['last_name', NAME.last]]) {
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
            country: 'Italy',
            state: 'Lombardy',
            city: 'Milan',
        };
        if (existing) {
            await queryInterface.sequelize.query(
                `UPDATE agents SET user_id = :userId, assigned_zone = :lane, country = :country,
                        state = :state, city = :city, status = 'active',
                        verification_status = 'verified', "updatedAt" = NOW()
                 WHERE agent_code = :code`,
                { replacements: fields }
            );
            return;
        }
        await queryInterface.sequelize.query(
            `INSERT INTO agents (agent_code, user_id, assigned_zone, country, state, city,
                                 status, verification_status, "createdAt", "updatedAt")
             VALUES (:code, :userId, :lane, :country, :state, :city,
                     'active', 'verified', NOW(), NOW())`,
            { replacements: fields }
        );
    },

    async down(queryInterface) {
        /* The agent goes; the user stays. Shipments reference agents.id, and a
           user may have been adopted rather than created here. */
        await queryInterface.sequelize.query('DELETE FROM agents WHERE agent_code = :code', {
            replacements: { code: AGENT_CODE },
        });
    },
};
