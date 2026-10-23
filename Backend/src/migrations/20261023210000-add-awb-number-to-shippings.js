'use strict';

/**
 * The air waybill number, kept as a number.
 *
 * It is already captured: a document is attached with kind "AWB" and the
 * number written in the note beside it. That stays — it is how it arrives, and
 * changing it would complicate a flow that works. But a number living only
 * inside a note can be read by a person and by nothing else, and the summary
 * Obana issues, the WhatsApp message and any search for a waybill all need it
 * as a value.
 *
 * So it is also kept here, lifted from the note when an AWB is attached.
 */

module.exports = {
    async up(queryInterface, Sequelize) {
        const table = await queryInterface.describeTable('shippings');
        if (table.awb_number) return;
        await queryInterface.addColumn('shippings', 'awb_number', {
            type: Sequelize.STRING(64),
            allowNull: true,
            comment: 'Air waybill number, taken from the AWB document attached to the shipment.'
        });
    },

    async down(queryInterface) {
        const table = await queryInterface.describeTable('shippings');
        if (!table.awb_number) return;
        await queryInterface.removeColumn('shippings', 'awb_number');
    }
};
