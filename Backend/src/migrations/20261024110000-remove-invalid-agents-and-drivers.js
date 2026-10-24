'use strict';

/**
 * Remove the agents and drivers that were never real people.
 *
 * The evidence is the email domain. mailinator.com and yopmail.com are
 * throwaway inbox services — nobody registers a working driver on one, and
 * four drivers and two agents are on them. One of those drivers also carries
 * the phone number "-8163957177", which is not a phone number.
 *
 * Also the seeded demonstration drivers, OBANA-DRV-001 and -002, created by
 * scripts/seed-database.js with invented delivery counts so that an empty
 * environment had something to assign.
 *
 * A previous migration tried to remove those two and did not. Its query used
 * `d.metadata::text`, and Sequelize — scanning for :named replacements —
 * reads `:text` inside the cast as one of them. Written as CAST(… AS text)
 * here, which has no colons for it to find. The lesson that keeps repeating:
 * a rule that has already run cannot be edited into working, so this is a new
 * file rather than a correction of the old one.
 *
 * Deliberately narrow. Ten drivers carry ordinary gmail addresses and have no
 * deliveries yet; a rider who has not yet carried anything is not evidence of
 * anything, so they stay. Nothing is removed for being merely unused.
 *
 * A shipment that named one of these drivers keeps its history and simply
 * stops naming a driver: a delivery that happened happened whoever was
 * recorded as carrying it. The login behind each one is left alone — it may
 * carry other roles, and an orphaned user row costs nothing.
 */

/* Inbox services that exist to be thrown away. */
const DISPOSABLE_DOMAINS = ['mailinator.com', 'yopmail.com', 'maildrop.cc', 'guerrillamail.com', 'trashmail.com', '10minutemail.com'];

const SEEDED_DRIVER_CODES = ['OBANA-DRV-001', 'OBANA-DRV-002'];

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const { QueryTypes } = sequelize.constructor;

        /* The domain is taken out of the address and compared whole, with IN.
           LIKE ANY would read better and does not work: sequelize expands an
           array replacement into a value list, which is what IN wants and not
           what ANY wants — the sort of thing that fails by matching nothing
           rather than by raising. */

        /* ── drivers ─────────────────────────────────────────────────────── */
        const drivers = await sequelize.query(
            `SELECT d.id, d.driver_code, u.email
               FROM drivers d
               LEFT JOIN users u ON u.id = d.user_id
              WHERE d.driver_code IN (:codes)
                 OR lower(split_part(COALESCE(u.email, ''), '@', 2)) IN (:domains)`,
            {
                replacements: { codes: SEEDED_DRIVER_CODES, domains: DISPOSABLE_DOMAINS },
                type: QueryTypes.SELECT
            }
        );

        if (drivers.length) {
            const ids = drivers.map((d) => d.id);
            for (const d of drivers) console.log(`[PURGE] driver ${d.driver_code} (${d.email || 'no email'})`);
            const t = await sequelize.transaction();
            try {
                const opts = { replacements: { ids }, transaction: t };
                await sequelize.query('UPDATE shippings SET driver_id = NULL WHERE driver_id IN (:ids)', opts);
                await sequelize.query('DELETE FROM drivers WHERE id IN (:ids)', opts);
                await t.commit();
                console.log(`[PURGE] Removed ${ids.length} drivers.`);
            } catch (error) {
                await t.rollback();
                throw error;
            }
        } else {
            console.log('[PURGE] No invalid drivers to remove.');
        }

        /* ── agents ──────────────────────────────────────────────────────── */
        const agents = await sequelize.query(
            `SELECT a.id, a.agent_code, u.email
               FROM agents a
               LEFT JOIN users u ON u.id = a.user_id
              WHERE lower(split_part(COALESCE(u.email, ''), '@', 2)) IN (:domains)`,
            { replacements: { domains: DISPOSABLE_DOMAINS }, type: QueryTypes.SELECT }
        );

        if (agents.length) {
            const ids = agents.map((a) => a.id);
            for (const a of agents) console.log(`[PURGE] agent ${a.agent_code} (${a.email || 'no email'})`);
            const t = await sequelize.transaction();
            try {
                const opts = { replacements: { ids }, transaction: t };
                /* Same trade as the drivers: the shipment stays, the link goes. */
                await sequelize.query('UPDATE shippings SET agent_id = NULL WHERE agent_id IN (:ids)', opts);
                await sequelize.query('DELETE FROM agents WHERE id IN (:ids)', opts);
                await t.commit();
                console.log(`[PURGE] Removed ${ids.length} agents.`);
            } catch (error) {
                await t.rollback();
                throw error;
            }
        } else {
            console.log('[PURGE] No invalid agents to remove.');
        }
    },

    async down() {
        console.log('[PURGE] Nothing to undo — deleted agents and drivers cannot be restored.');
    }
};
