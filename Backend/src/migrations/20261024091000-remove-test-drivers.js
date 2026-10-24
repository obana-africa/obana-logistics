'use strict';

/**
 * Remove the drivers that were never real.
 *
 * Two kinds, and both are recognisable rather than guessed at:
 *
 *   the seeded demonstration drivers — OBANA-DRV-001 and -002, created by
 *   scripts/seed-database.js with made-up names and obana.africa addresses so
 *   that an empty environment had something to assign;
 *
 *   anything registered against a known test address.
 *
 * A driver cannot simply be deleted: shipments point at them. The link is
 * dropped rather than the shipment, because a delivery that happened happened
 * whoever was recorded as carrying it — losing the shipment to tidy up a
 * driver would be the wrong trade entirely.
 *
 * The login behind the driver is left alone. It may be a real person's account
 * with other roles on it, and an orphaned user row costs nothing.
 *
 * Idempotent, and it says what it removed.
 */

const SEEDED_CODES = ['OBANA-DRV-001', 'OBANA-DRV-002'];
const TEST_EMAILS = ['driver1@obana.africa', 'driver2@obana.africa', 'op@gmail.com'];

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const { QueryTypes } = sequelize.constructor;

        const doomed = await sequelize.query(
            `SELECT d.id, d.driver_code, u.email
               FROM drivers d
               LEFT JOIN users u ON u.id = d.user_id
              WHERE d.driver_code IN (:codes)
                 OR lower(COALESCE(u.email, '')) IN (:emails)
                 OR lower(COALESCE(d.metadata::text, '')) LIKE ANY (ARRAY['%driver1@obana.africa%', '%driver2@obana.africa%'])`,
            {
                replacements: { codes: SEEDED_CODES, emails: TEST_EMAILS.map((e) => e.toLowerCase()) },
                type: QueryTypes.SELECT
            }
        );

        if (doomed.length === 0) {
            console.log('[PURGE] No test drivers to remove.');
            return;
        }

        const ids = doomed.map((d) => d.id);
        for (const d of doomed) console.log(`[PURGE] driver ${d.driver_code} (${d.email || 'no email'})`);

        const t = await sequelize.transaction();
        try {
            const opts = { replacements: { ids }, transaction: t };
            /* The shipment keeps its history; it just stops naming this driver. */
            await sequelize.query('UPDATE shippings SET driver_id = NULL WHERE driver_id IN (:ids)', opts);
            await sequelize.query('DELETE FROM drivers WHERE id IN (:ids)', opts);
            await t.commit();
            console.log(`[PURGE] Removed ${ids.length} test drivers.`);
        } catch (error) {
            await t.rollback();
            throw error;
        }
    },

    async down() {
        console.log('[PURGE] Nothing to undo — deleted drivers cannot be restored.');
    }
};
