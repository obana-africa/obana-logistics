'use strict';

/**
 * Remove the test shipments, once, on deploy.
 *
 * A script somebody has to remember to run is a script that does not get run —
 * which is how test bookings were still sitting in the live list after the
 * tooling to find them existed. This does it where it cannot be forgotten.
 *
 * Three rules, each of them evidence rather than a guess:
 *
 *   1. It came from staging Zoho. Nothing on a shipment names the Zoho
 *      organisation, but every Zoho id is prefixed with it: production ids
 *      begin 6536807 and staging ids begin 6519617, consistently, across sales
 *      orders, customers and currencies alike. So the salesorder_id a shipment
 *      already stores says which Zoho created it.
 *
 *   2. A known test phone number is on it, at either end — delivery or pickup.
 *
 *   3. A known test address is on it, as the vendor or the pickup contact.
 *
 * Order matters. Nothing in this schema declares onDelete, so the database
 * refuses to remove a shipment while anything still points at it. Items and
 * tracking events carry shipment_id NOT NULL and describe the shipment, so
 * they go with it. Quotes and store webhook deliveries carry it nullable and
 * are true whether or not the shipment survives, so only the link is dropped.
 *
 * Idempotent: a second run finds nothing left to match and does nothing. It
 * cannot be undone, which is why down() says so rather than pretending.
 */

const STAGING_ZOHO_PREFIX = '6519617';

/* Every spelling the same number arrives in. */
const TEST_PHONES = ['2347035599433', '07035599433', '+2347035599433', '7035599433'];

const TEST_CONTACTS = ['op@gmail.com', 'opmail.com'];

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const { QueryTypes } = sequelize.constructor;

        /* Compare the last ten digits. 07035599433, 2347035599433 and
           +234 703 559 9433 are one number written three ways, and the tail is
           the part that does not change. */
        const tail10 = (value) => String(value).replace(/\D/g, '').slice(-10);
        const phoneTail = tail10(TEST_PHONES[0]);

        const doomed = await sequelize.query(
            `SELECT s.id, s.shipment_reference,
                    CASE
                      WHEN (s.metadata #>> '{zoho,salesorder_id}') LIKE :stagingPrefix THEN 'staging Zoho'
                      WHEN right(regexp_replace(COALESCE(d.phone, ''), '\\D', '', 'g'), 10) = :phoneTail THEN 'delivery phone'
                      WHEN right(regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g'), 10) = :phoneTail THEN 'pickup phone'
                      ELSE 'test contact'
                    END AS reason
               FROM shippings s
               LEFT JOIN addresses d ON d.id = s.delivery_address_id
               LEFT JOIN addresses p ON p.id = s.pickup_address_id
              WHERE (s.metadata #>> '{zoho,salesorder_id}') LIKE :stagingPrefix
                 OR right(regexp_replace(COALESCE(d.phone, ''), '\\D', '', 'g'), 10) = :phoneTail
                 OR right(regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g'), 10) = :phoneTail
                 OR lower(COALESCE(s.vendor_name, '')) IN (:contacts)
                 OR lower(COALESCE(d.name, '')) IN (:contacts)
                 OR lower(COALESCE(p.name, '')) IN (:contacts)
                 OR lower(COALESCE(d.contact_email, '')) IN (:contacts)
                 OR lower(COALESCE(p.contact_email, '')) IN (:contacts)`,
            {
                replacements: {
                    stagingPrefix: `${STAGING_ZOHO_PREFIX}%`,
                    phoneTail,
                    contacts: TEST_CONTACTS.map((c) => c.toLowerCase())
                },
                type: QueryTypes.SELECT
            }
        );

        if (doomed.length === 0) {
            console.log('[PURGE] No test shipments to remove.');
            return;
        }

        const ids = doomed.map((row) => row.id);
        for (const row of doomed) console.log(`[PURGE] ${row.shipment_reference} — ${row.reason}`);

        /* Only touch the tables that exist. A missing one would throw here and
           stop the deploy, which is a steep price for a cleanup. */
        const tables = await queryInterface.showAllTables();
        const has = (name) => tables.map((t) => String(t).toLowerCase()).includes(name);

        const t = await sequelize.transaction();
        try {
            const opts = { replacements: { ids }, transaction: t };
            if (has('quotes')) await sequelize.query('UPDATE quotes SET shipment_id = NULL WHERE shipment_id IN (:ids)', opts);
            if (has('store_webhook_deliveries')) {
                await sequelize.query('UPDATE store_webhook_deliveries SET shipment_id = NULL WHERE shipment_id IN (:ids)', opts);
            }
            if (has('shipment_items')) await sequelize.query('DELETE FROM shipment_items WHERE shipment_id IN (:ids)', opts);
            if (has('shipment_trackings')) await sequelize.query('DELETE FROM shipment_trackings WHERE shipment_id IN (:ids)', opts);
            await sequelize.query('DELETE FROM shippings WHERE id IN (:ids)', opts);
            await t.commit();
            console.log(`[PURGE] Removed ${ids.length} test shipments.`);
        } catch (error) {
            await t.rollback();
            throw error;
        }
    },

    async down() {
        /* Deliberately empty. The rows are gone; there is nothing honest to put
           back, and a down() that silently does nothing is better than one that
           claims to have restored something. */
        console.log('[PURGE] Nothing to undo — deleted shipments cannot be restored.');
    }
};
