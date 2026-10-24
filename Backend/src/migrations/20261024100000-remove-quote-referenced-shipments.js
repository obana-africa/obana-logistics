'use strict';

/**
 * Remove the shipments booked against a quote rather than an order.
 *
 * A separate migration, not another rule inside the previous one. That one has
 * already run on production: sequelize records it in SequelizeMeta and will
 * never run it again, so a rule added to it would sit there looking correct
 * and doing nothing. A new rule needs a new file — which is the whole lesson
 * of this one.
 *
 * The rule: order_reference beginning QT- is a quote number. Both Zohos, since
 * the prefix is the same in each.
 *
 * Said plainly, because it is not reversible: this does not only remove
 * abandoned quotes. QT-000386 was accepted, converted to a sales order and
 * invoiced for $4,354 to ABANA LUXURY, and its shipment was in transit when
 * this was written. It goes with the rest, by instruction.
 *
 * Deletion order is the previous migration's, for the same reason: nothing
 * declares onDelete, so children go first and nullable references are unlinked
 * rather than destroyed.
 */

const QUOTE_PREFIX = 'QT';

module.exports = {
    async up(queryInterface) {
        const sequelize = queryInterface.sequelize;
        const { QueryTypes } = sequelize.constructor;

        const doomed = await sequelize.query(
            `SELECT id, shipment_reference, order_reference, status
               FROM shippings
              WHERE order_reference ILIKE :quotePrefix`,
            { replacements: { quotePrefix: `${QUOTE_PREFIX}%` }, type: QueryTypes.SELECT }
        );

        if (doomed.length === 0) {
            console.log('[PURGE] No quote-referenced shipments to remove.');
            return;
        }

        const ids = doomed.map((row) => row.id);
        for (const row of doomed) {
            console.log(`[PURGE] ${row.shipment_reference} (${row.status}) — booked against ${row.order_reference}`);
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
            console.log(`[PURGE] Removed ${ids.length} quote-referenced shipments.`);
        } catch (error) {
            await t.rollback();
            throw error;
        }
    },

    async down() {
        console.log('[PURGE] Nothing to undo — deleted shipments cannot be restored.');
    }
};
