'use strict';

/**
 * Papers belong to the shipment they are about.
 *
 * An air waybill, a packing list, a photograph of the goods on the pallet —
 * these were being passed around on WhatsApp because the shipment had nowhere
 * to hold them. The number everybody needs is then in a chat thread one person
 * can see, and the shipment record says nothing about it.
 *
 * JSONB rather than a table: a shipment has a handful of documents, they are
 * always read with the shipment and never queried on their own, and a column
 * does not need a join, a model, a migration per field, or a second place to
 * check permissions. If they ever need searching across shipments this becomes
 * a table, and the shape below is already what those rows would hold.
 *
 * Each entry:
 *   { id, url, name, kind, note, uploadedAt, uploadedBy }
 *
 * `kind` is the merchant's own word for it — "AWB", "Invoice", "Photo" — not
 * an enum, because the next document type nobody has thought of should not
 * need a deploy.
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable('shippings');
        if (table.documents) return;

        await queryInterface.addColumn('shippings', 'documents', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: [],
            comment: 'Attachments: air waybills, invoices, photographs of the goods.',
        });
    },

    async down(queryInterface) {
        const table = await queryInterface.describeTable('shippings');
        if (!table.documents) return;
        await queryInterface.removeColumn('shippings', 'documents');
    },
};
