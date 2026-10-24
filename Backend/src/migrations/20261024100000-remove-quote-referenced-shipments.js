'use strict';

/**
 * Remove what staging Zoho created, and what was booked against a quote.
 *
 * A separate migration, not another rule inside the previous one. That one has
 * already run on production: sequelize records it in SequelizeMeta and will
 * never run it again, so a rule added to it would sit there looking correct
 * and deleting nothing — which is exactly what was reported. A new rule needs
 * a new file.
 *
 * Two rules:
 *
 *   1. The vendor is a staging Zoho id. Every Zoho record id is prefixed with
 *      its organisation — production ids begin 6536807, staging ids begin
 *      6519617 — and a shipment created from staging carries the staging
 *      contact's id in vendor_name where a name should be. The previous
 *      migration looked for this prefix in metadata.zoho.salesorder_id and
 *      found nothing, because for these it is in vendor_name instead.
 *
 *   2. The order reference is a quote number rather than a sales order number.
 *
 * On the live data the two rules agree exactly: four shipments, QT-000386,
 * QT-000408, QT-000434 and QT-000456, each with a 6519617 vendor id. Worth
 * recording why that matters — a quote numbered QT-000386 also exists in
 * production Zoho, accepted and invoiced to ABANA LUXURY, which made this look
 * like it would destroy a real sale. It is not the same quote. Staging and
 * production number their quotes independently and the numbers collide; the
 * vendor id is what says which Zoho a shipment actually came from, and all
 * four say staging.
 *
 * Deletion order is the previous migration's, for the same reason: nothing
 * declares onDelete, so children go first and nullable references are unlinked
 * rather than destroyed.
 */

/* Zoho ids carry their organisation in the first seven digits. */
const STAGING_ZOHO_PREFIX = '6519617';

const QUOTE_PREFIX = 'QT';

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const { QueryTypes } = sequelize.constructor;

        const doomed = await sequelize.query(
            `SELECT id, shipment_reference, order_reference, status, vendor_name,
                    CASE
                      WHEN COALESCE(vendor_name, '') LIKE :stagingPrefix THEN 'staging Zoho vendor'
                      ELSE 'booked against a quote'
                    END AS reason
               FROM shippings
              WHERE COALESCE(vendor_name, '') LIKE :stagingPrefix
                 OR (metadata #>> '{zoho,salesorder_id}') LIKE :stagingPrefix
                 OR order_reference ILIKE :quotePrefix`,
            {
                replacements: {
                    quotePrefix: `${QUOTE_PREFIX}%`,
                    stagingPrefix: `${STAGING_ZOHO_PREFIX}%`
                },
                type: QueryTypes.SELECT
            }
        );

        if (doomed.length === 0) {
            console.log('[PURGE] No staging-Zoho or quote-referenced shipments to remove.');
            return;
        }

        const ids = doomed.map((row) => row.id);
        for (const row of doomed) {
            console.log(`[PURGE] ${row.shipment_reference} (${row.status}) — ${row.reason}, ref ${row.order_reference}, vendor ${row.vendor_name}`);
        }

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
            console.log(`[PURGE] Removed ${ids.length} staging-Zoho / quote-referenced shipments.`);
        } catch (error) {
            await t.rollback();
            throw error;
        }
    },

    async down() {
        console.log('[PURGE] Nothing to undo — deleted shipments cannot be restored.');
    }
};
